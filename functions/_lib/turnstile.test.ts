import { describe, expect, it, vi } from 'vitest';

import { TURNSTILE_ACTION, type Visitor, isHuman } from './turnstile';

const visitor: Visitor = { hostname: 'elliotleelewis.com', ip: '192.0.2.1' };

const passed = {
	success: true,
	action: TURNSTILE_ACTION,
	hostname: visitor.hostname,
};

const answering = (body: unknown) =>
	vi.fn<typeof fetch>(async () => {
		await Promise.resolve();
		return Response.json(body);
	});

describe('isHuman', () => {
	it('passes a good token made for saving a score, on this site', async () => {
		const fetcher = answering(passed);
		expect(await isHuman('secret', 'token', visitor, fetcher)).toBe(true);
	});

	it('fails a bad token, or one made for something else', async () => {
		expect(
			await isHuman(
				'secret',
				'token',
				visitor,
				answering({ ...passed, success: false }),
			),
		).toBe(false);
		expect(
			await isHuman(
				'secret',
				'token',
				visitor,
				answering({ ...passed, action: 'login' }),
			),
		).toBe(false);
	});

	it('fails a token made on another site', async () => {
		const fetcher = answering({ ...passed, hostname: 'example.com' });
		expect(await isHuman('secret', 'token', visitor, fetcher)).toBe(false);
	});

	it('takes the stand-in answer from a test secret, whatever its hostname', async () => {
		const fetcher = answering({ ...passed, hostname: 'example.com' });
		expect(
			await isHuman(
				'1x0000000000000000000000000000000AA',
				'token',
				visitor,
				fetcher,
			),
		).toBe(true);
	});

	it('tells Turnstile who sent the token, and gives up if it hangs', async () => {
		const fetcher = answering(passed);
		await isHuman('secret', 'token', visitor, fetcher);
		const [, init] = fetcher.mock.calls[0] ?? [];
		const body = init?.body;
		expect(body).toBeInstanceOf(FormData);
		if (body instanceof FormData) {
			expect(body.get('remoteip')).toBe(visitor.ip);
		}
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it('fails when Turnstile cannot be reached', async () => {
		const fetcher = vi.fn<typeof fetch>(async () => {
			await Promise.resolve();
			throw new Error('offline');
		});
		expect(await isHuman('secret', 'token', visitor, fetcher)).toBe(false);
	});
});
