import { describe, expect, it } from 'vitest';

import { shuffle } from './shuffle';

describe('shuffle', () => {
	it('keeps every item exactly once', () => {
		const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
		const shuffled = shuffle(items);
		expect(shuffled).toHaveLength(items.length);
		expect(shuffled.toSorted()).toEqual(items);
	});

	it('leaves the original alone', () => {
		const items = [1, 2, 3];
		shuffle(items, () => 0);
		expect(items).toEqual([1, 2, 3]);
	});

	it('follows the random source it is given', () => {
		// Always picking the first remaining slot rotates the list.
		expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
	});
});
