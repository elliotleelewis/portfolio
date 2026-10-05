// The leaderboard's API, run by the Pages Function in
// `functions/api/scores.ts`. It's kept here, apart from Cloudflare's
// runtime, so it can be tested in Node.
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

import {
	type Entry,
	TURNSTILE_ACTION,
	addEntry,
	isPlausible,
	placeFor,
	readBoard,
} from './board';
import { isBlocked, isInitials } from './initials';

// The most scores the board takes in a day (UTC). One write each.
export const DAILY_WRITE_LIMIT = 1000;
// Bigger than any real submission.
const maxBodyLength = 2048;
// Tries before giving up when other scores keep landing first.
const maxAttempts = 3;
const siteverifyUrl =
	'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// The parts of Cloudflare's D1 binding this uses.
export interface Database {
	prepare: (query: string) => Statement;
}

export interface Statement {
	bind: (...values: unknown[]) => Statement;
	first: () => Promise<Record<string, unknown> | null>;
	run: () => Promise<{ meta: { changes: number } }>;
}

// The Function's bindings, set on the Pages project: the D1 database, and
// the Turnstile widget's secret key.
export interface Env {
	leaderboard?: Database;
	turnstileSecret?: string;
}

interface BoardRow {
	version: number;
	day: string;
	writes: number;
	entries: string;
}

// What a page sends to save a score.
export interface Submission {
	initials: string;
	trees: number;
	metres: number;
	seconds: number;
	token: string;
}

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

const parseEntries = (text: string): Entry[] => readBoard(parseJson(text));

/**
 * Reads the board's row: one row read.
 * @param db - The database.
 * @returns The row, or undefined if it hasn't been set up properly.
 */
const readRow = async (db: Database): Promise<BoardRow | undefined> => {
	const row = await db
		.prepare(
			'SELECT version, day, writes, entries FROM leaderboard WHERE id = 1',
		)
		.first();
	if (!row) {
		return undefined;
	}
	const { version, day, writes, entries } = row;
	const isRow =
		typeof version === 'number' &&
		typeof day === 'string' &&
		typeof writes === 'number' &&
		typeof entries === 'string';
	return isRow ? { version, day, writes, entries } : undefined;
};

/**
 * Reads a submission from a request's body, which could hold anything.
 * @param text - The body.
 * @returns The submission, or undefined if it isn't one.
 */
export const readSubmission = (text: string): Submission | undefined => {
	const value = parseJson(text);
	if (
		typeof value !== 'object' ||
		value === null ||
		!('initials' in value) ||
		!('trees' in value) ||
		!('metres' in value) ||
		!('seconds' in value) ||
		!('token' in value)
	) {
		return undefined;
	}
	const { initials, trees, metres, seconds, token } = value;
	const isSubmission =
		typeof trees === 'number' &&
		typeof metres === 'number' &&
		typeof seconds === 'number' &&
		typeof token === 'string' &&
		token.length > 0 &&
		isInitials(initials);
	return isSubmission
		? { initials, trees, metres, seconds, token }
		: undefined;
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
		return (
			typeof result === 'object' &&
			result !== null &&
			'success' in result &&
			result.success === true &&
			'action' in result &&
			result.action === TURNSTILE_ACTION
		);
	} catch {
		return false;
	}
};

/**
 * Answers `GET /api/scores` with the board: one row read.
 * @param env - The function's bindings.
 * @returns The board, best first.
 */
export const getScores = async (env: Env): Promise<Response> => {
	if (!env.leaderboard) {
		return error('unavailable', 503);
	}
	const row = await readRow(env.leaderboard);
	// A little caching saves a request when someone plays again soon after.
	return json(
		{ entries: row ? parseEntries(row.entries) : [] },
		200,
		'public, max-age=30',
	);
};

/**
 * Answers `POST /api/scores`: checks a score, and puts it on the board if
 * it makes it. Everything that can be checked without the database is
 * checked first, and the score is written in one row write, only if the row
 * hasn't changed since it was read.
 * @param request - The request.
 * @param env - The function's bindings.
 * @param options - How to check Turnstile tokens, and today's date.
 * @returns The board, and the score's place on it (undefined if someone
 * else's scores pushed it off first).
 */
export const postScores = async (
	request: Request,
	env: Env,
	options: PostOptions,
): Promise<Response> => {
	const { leaderboard: db } = env;
	if (!db) {
		return error('unavailable', 503);
	}
	if (Number(request.headers.get('Content-Length')) > maxBodyLength) {
		return error('invalid', 413);
	}
	const text = await request.text();
	const submission =
		text.length > maxBodyLength ? undefined : readSubmission(text);
	if (
		!submission ||
		isBlocked(submission.initials) ||
		!isPlausible(submission)
	) {
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
		if (!row) {
			return error('unavailable', 503);
		}
		const board = parseEntries(row.entries);
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
		// Writes nothing unless the row is as it was read, and the day's
		// writes are under the limit, so two scores at once can't overwrite
		// each other, and nothing can push the writes past the limit.
		const { meta } = await db
			.prepare(
				`UPDATE leaderboard
				SET entries = ?1,
					version = version + 1,
					writes = CASE WHEN day = ?2 THEN writes + 1 ELSE 1 END,
					day = ?2
				WHERE id = 1 AND version = ?3 AND (day <> ?2 OR writes < ?4)`,
			)
			.bind(
				JSON.stringify(next.board),
				day,
				row.version,
				DAILY_WRITE_LIMIT,
			)
			.run();
		if (meta.changes > 0) {
			return json({ entries: next.board, place: next.place });
		}
	}
	return error('busy', 503);
};
