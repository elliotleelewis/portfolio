import { describe, expect, it } from 'vitest';

import { COMBO_WINDOW, bearBlastPoints, nextCombo } from './scoring';

describe('nextCombo', () => {
	it('builds while trees go down in quick succession', () => {
		expect(nextCombo(1, 0.4)).toBe(2);
		expect(nextCombo(4, COMBO_WINDOW - 0.01)).toBe(5);
	});

	it('starts again from one after a pause', () => {
		expect(nextCombo(6, COMBO_WINDOW)).toBe(1);
		expect(nextCombo(0, 10)).toBe(1);
	});
});

describe('bearBlastPoints', () => {
	it('multiplies the bonus by how many bears go at once', () => {
		expect([1, 2, 3, 4].map(bearBlastPoints)).toEqual([5, 20, 45, 80]);
	});

	it('gives nothing when no bears are caught', () => {
		expect(bearBlastPoints(0)).toBe(0);
	});
});
