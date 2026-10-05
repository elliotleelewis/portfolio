import { defineConfig } from 'drizzle-kit';

// Generates the leaderboard's migrations from its schema, for Wrangler to
// apply to D1 (see .github/scripts/leaderboard-db.sh).
export default defineConfig({
	dialect: 'sqlite',
	schema: './functions/_lib/schema.ts',
	out: './migrations',
});
