// Cloudflare Turnstile, which checks a person (not a bot) is saving a score.

import * as z from 'zod/mini';

// The action the page's Turnstile widget names, so a token made for anything
// else doesn't count. The page uses this type, so the two can't drift apart.
export const TURNSTILE_ACTION = 'score';
export type TurnstileAction = typeof TURNSTILE_ACTION;

const siteverifyUrl =
	'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Turnstile's answer, when a person passed its check, for saving a score.
const pass = z.object({
	success: z.literal(true),
	action: z.literal(TURNSTILE_ACTION),
});

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
		return pass.safeParse(result).success;
	} catch {
		return false;
	}
};
