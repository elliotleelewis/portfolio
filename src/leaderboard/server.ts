// The leaderboard's API, run by the Pages Function in
// `functions/api/scores.ts`. It's kept here, apart from Cloudflare's
// runtime, so it can be tested in Node, with Drizzle on SQLite standing in
// for D1.
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

import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as z from 'zod/mini';

import {
	type Entry,
	TURNSTILE_ACTION,
	addEntry,
	isPlausible,
	placeFor,
	readBoard,
} from './board';
import { INITIALS, isBlocked } from './initials';
import { BOARD_ID, LEADERBOARD } from './schema';

// The most scores the board takes in a day (UTC). One write each.
export const DAILY_WRITE_LIMIT = 1000;
// Bigger than any real submission.
const maxBodyLength = 2048;
// Tries before giving up when other scores keep landing first.
const maxAttempts = 3;
const siteverifyUrl =
	'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Drizzle on D1, or on anything else that speaks SQLite.
export type Database = BaseSQLiteDatabase<'async', unknown>;

type BoardRow = Omit<typeof LEADERBOARD.$inferSelect, 'id'>;

// The board before its row's first write, which creates the row.
const emptyRow: BoardRow = { version: 0, day: '', writes: 0, entries: [] };

// What a page sends to save a score: polite initials, a run that could have
// happened, and Turnstile's token.
const submissionSchema = z
	.object({
		initials: INITIALS.check(
			z.refine((initials: string) => !isBlocked(initials)),
		),
		trees: z.number(),
		metres: z.number(),
		seconds: z.number(),
		token: z.string().check(z.minLength(1)),
	})
	.check(z.refine(isPlausible));
export type Submission = z.infer<typeof submissionSchema>;

// Turnstile's answer, when a person passed its check, for saving a score.
const turnstilePass = z.object({
	success: z.literal(true),
	action: z.literal(TURNSTILE_ACTION),
});

export interface PostOptions {
	// Asks Turnstile whether a token is good.
	verify: (token: string) => Promise<boolean>;
	// Today, for counting writes.
	now?: Date;
}

const json = (body: unknown, status = 200, cache = 'no-store'): Response =>
	Response.json(body, {
		status,
		headers: { 'Cache-Control': cache },
	});

const error = (code: string, status: number): Response =>
	json({ error: code }, status);

const parseJson = (text: string): unknown => {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
};

/**
 * Reads the board's row: one row read.
 * @param db - The database.
 * @returns The row, or an empty board if nothing's been saved yet.
 */
const readRow = async (db: Database): Promise<BoardRow> => {
	const row = await db
		.select({
			version: LEADERBOARD.version,
			day: LEADERBOARD.day,
			writes: LEADERBOARD.writes,
			entries: LEADERBOARD.entries,
		})
		.from(LEADERBOARD)
		.where(eq(LEADERBOARD.id, BOARD_ID))
		.get();
	return row ?? emptyRow;
};

/**
 * Writes the board's row, creating it the first time, but only if it hasn't
 * changed since it was read: one row write, or none.
 * @param db - The database.
 * @param read - The row as it was read.
 * @param next - The row to write.
 * @returns Whether it was written.
 */
const hasWrittenRow = async (
	db: Database,
	read: BoardRow,
	next: BoardRow,
): Promise<boolean> => {
	const written = await db
		.insert(LEADERBOARD)
		.values({ id: BOARD_ID, ...next })
		.onConflictDoUpdate({
			target: LEADERBOARD.id,
			set: next,
			setWhere: eq(LEADERBOARD.version, read.version),
		})
		.returning({ version: LEADERBOARD.version });
	return written.length > 0;
};

/**
 * Reads a submission from a request's body, which could hold anything.
 * @param text - The body.
 * @returns The submission, or undefined if it isn't one the board takes.
 */
export const readSubmission = (text: string): Submission | undefined => {
	const submission = submissionSchema.safeParse(parseJson(text));
	return submission.success ? submission.data : undefined;
};

/**
 * Asks Turnstile whether a token is good, and was made for saving a score:
 * whether a person, not a bot, is saving it.
 * @param secret - The widget's secret key.
 * @param token - The token from the page.
 * @param fetcher - Makes the request (for tests).
 * @returns True if it passed.
 */
export const isHuman = async (
	secret: string,
	token: string,
	fetcher: typeof fetch = fetch,
): Promise<boolean> => {
	const body = new FormData();
	body.append('secret', secret);
	body.append('response', token);
	try {
		const response = await fetcher(siteverifyUrl, { method: 'POST', body });
		const result: unknown = await response.json();
		return turnstilePass.safeParse(result).success;
	} catch {
		return false;
	}
};

/**
 * Answers `GET /api/scores` with the board: one row read.
 * @param db - The database, if it's bound.
 * @returns The board, best first.
 */
export const getScores = async (
	db: Database | undefined,
): Promise<Response> => {
	if (!db) {
		return error('unavailable', 503);
	}
	const row = await readRow(db);
	// A little caching saves a request when someone plays again soon after.
	return json({ entries: readBoard(row.entries) }, 200, 'public, max-age=30');
};

/**
 * Answers `POST /api/scores`: checks a score, and puts it on the board if
 * it makes it. Everything that can be checked without the database is
 * checked first, and the score is written in one row write, only if the row
 * hasn't changed since it was read.
 * @param request - The request.
 * @param db - The database, if it's bound.
 * @param options - How to check Turnstile tokens, and today's date.
 * @returns The board, and the score's place on it (undefined if someone
 * else's scores pushed it off first).
 */
export const postScores = async (
	request: Request,
	db: Database | undefined,
	options: PostOptions,
): Promise<Response> => {
	if (!db) {
		return error('unavailable', 503);
	}
	if (Number(request.headers.get('Content-Length')) > maxBodyLength) {
		return error('invalid', 413);
	}
	const text = await request.text();
	const submission =
		text.length > maxBodyLength ? undefined : readSubmission(text);
	if (!submission) {
		return error('invalid', 400);
	}
	const entry: Entry = {
		initials: submission.initials,
		trees: submission.trees,
		metres: submission.metres,
	};
	const day = (options.now ?? new Date()).toISOString().slice(0, 10);
	let isVerified = false;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const row = await readRow(db);
		const board = readBoard(row.entries);
		if (placeFor(board, entry) === undefined) {
			return json({ entries: board, place: undefined });
		}
		if (row.day === day && row.writes >= DAILY_WRITE_LIMIT) {
			return error('closed', 503);
		}
		// Only once it would make the board, and only once: tokens are
		// single use.
		if (!isVerified) {
			isVerified = await options.verify(submission.token);
			if (!isVerified) {
				return error('unverified', 403);
			}
		}
		const next = addEntry(board, entry);
		// Only if the row is as it was read, so two scores at once can't
		// overwrite each other, and the day's writes (checked above) can't
		// have moved past the limit since.
		const isWritten = await hasWrittenRow(db, row, {
			version: row.version + 1,
			day,
			writes: row.day === day ? row.writes + 1 : 1,
			entries: next.board,
		});
		if (isWritten) {
			return json({ entries: next.board, place: next.place });
		}
	}
	return error('busy', 503);
};
