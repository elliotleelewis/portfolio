import * as z from 'zod/mini';

import { type Entry, readBoard } from '../leaderboard/board';

const endpoint = '/api/scores';

// A finished run, and who's saving it.
export interface Score {
	initials: string;
	trees: number;
	metres: number;
	seconds: number;
}

// How saving a score went.
export type SaveResult =
	// On the board, at this place.
	| { kind: 'saved'; entries: Entry[]; place: number }
	// Others' scores pushed it off the board before it was saved.
	| { kind: 'missed'; entries: Entry[] }
	// Turned down: the initials, the run, or the check for a person.
	| { kind: 'rejected' }
	// The board has taken all the scores it will today.
	| { kind: 'closed' }
	// Couldn't reach the board, or something went wrong there.
	| { kind: 'failed' };

const readJson = async (response: Response): Promise<unknown> => {
	try {
		const body: unknown = await response.json();
		return body;
	} catch {
		return undefined;
	}
};

// The API's answers. Their entries are read with `readBoard`, one by one, so
// a bad one doesn't lose the rest.
const boardAnswer = z.object({ entries: z.unknown() });
const boardPlace = z.int().check(z.minimum(1));
const savedAnswer = z.object({
	entries: z.unknown(),
	// Missing when others' scores pushed it off the board first.
	place: z.optional(boardPlace),
});
const errorAnswer = z.object({ error: z.string() });

/**
 * Fetches the leaderboard.
 * @returns The board, best first.
 */
export const fetchBoard = async (): Promise<Entry[]> => {
	const response = await fetch(endpoint);
	if (!response.ok) {
		throw new Error(`The leaderboard answered ${String(response.status)}`);
	}
	const answer = boardAnswer.safeParse(await readJson(response));
	return answer.success ? readBoard(answer.data.entries) : [];
};

/**
 * Saves a score to the leaderboard.
 * @param score - The run, and the initials to put by it.
 * @param token - Turnstile's token, to show a person is saving it.
 * @returns How it went.
 */
export const saveScore = async (
	score: Score,
	token: string,
): Promise<SaveResult> => {
	let response: Response;
	try {
		response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...score, token }),
		});
	} catch {
		return { kind: 'failed' };
	}
	const body = await readJson(response);
	if (response.ok) {
		const answer = savedAnswer.safeParse(body);
		if (!answer.success) {
			return { kind: 'failed' };
		}
		const { place } = answer.data;
		const entries = readBoard(answer.data.entries);
		return place === undefined
			? { kind: 'missed', entries }
			: { kind: 'saved', entries, place };
	}
	if (response.status === 400 || response.status === 403) {
		return { kind: 'rejected' };
	}
	const answer = errorAnswer.safeParse(body);
	const isClosed = answer.success && answer.data.error === 'closed';
	return { kind: isClosed ? 'closed' : 'failed' };
};

// For the controller, which loads this module along with the board.
export { isPlausible, placeFor } from '../leaderboard/board';
