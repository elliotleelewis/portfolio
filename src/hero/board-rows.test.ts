import { describe, expect, it } from 'vitest';

import { compactRows } from './board-rows';

describe('compactRows', () => {
	it('shows the top three', () => {
		expect(compactRows(10)).toEqual([0, 1, 2]);
	});

	it('shows everything on a short board', () => {
		expect(compactRows(2)).toEqual([0, 1]);
		expect(compactRows(0)).toEqual([]);
	});

	it('shows my run with its neighbours, after a gap', () => {
		expect(compactRows(10, 6)).toEqual([0, 1, 2, 'gap', 5, 6, 7]);
	});

	it('runs straight on when my run is close to the top', () => {
		expect(compactRows(10, 3)).toEqual([0, 1, 2, 3, 4]);
		expect(compactRows(10, 4)).toEqual([0, 1, 2, 3, 4, 5]);
		expect(compactRows(10, 1)).toEqual([0, 1, 2]);
	});

	it('stops at the bottom of the board', () => {
		expect(compactRows(10, 9)).toEqual([0, 1, 2, 'gap', 8, 9]);
	});
});
