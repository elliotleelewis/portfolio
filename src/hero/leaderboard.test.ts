import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchBoard, saveScore } from './leaderboard';

const entry = { initials: 'ELL', trees: 40, metres: 600 };
const score = { initials: 'ELL', trees: 40, metres: 600, seconds: 60 };

/**
 * Has the API answer every request with this.
 * @param status - The HTTP status.
 * @param body - The body, as JSON, or text that isn't.
 */
const answer = (status: number, body: unknown): void => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => {
			await Promise.resolve();
			return new Response(
				typeof body === 'string' ? body : JSON.stringify(body),
				{ status },
			);
		}),
	);
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('fetchBoard', () => {
	it('reads the board', async () => {
		answer(200, { entries: [entry] });
		expect(await fetchBoard()).toEqual([entry]);
	});

	it('keeps the good entries when some are bad', async () => {
		answer(200, { entries: [entry, { initials: '<b>', trees: 1 }] });
		expect(await fetchBoard()).toEqual([entry]);
	});

	it('takes an answer it cannot read as an empty board', async () => {
		answer(200, 'not json');
		expect(await fetchBoard()).toEqual([]);
	});

	it('throws when the board cannot be reached', async () => {
		answer(503, { error: 'unavailable' });
		await expect(fetchBoard()).rejects.toThrow('503');
	});
});

describe('saveScore', () => {
	it('reads where the score went', async () => {
		answer(200, { entries: [entry], place: 1 });
		expect(await saveScore(score, 'token')).toEqual({
			kind: 'saved',
			entries: [entry],
			place: 1,
		});
	});

	it('reads a score that others pushed off the board', async () => {
		answer(200, { entries: [entry] });
		expect(await saveScore(score, 'token')).toEqual({
			kind: 'missed',
			entries: [entry],
		});
	});

	it('reads a score that was turned down', async () => {
		answer(400, { error: 'invalid' });
		expect(await saveScore(score, 'token')).toEqual({ kind: 'rejected' });
		answer(403, { error: 'unverified' });
		expect(await saveScore(score, 'token')).toEqual({ kind: 'rejected' });
	});

	it('reads a board that has closed for the day', async () => {
		answer(503, { error: 'closed' });
		expect(await saveScore(score, 'token')).toEqual({ kind: 'closed' });
	});

	it('fails on anything else', async () => {
		answer(503, { error: 'busy' });
		expect(await saveScore(score, 'token')).toEqual({ kind: 'failed' });
		answer(200, { entries: [entry], place: 'first' });
		expect(await saveScore(score, 'token')).toEqual({ kind: 'failed' });
		answer(500, 'not json');
		expect(await saveScore(score, 'token')).toEqual({ kind: 'failed' });
	});

	it('fails when the board cannot be reached', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				await Promise.resolve();
				throw new TypeError('offline');
			}),
		);
		expect(await saveScore(score, 'token')).toEqual({ kind: 'failed' });
	});
});
