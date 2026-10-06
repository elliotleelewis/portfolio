// The leaderboard's API: a Hono app, which functions/api/[[route]].ts runs
// as a Cloudflare Pages Function. The page calls it through Hono's typed
// client, with the `AppType` below, so the two can't disagree about what
// goes over the wire. It's kept apart from Cloudflare's runtime, so it can
// be tested in Node, with Drizzle on SQLite standing in for D1.
//
// It's built so it can never go over the free plans' daily limits:
//
// - The whole board is one row in D1, so every request reads at most a few
//   rows, and a saved score writes exactly one.
// - That row counts its own writes each day (in the same write), and stops
//   taking scores at DAILY_WRITE_LIMIT, far below D1's free 100,000 rows.
// - Reads are capped by Workers' free 100,000 requests a day: past that,
//   Cloudflare turns requests away rather than charging.
// - Turnstile, which checks a person is saving the score, is free with no
//   limit on checks.

import type { D1Database } from '@cloudflare/workers-types';
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import * as z from 'zod/mini';

import {
	type Entry,
	addEntry,
	cutoffFor,
	isPlausible,
	placeFor,
	readBoard,
} from './board';
import { INITIALS, isBlocked } from './initials';
import { type Database, hasWrittenRow, readRow } from './store';
import type { Visitor } from './turnstile';

// The most scores the board takes in a day (UTC). One write each.
export const DAILY_WRITE_LIMIT = 1000;
// Bigger than any real submission.
const maxBodyLength = 2048;
// Tries before giving up when other scores keep landing first.
const maxAttempts = 3;

// What a page sends to save a score. Whether the initials are polite and the
// run could be real are checked after, so the page hears which it was.
const submission = z.object({
	initials: INITIALS,
	trees: z.number(),
	metres: z.number(),
	seconds: z.number(),
	token: z.string().check(z.minLength(1)),
});

// The Function's bindings, set in wrangler.toml and on the Pages project: the
// D1 database, the Turnstile widget's secret key, and the extra initials to
// turn away (both secrets).
export interface Bindings {
	leaderboard?: D1Database;
	turnstileSecret?: string;
	blockedInitials?: string;
}

// How the app gets its database and checks from the bindings: for real in
// the Function, and with stand-ins in tests.
export interface AppOptions {
	// The database, if it's bound.
	database: (env: Bindings) => Database | undefined;
	// Asks Turnstile whether a token is good, and made on this site.
	verify: (
		env: Bindings,
		token: string,
		visitor: Visitor,
	) => Promise<boolean>;
	// Extra initials to turn away (see `readBlocked`).
	blocked: (env: Bindings) => ReadonlySet<string>;
	// Now, for counting the day's writes.
	now?: () => Date;
}

/**
 * Makes the leaderboard's API, under /api.
 * @param options - Where its database and checks come from.
 * @returns The app.
 */
export const createApp = (options: AppOptions) =>
	// eslint-disable-next-line @typescript-eslint/naming-convention -- Hono's name for it.
	new Hono<{ Bindings: Bindings }>()
		.basePath('/api')
		// Headers that tell browsers to treat answers as just what they are
		// (JSON, never a page to frame or a script to sniff).
		.use(secureHeaders())
		// Only the site itself saves scores. Browsers say where a request
		// comes from, so another site's page can't send one through a
		// visitor's browser.
		.use(async (c, next) => {
			const origin = c.req.header('Origin');
			if (
				origin !== undefined &&
				c.req.method === 'POST' &&
				origin !== new URL(c.req.url).origin
			) {
				return c.json({ error: 'invalid' } as const, 403);
			}
			await next();
		})
		.onError((error, c) => {
			// Malformed JSON, or a body that isn't JSON.
			if (error instanceof HTTPException && error.status === 400) {
				return c.json({ error: 'invalid' }, 400);
			}
			console.error(error);
			return c.json({ error: 'unavailable' }, 503);
		})
		// The board, best first, and the score to beat: one row read.
		.get('/scores', async (c) => {
			const db = options.database(c.env);
			if (!db) {
				return c.json({ error: 'unavailable' } as const, 503);
			}
			const row = await readRow(db);
			const board = readBoard(row.entries);
			// A little caching saves a request when someone plays again soon
			// after.
			c.header('Cache-Control', 'public, max-age=30');
			return c.json({ entries: board, cutoff: cutoffFor(board) }, 200);
		})
		// Saves a score, if it makes the board. Everything that can be
		// checked without the database is checked first, and the score is
		// written in one row write, only if the row hasn't changed since it
		// was read.
		.post(
			'/scores',
			bodyLimit({
				maxSize: maxBodyLength,
				onError: (c) => c.json({ error: 'invalid' } as const, 413),
			}),
			sValidator('json', submission, (result, c) => {
				if (!result.success) {
					return c.json({ error: 'invalid' } as const, 400);
				}
			}),
			async (c) => {
				// A saved score is the visitor's own, never one to cache.
				c.header('Cache-Control', 'no-store');
				const run = c.req.valid('json');
				if (isBlocked(run.initials, options.blocked(c.env))) {
					return c.json({ error: 'blocked' } as const, 400);
				}
				if (!isPlausible(run)) {
					return c.json({ error: 'implausible' } as const, 400);
				}
				const db = options.database(c.env);
				if (!db) {
					return c.json({ error: 'unavailable' } as const, 503);
				}
				const entry: Entry = {
					initials: run.initials,
					trees: run.trees,
					metres: run.metres,
				};
				const day = (options.now?.() ?? new Date())
					.toISOString()
					.slice(0, 10);
				let isVerified = false;

				for (let attempt = 0; attempt < maxAttempts; attempt++) {
					const row = await readRow(db);
					const board = readBoard(row.entries);
					if (placeFor(board, entry) === undefined) {
						return c.json(
							{
								entries: board,
								cutoff: cutoffFor(board),
								place: null,
							},
							200,
						);
					}
					if (row.day === day && row.writes >= DAILY_WRITE_LIMIT) {
						return c.json({ error: 'closed' } as const, 503);
					}
					// Only once it would make the board, and only once: tokens
					// are single use.
					if (!isVerified) {
						isVerified = await options.verify(c.env, run.token, {
							hostname: new URL(c.req.url).hostname,
							ip: c.req.header('CF-Connecting-IP'),
						});
						if (!isVerified) {
							return c.json(
								{ error: 'unverified' } as const,
								403,
							);
						}
					}
					const next = addEntry(board, entry);
					// Only if the row is as it was read, so two scores at once
					// can't overwrite each other, and the day's writes (checked
					// above) can't have moved past the limit since.
					const isWritten = await hasWrittenRow(db, row, {
						version: row.version + 1,
						day,
						writes: row.day === day ? row.writes + 1 : 1,
						entries: next.board,
					});
					if (isWritten) {
						return c.json(
							{
								entries: next.board,
								cutoff: cutoffFor(next.board),
								place: next.place ?? null,
							},
							200,
						);
					}
				}
				return c.json({ error: 'busy' } as const, 503);
			},
		);

// The API's routes and what they answer, for the page's typed client.
export type AppType = ReturnType<typeof createApp>;
