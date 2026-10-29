import { describe, expect, it } from 'vitest';

import { LEASE_LIFETIME, issueLease, secondsSince } from './lease';

const secret = 'lease-secret';
const departure = Date.UTC(2026, 9, 29, 12);

describe('leases', () => {
	it('tell how long ago the run set off', async () => {
		const lease = await issueLease(secret, departure);
		expect(await secondsSince(secret, lease, departure + 90_500)).toBe(
			90.5,
		);
	});

	it('can’t be moved earlier for more time', async () => {
		const lease = await issueLease(secret, departure);
		const signature = lease.slice(lease.indexOf('.'));
		const earlier = `${String(departure - 600_000)}${signature}`;
		expect(await secondsSince(secret, earlier, departure)).toBeUndefined();
	});

	it('only count when made with the same secret', async () => {
		const lease = await issueLease('another-secret', departure);
		expect(await secondsSince(secret, lease, departure)).toBeUndefined();
	});

	it('run out', async () => {
		const lease = await issueLease(secret, departure);
		expect(
			await secondsSince(secret, lease, departure + LEASE_LIFETIME),
		).toBe(LEASE_LIFETIME / 1000);
		expect(
			await secondsSince(secret, lease, departure + LEASE_LIFETIME + 1),
		).toBeUndefined();
	});

	it('give no time for a run that sets off a moment ahead', async () => {
		const lease = await issueLease(secret, departure + 200);
		expect(await secondsSince(secret, lease, departure)).toBe(0);
	});

	it('turn down anything that isn’t one', async () => {
		for (const lease of [
			'',
			'lease',
			`${String(departure)}.`,
			`x.${'0'.repeat(64)}`,
		]) {
			expect(
				await secondsSince(secret, lease, departure),
			).toBeUndefined();
		}
	});
});
