import { afterEach, describe, expect, it, vi } from 'vitest';

import { canMakeBoard, fetchBoard, saveScore } from './leaderboard';

const entry = { initials: 'ELL', trees: 40, metres: 600 };
const run = { trees: 40, metres: 600, seconds: 60 };
const cutoff = { trees: 10, metres: 100 };

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
				{ status, headers: { 'Content-Type': 'application/json' } },
			);
		}),
	);
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('canMakeBoard', () => {
	it('lets any run on while the board has room', () => {
		expect(canMakeBoard({ trees: 0, metres: 0 }, null)).toBe(true);
	});

	it('needs more trees, or as many and further, once it is full', () => {
		expect(canMakeBoard({ trees: 11, metres: 0 }, cutoff)).toBe(true);
		expect(canMakeBoard({ trees: 10, metres: 101 }, cutoff)).toBe(true);
		expect(canMakeBoard({ trees: 10, metres: 100 }, cutoff)).toBe(false);
		expect(canMakeBoard({ trees: 9, metres: 999 }, cutoff)).toBe(false);
	});
});

describe('fetchBoard', () => {
	it('reads the board and the score to beat', async () => {
		answer(200, { entries: [entry], cutoff: null });
		expect(await fetchBoard()).toEqual({ entries: [entry], cutoff: null });
	});

	it('throws when the board cannot be reached', async () => {
		answer(503, { error: 'unavailable' });
		await expect(fetchBoard()).rejects.toThrow('503');
	});
});

describe('saveScore', () => {
	it('reads where the score went', async () => {
		answer(200, { entries: [entry], cutoff: null, place: 1 });
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'saved',
			board: { entries: [entry], cutoff: null },
			place: 1,
		});
	});

	it('reads a score that others pushed off the board', async () => {
		answer(200, { entries: [entry], cutoff, place: null });
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'missed',
			board: { entries: [entry], cutoff },
		});
	});

	it('reads why a score was turned down', async () => {
		answer(400, { error: 'blocked' });
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'blocked',
		});
		answer(400, { error: 'implausible' });
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'fastForwarded',
		});
		answer(400, { error: 'invalid' });
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'rejected',
		});
		answer(403, { error: 'unverified' });
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'rejected',
		});
	});

	it('reads a board that has closed for the day', async () => {
		answer(503, { error: 'closed' });
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'closed',
		});
	});

	it('fails on anything else', async () => {
		answer(503, { error: 'busy' });
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'failed',
		});
		answer(500, 'not json');
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'failed',
		});
		answer(503, 'not json');
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'failed',
		});
	});

	it('fails when the board cannot be reached', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				await Promise.resolve();
				throw new TypeError('offline');
			}),
		);
		expect(await saveScore('ELL', run, 'token')).toEqual({
			kind: 'failed',
		});
	});

	it('sends the run, the initials and the token as JSON', async () => {
		answer(200, { entries: [entry], cutoff: null, place: 1 });
		await saveScore('ELL', run, 'token');
		const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
		expect(url).toBe('/api/scores');
		expect(init?.method).toBe('POST');
		expect(typeof init?.body === 'string' && JSON.parse(init.body)).toEqual(
			{
				initials: 'ELL',
				...run,
				token: 'token',
			},
		);
	});
});
