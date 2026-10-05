// Reads and writes the board's one row in D1, through Drizzle. Each read is
// one row read, and each write one row written, or none.

import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { BOARD_ID, LEADERBOARD } from './schema';

// Drizzle on D1, or on anything else that speaks SQLite.
export type Database = BaseSQLiteDatabase<'async', unknown>;

export type BoardRow = Omit<typeof LEADERBOARD.$inferSelect, 'id'>;

// The board before its row's first write, which creates the row.
const emptyRow: BoardRow = { version: 0, day: '', writes: 0, entries: [] };

/**
 * Reads the board's row: one row read.
 * @param db - The database.
 * @returns The row, or an empty board if nothing's been saved yet.
 */
export const readRow = async (db: Database): Promise<BoardRow> => {
	const row = await db
		.select({
			version: LEADERBOARD.version,
			day: LEADERBOARD.day,
			writes: LEADERBOARD.writes,
			entries: LEADERBOARD.entries,
		})
		.from(LEADERBOARD)
		.where(eq(LEADERBOARD.id, BOARD_ID))
		.get();
	return row ?? emptyRow;
};

/**
 * Writes the board's row, creating it the first time, but only if it hasn't
 * changed since it was read: one row write, or none.
 * @param db - The database.
 * @param read - The row as it was read.
 * @param next - The row to write.
 * @returns Whether it was written.
 */
export const hasWrittenRow = async (
	db: Database,
	read: BoardRow,
	next: BoardRow,
): Promise<boolean> => {
	const written = await db
		.insert(LEADERBOARD)
		.values({ id: BOARD_ID, ...next })
		.onConflictDoUpdate({
			target: LEADERBOARD.id,
			set: next,
			setWhere: eq(LEADERBOARD.version, read.version),
		})
		.returning({ version: LEADERBOARD.version });
	return written.length > 0;
};
