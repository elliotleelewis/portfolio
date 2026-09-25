import { describe, expect, it } from 'vitest';

import { bearChance } from './difficulty';

describe('bearChance', () => {
	it('starts low', () => {
		expect(bearChance(0)).toBeCloseTo(0.025);
	});

	it('ramps up over the first stretch', () => {
		expect(bearChance(660)).toBeCloseTo(0.08);
	});

	it('keeps rising, more slowly, the further I go', () => {
		expect(bearChance(1000)).toBeGreaterThan(bearChance(660));
		expect(bearChance(2000) - bearChance(1000)).toBeLessThan(
			bearChance(660) - bearChance(0),
		);
		expect(bearChance(3000)).toBeGreaterThan(bearChance(2000));
	});

	it('never goes past its limit', () => {
		expect(bearChance(100_000)).toBe(0.2);
	});
});
