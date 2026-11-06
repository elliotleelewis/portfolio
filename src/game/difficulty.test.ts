import { describe, expect, it } from 'vitest';

import { bearChance } from './difficulty';
import { LANE_HALF_WIDTH } from './world';

describe('bearChance', () => {
	it('starts low', () => {
		expect(bearChance(0, 0)).toBeCloseTo(0.025);
	});

	it('ramps up over the first stretch', () => {
		expect(bearChance(660, 0)).toBeCloseTo(0.08);
	});

	it('keeps rising, more slowly, the further I go', () => {
		expect(bearChance(1000, 0)).toBeGreaterThan(bearChance(660, 0));
		expect(bearChance(2000, 0) - bearChance(1000, 0)).toBeLessThan(
			bearChance(660, 0) - bearChance(0, 0),
		);
		expect(bearChance(3000, 0)).toBeGreaterThan(bearChance(2000, 0));
	});

	it('never goes past its limit', () => {
		expect(bearChance(100_000, 0)).toBe(0.2);
	});

	it('is the same across most of the lane', () => {
		for (const x of [-20, -12, 0, 12, 20]) {
			expect(bearChance(450, x)).toBe(bearChance(450, 0));
		}
	});

	it('rises towards either edge, so the edge is no safer', () => {
		const middle = bearChance(450, 0);
		expect(bearChance(450, LANE_HALF_WIDTH - 1)).toBeCloseTo(middle * 1.75);
		expect(bearChance(450, LANE_HALF_WIDTH)).toBeCloseTo(middle * 2.5);
		expect(bearChance(450, -LANE_HALF_WIDTH)).toBeCloseTo(middle * 2.5);
		expect(bearChance(100_000, LANE_HALF_WIDTH)).toBeCloseTo(0.5);
	});
});
