import { hc } from 'hono/client';

import type { AppType } from '../../functions/_lib/app';
import type { Entry, Score } from '../../functions/_lib/board';

// The leaderboard's API, typed from its Hono app (functions/_lib/app.ts), so
// the page can't send or expect anything the Function doesn't. Only its
// types come over: none of the Function's code ends up in the page.
const client = hc<AppType>('/');

// The shared board, best first, and the score a run has to beat to make it
// (null while it has room).
export interface Board {
	entries: Entry[];
	cutoff: Score | null;
}

// A finished run: trees, metres, and how long it took in real time.
export interface Run extends Score {
	seconds: number;
}

// How saving a score went.
export type SaveResult =
	// On the board, at this place.
	| { kind: 'saved'; board: Board; place: number }
	// Others' scores pushed it off the board before it was saved.
	| { kind: 'missed'; board: Board }
	// The initials would put something rude on the board.
	| { kind: 'blocked' }
	// The run went further than real time allows.
	| { kind: 'fastForwarded' }
	// Turned down: the request, or the check for a person.
	| { kind: 'rejected' }
	// The board has taken all the scores it will today.
	| { kind: 'closed' }
	// Couldn't reach the board, or something went wrong there.
	| { kind: 'failed' };

/**
 * Whether a run makes the board, so it's worth asking for initials. The
 * Function has the final say when it's saved.
 * @param run - The run.
 * @param cutoff - The score to beat, or null while the board has room.
 * @returns True if it beats it: more trees, or as many and further.
 */
export const canMakeBoard = (run: Score, cutoff: Score | null): boolean =>
	cutoff === null ||
	run.trees > cutoff.trees ||
	(run.trees === cutoff.trees && run.metres > cutoff.metres);

/**
 * Fetches the leaderboard.
 * @returns The board, and the score to beat.
 */
export const fetchBoard = async (): Promise<Board> => {
	const response = await client.api.scores.$get();
	if (response.status !== 200) {
		throw new Error(`The leaderboard answered ${String(response.status)}`);
	}
	return response.json();
};

/**
 * Saves a score to the leaderboard.
 * @param initials - The initials to put by it.
 * @param run - The run.
 * @param token - Turnstile's token, to show a person is saving it.
 * @returns How it went.
 */
export const saveScore = async (
	initials: string,
	run: Run,
	token: string,
): Promise<SaveResult> => {
	try {
		const response = await client.api.scores.$post({
			json: { initials, ...run, token },
		});
		switch (response.status) {
			case 200: {
				const { place, ...board } = await response.json();
				return place === null
					? { kind: 'missed', board }
					: { kind: 'saved', board, place };
			}
			case 400: {
				const { error } = await response.json();
				if (error === 'blocked') {
					return { kind: 'blocked' };
				}
				return {
					kind:
						error === 'implausible' ? 'fastForwarded' : 'rejected',
				};
			}
			case 403: {
				return { kind: 'rejected' };
			}
			case 503: {
				const { error } = await response.json();
				return { kind: error === 'closed' ? 'closed' : 'failed' };
			}
			default: {
				return { kind: 'failed' };
			}
		}
	} catch {
		// Offline, or an answer that isn't the API's.
		return { kind: 'failed' };
	}
};
