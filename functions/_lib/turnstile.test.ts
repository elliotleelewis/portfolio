import { describe, expect, it, vi } from 'vitest';

import { TURNSTILE_ACTION, isHuman } from './turnstile';

const answering = (body: unknown): typeof fetch =>
	vi.fn(async () => {
		await Promise.resolve();
		return Response.json(body);
	});

describe('isHuman', () => {
	it('passes a good token made for saving a score', async () => {
		const fetcher = answering({ success: true, action: TURNSTILE_ACTION });
		expect(await isHuman('secret', 'token', fetcher)).toBe(true);
	});

	it('fails a bad token, or one made for something else', async () => {
		expect(
			await isHuman('secret', 'token', answering({ success: false })),
		).toBe(false);
		expect(
			await isHuman(
				'secret',
				'token',
				answering({ success: true, action: 'login' }),
			),
		).toBe(false);
	});

	it('fails when Turnstile cannot be reached', async () => {
		const fetcher = vi.fn(async () => {
			await Promise.resolve();
			throw new Error('offline');
		});
		expect(await isHuman('secret', 'token', fetcher)).toBe(false);
	});
});
