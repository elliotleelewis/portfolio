import type { KnipConfig } from 'knip';

// Finds dependencies, files and exports nothing uses. Knip's plugins find
// most entry points themselves (Astro's pages, the tests, the configs).
export default {
	entry: [
		// Cloudflare Pages turns each file here into a route.
		'functions/api/**/*.ts',
		// The screenshots (`pnpm shots`), from their own Playwright config.
		'shots/*.spec.ts',
	],
	ignoreDependencies: [
		// Loaded by path, from project.inlang/settings.json.
		'@inlang/plugin-message-format',
		// Run by .github/scripts/leaderboard-db.sh, and by hand to run the
		// leaderboard locally (see the README).
		'wrangler',
	],
} satisfies KnipConfig;
