// The leaderboard's API, at /api/scores. Cloudflare Pages runs this as a
// Function next to the static site. The work is in src/leaderboard/server.ts.

import {
	type Env,
	getScores,
	isHuman,
	postScores,
} from '../../src/leaderboard/server';

interface Context {
	request: Request;
	env: Env;
}

/**
 * The board.
 * @param context - The request and the Function's bindings.
 * @param context.env - The bindings.
 * @returns The board, best first.
 */
export const onRequestGet = async ({ env }: Context): Promise<Response> =>
	getScores(env);

/**
 * Saves a score.
 * @param context - The request and the Function's bindings.
 * @param context.request - The request.
 * @param context.env - The bindings.
 * @returns The board, and the score's place on it.
 */
export const onRequestPost = async ({
	request,
	env,
}: Context): Promise<Response> =>
	postScores(request, env, {
		verify: async (token) =>
			env.turnstileSecret !== undefined &&
			isHuman(env.turnstileSecret, token),
	});
