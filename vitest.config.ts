import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// The game's models, read from disk before the tests, as the page
		// fetches them before a run.
		setupFiles: ['src/game/models/read-for-tests.ts'],
	},
});
