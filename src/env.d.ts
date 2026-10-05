// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
	// The Turnstile widget's site key, for saving scores to the leaderboard.
	// Without it, the page uses Cloudflare's test key, which always passes.
	// eslint-disable-next-line @typescript-eslint/naming-convention -- Astro's name for it.
	readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}
