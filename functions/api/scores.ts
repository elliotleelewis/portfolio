// The leaderboard's API, at /api/scores. Cloudflare Pages runs this as a
// Function next to the static site. The work is in src/leaderboard/server.ts.

import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';

import {
	type Database,
	getScores,
	isHuman,
	postScores,
} from '../../src/leaderboard/server';

// The Function's bindings, set in wrangler.toml: the D1 database, and the
// Turnstile widget's secret key.
interface Env {
	leaderboard?: D1Database;
	turnstileSecret?: string;
}

interface Context {
	request: Request;
	env: Env;
}

const database = (env: Env): Database | undefined =>
	env.leaderboard && drizzle(env.leaderboard);

/**
 * The board.
 * @param context - The request and the Function's bindings.
 * @param context.env - The bindings.
 * @returns The board, best first.
 */
export const onRequestGet = async ({ env }: Context): Promise<Response> =>
	getScores(database(env));

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
	postScores(request, database(env), {
		verify: async (token) =>
			env.turnstileSecret !== undefined &&
			isHuman(env.turnstileSecret, token),
	});
