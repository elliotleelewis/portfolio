// Cloudflare Turnstile, which checks a person (not a bot) is saving a score.

import * as z from 'zod/mini';

// The action the page's Turnstile widget names, so a token made for anything
// else doesn't count. The page uses this type, so the two can't drift apart.
export const TURNSTILE_ACTION = 'score';
export type TurnstileAction = typeof TURNSTILE_ACTION;

const siteverifyUrl =
	'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// How long to wait for Turnstile before giving up on the check.
const timeout = 5000;

// Turnstile's test secrets, which previews and local runs use. Their answers
// are stand-ins, with a made-up hostname, so that isn't checked.
const testSecrets = new Set(
	['1x', '2x', '3x'].map((prefix) => `${prefix}${'0'.repeat(31)}AA`),
);

// Turnstile's answer, when a person passed its check, for saving a score.
const pass = z.object({
	success: z.literal(true),
	action: z.literal(TURNSTILE_ACTION),
	hostname: z.string(),
});

// Where the token was sent from, to check it against.
export interface Visitor {
	// The site's hostname, which the token must have been made on.
	hostname: string;
	// Their IP address, if known, so Turnstile can tell if a token made by
	// one visitor is used by another.
	ip?: string;
}

/**
 * Asks Turnstile whether a token is good, was made for saving a score, and
 * on this site: whether a person, not a bot, is saving it.
 * @param secret - The widget's secret key.
 * @param token - The token from the page.
 * @param visitor - Where the token was sent from.
 * @param fetcher - Makes the request (for tests).
 * @returns True if it passed.
 */
export const isHuman = async (
	secret: string,
	token: string,
	visitor: Visitor,
	fetcher: typeof fetch = fetch,
): Promise<boolean> => {
	const body = new FormData();
	body.append('secret', secret);
	body.append('response', token);
	if (visitor.ip !== undefined) {
		body.append('remoteip', visitor.ip);
	}
	try {
		const response = await fetcher(siteverifyUrl, {
			method: 'POST',
			body,
			signal: AbortSignal.timeout(timeout),
		});
		const result = pass.safeParse(await response.json());
		return (
			result.success &&
			(testSecrets.has(secret) ||
				result.data.hostname === visitor.hostname)
		);
	} catch {
		return false;
	}
};
