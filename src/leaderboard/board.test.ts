import { describe, expect, it } from 'vitest';

import {
	BOARD_SIZE,
	type Entry,
	addEntry,
	isPlausible,
	placeFor,
	readBoard,
} from './board';

const entry = (initials: string, trees: number, metres = 100): Entry => ({
	initials,
	trees,
	metres,
});

// A full board: 100 trees down to 10.
const full = Array.from({ length: BOARD_SIZE }, (_, i) =>
	entry('AAA', (BOARD_SIZE - i) * 10),
);

describe('isPlausible', () => {
	it('takes a real run', () => {
		expect(isPlausible({ trees: 120, metres: 900, seconds: 75 })).toBe(
			true,
		);
	});

	it('takes a run that went nowhere', () => {
		expect(isPlausible({ trees: 0, metres: 0, seconds: 7 })).toBe(true);
	});

	it('turns down a run further than real time allows', () => {
		// What `hero.game.advance(600)` in the console gets you.
		expect(isPlausible({ trees: 300, metres: 15_000, seconds: 10 })).toBe(
			false,
		);
	});

	it('turns down more trees than the distance could hold', () => {
		expect(isPlausible({ trees: 1_000_000, metres: 50, seconds: 10 })).toBe(
			false,
		);
	});

	it('turns down numbers that are not counts', () => {
		expect(isPlausible({ trees: -1, metres: 10, seconds: 10 })).toBe(false);
		expect(isPlausible({ trees: 1.5, metres: 10, seconds: 10 })).toBe(
			false,
		);
		expect(isPlausible({ trees: 1, metres: 10, seconds: NaN })).toBe(false);
	});
});

describe('placeFor', () => {
	it('puts the first run first', () => {
		expect(placeFor([], { trees: 0, metres: 0 })).toBe(1);
	});

	it('ranks by trees, then distance', () => {
		const board = [entry('AAA', 50, 400), entry('BBB', 20)];
		expect(placeFor(board, { trees: 60, metres: 0 })).toBe(1);
		expect(placeFor(board, { trees: 50, metres: 500 })).toBe(1);
		expect(placeFor(board, { trees: 30, metres: 0 })).toBe(2);
		expect(placeFor(board, { trees: 1, metres: 0 })).toBe(3);
	});

	it('puts a tie below the run that got there first', () => {
		expect(placeFor([entry('AAA', 50)], { trees: 50, metres: 100 })).toBe(
			2,
		);
	});

	it('leaves out a run that does not make a full board', () => {
		expect(placeFor(full, { trees: 10, metres: 100 })).toBeUndefined();
		expect(placeFor(full, { trees: 11, metres: 0 })).toBe(BOARD_SIZE);
	});
});

describe('addEntry', () => {
	it('slots the run in, and drops the last off a full board', () => {
		const { board, place } = addEntry(full, entry('ELL', 55));
		expect(place).toBe(6);
		expect(board).toHaveLength(BOARD_SIZE);
		expect(board[5]).toEqual(entry('ELL', 55));
		expect(board.at(-1)?.trees).toBe(20);
	});

	it('leaves the board as it was if the run misses out', () => {
		const { board, place } = addEntry(full, entry('ELL', 1));
		expect(place).toBeUndefined();
		expect(board).toEqual(full);
	});
});

describe('readBoard', () => {
	it('keeps well-formed entries, best first', () => {
		expect(
			readBoard([entry('BBB', 5), entry('AAA', 9), { trees: 99 }]),
		).toEqual([entry('AAA', 9), entry('BBB', 5)]);
	});

	it('drops anything else it could hold', () => {
		expect(readBoard('nope')).toEqual([]);
		expect(readBoard([entry('<b>', 5), entry('AAA', -1), null])).toEqual(
			[],
		);
	});

	it('keeps only the top of the board', () => {
		expect(readBoard([...full, entry('ZZZ', 1)])).toHaveLength(BOARD_SIZE);
	});

	it('strips anything extra from an entry', () => {
		expect(readBoard([{ ...entry('AAA', 1), html: '<b>' }])).toEqual([
			entry('AAA', 1),
		]);
	});
});
