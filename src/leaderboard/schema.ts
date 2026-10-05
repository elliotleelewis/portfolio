import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// The one row's ID.
export const BOARD_ID = 1;

// The leaderboard's table in D1. The whole board is one row, so reading it
// is one row read and saving a score is one row write (see ./server.ts).
// After changing this, run `pnpm db:generate` for a migration.
export const LEADERBOARD = sqliteTable(
	'leaderboard',
	{
		id: integer('id').primaryKey(),
		// Goes up with every write, so two scores saved at once can't
		// overwrite each other.
		version: integer('version').notNull().default(0),
		// The day (UTC) the writes below were counted on.
		day: text('day').notNull().default(''),
		writes: integer('writes').notNull().default(0),
		// The runs, best first, as JSON.
		entries: text('entries').notNull().default('[]'),
	},
	(table) => [
		check('one_row', sql`${table.id} = ${sql.raw(String(BOARD_ID))}`),
	],
);
