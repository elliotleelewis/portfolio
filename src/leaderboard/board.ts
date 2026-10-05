import * as z from 'zod/mini';

import { bearBlastPoints } from '../game/scoring';

import { INITIALS } from './initials';

// The action the page's Turnstile widget names, so a token made for
// anything else doesn't count.
export const TURNSTILE_ACTION = 'score';

// How many runs the board keeps.
export const BOARD_SIZE = 10;

// Faster than I can ever roll: top speed is 28 m/s, pushed 35% faster (see
// `Player.roll`).
const maxSpeed = 40;
// More than enough for rounding, and any frames the game skips ahead.
const metresSlack = 20;
// More bears than one easter egg's blast ever catches.
const maxBlast = bearBlastPoints(20);
// The trail places an easter egg this often, in metres (see
// `EASTER_EGG_SPACING`), with some to spare.
const easterEggSpacing = 100;
// Way beyond any real run, so nothing silly ends up on the board.
const maxTrees = 10_000_000;
const maxMetres = 1_000_000;

const count = (max: number): z.ZodMiniInt =>
	z.int().check(z.minimum(0), z.maximum(max));

/**
 * Whether a run's distance and trees could fit in its time. Fast-forwarding
 * the game from the console covers far more ground than real time allows.
 * @param run - The run.
 * @returns True if they could.
 */
const isWithinReach = (run: Run): boolean => {
	const { trees, metres, seconds } = run;
	if (metres > maxSpeed * seconds + metresSlack) {
		return false;
	}
	// At most a tree a metre, every one in a combo, plus every easter egg
	// passed blasting a crowd of bears.
	const hits = metres + 1;
	const eggs = Math.floor(metres / easterEggSpacing) + 1;
	return trees <= (hits * (hits + 1)) / 2 + eggs * maxBlast;
};

// One run on the board.
export const ENTRY = z.object({
	initials: INITIALS,
	trees: count(maxTrees),
	metres: count(maxMetres),
});
export type Entry = z.infer<typeof ENTRY>;

// A finished run, as the game reports it, that could have happened in real
// play. Anyone can still send any score they like, so this only keeps the
// board free of the obviously impossible.
export const RUN = z
	.object({
		trees: count(maxTrees),
		metres: count(maxMetres),
		// Real time from setting off to the game-over card.
		seconds: z.number().check(z.minimum(0)),
	})
	.check(z.refine(isWithinReach));
export type Run = z.infer<typeof RUN>;

/**
 * Whether a run could have happened in real play.
 * @param run - The run.
 * @returns True if it could be real.
 */
export const isPlausible = (run: Run): boolean => RUN.safeParse(run).success;

/**
 * Whether one run beats another: more trees, then further on a tie.
 * @param a - One run.
 * @param b - The other.
 * @returns True if `a` ranks above `b`.
 */
const isAbove = (
	a: Omit<Entry, 'initials'>,
	b: Omit<Entry, 'initials'>,
): boolean => a.trees > b.trees || (a.trees === b.trees && a.metres > b.metres);

/**
 * Where a run would go on the board. A tie goes below the run already
 * there, which got there first.
 * @param board - The board, best first.
 * @param run - The run's trees and metres.
 * @returns Its place, counting from 1, or undefined if it doesn't make it.
 */
export const placeFor = (
	board: readonly Entry[],
	run: Omit<Entry, 'initials'>,
): number | undefined => {
	const index = board.findIndex((entry) => isAbove(run, entry));
	const place = (index === -1 ? board.length : index) + 1;
	return place <= BOARD_SIZE ? place : undefined;
};

/**
 * Puts a run on the board, if it makes it.
 * @param board - The board, best first.
 * @param entry - The run, with its initials.
 * @returns The new board, and the run's place on it (undefined if it didn't
 * make it, with the board unchanged).
 */
export const addEntry = (
	board: readonly Entry[],
	entry: Entry,
): { board: Entry[]; place: number | undefined } => {
	const place = placeFor(board, entry);
	if (place === undefined) {
		return { board: [...board], place };
	}
	const next = [...board];
	next.splice(place - 1, 0, entry);
	return { board: next.slice(0, BOARD_SIZE), place };
};

/**
 * Reads a board from JSON, which could hold anything: only well-formed
 * entries are kept (without anything extra), best first. One bad entry
 * doesn't lose the rest.
 * @param value - The parsed JSON.
 * @returns The board.
 */
export const readBoard = (value: unknown): Entry[] => {
	if (!Array.isArray(value)) {
		return [];
	}
	const board: Entry[] = [];
	for (const item of value) {
		const entry = ENTRY.safeParse(item);
		if (entry.success) {
			board.push(entry.data);
		}
	}
	return board
		.toSorted((a, b) => b.trees - a.trees || b.metres - a.metres)
		.slice(0, BOARD_SIZE);
};
