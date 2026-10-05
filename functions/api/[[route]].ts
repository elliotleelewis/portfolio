// Everything under /api: the leaderboard's Hono app (functions/_lib/app.ts),
// run as a Cloudflare Pages Function, with the bindings in wrangler.toml.

import { drizzle } from 'drizzle-orm/d1';

import { type Bindings, createApp } from '../_lib/app';
import { readBlocked } from '../_lib/initials';
import { isHuman } from '../_lib/turnstile';

const app = createApp({
	database: (env) => env.leaderboard && drizzle(env.leaderboard),
	verify: async (env, token) =>
		env.turnstileSecret !== undefined &&
		isHuman(env.turnstileSecret, token),
	blocked: (env) => readBlocked(env.blockedInitials),
});

interface Context {
	request: Request;
	env: Bindings;
}

/**
 * Hands every request under /api to the app.
 * @param context - The request and the Function's bindings.
 * @param context.request - The request.
 * @param context.env - The bindings.
 * @returns The app's answer.
 */
export const onRequest = async ({ request, env }: Context): Promise<Response> =>
	app.fetch(request, env);
