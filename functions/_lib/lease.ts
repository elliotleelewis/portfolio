// A run's lease: when the Function saw it set off, signed so the page can't
// change it. The page hands it back with the score, so how long the run took
// is measured by the Function's clock, not reported by the page. It's signed
// rather than stored, so it costs no rows.

// The longest a lease lasts, in milliseconds: far longer than any real run,
// so a lease can't be kept back for days to make room for a made-up one.
export const LEASE_LIFETIME = 60 * 60 * 1000;

// A lease: when the run set off (milliseconds since 1970), then its
// signature, in hex.
const leasePattern = /^(\d{1,15})\.([\da-f]{64})$/;

const encoder = new TextEncoder();

const keyFor = async (secret: string): Promise<CryptoKey> =>
	crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);

// What's signed: what the lease is for, so a signature made for anything
// else can't pass as one.
const signedFor = (startedAt: number): Uint8Array<ArrayBuffer> =>
	encoder.encode(`run.${String(startedAt)}`);

const toHex = (bytes: ArrayBuffer): string =>
	Array.from(new Uint8Array(bytes), (byte) =>
		byte.toString(16).padStart(2, '0'),
	).join('');

const fromHex = (hex: string): Uint8Array<ArrayBuffer> =>
	Uint8Array.from(hex.match(/../g) ?? [], (pair) =>
		Number.parseInt(pair, 16),
	);

/**
 * Makes a lease for a run setting off now.
 * @param secret - The key leases are signed with.
 * @param now - Now, in milliseconds since 1970.
 * @returns The lease.
 */
export const issueLease = async (
	secret: string,
	now: number,
): Promise<string> => {
	const signature = await crypto.subtle.sign(
		'HMAC',
		await keyFor(secret),
		signedFor(now),
	);
	return `${String(now)}.${toHex(signature)}`;
};

/**
 * How long ago a lease's run set off, if the lease is one this Function made
 * and hasn't run out.
 * @param secret - The key leases are signed with.
 * @param lease - The lease from the page.
 * @param now - Now, in milliseconds since 1970.
 * @returns The seconds since it set off, or undefined if the lease is no good.
 */
export const secondsSince = async (
	secret: string,
	lease: string,
	now: number,
): Promise<number | undefined> => {
	const match = leasePattern.exec(lease);
	if (!match?.[1] || !match[2]) {
		return undefined;
	}
	const startedAt = Number(match[1]);
	// Checked in constant time, so the answer gives nothing away about how
	// close a forged signature came.
	const isSigned = await crypto.subtle.verify(
		'HMAC',
		await keyFor(secret),
		fromHex(match[2]),
		signedFor(startedAt),
	);
	// Another of Cloudflare's servers may have made it, its clock a moment
	// ahead of this one's, so it's never less than none.
	return isSigned && now - startedAt <= LEASE_LIFETIME
		? Math.max(0, now - startedAt) / 1000
		: undefined;
};
