import { describe, expect, it } from 'vitest';

import { CHUNK_LENGTH, LANE_HALF_WIDTH, terrainHeight } from './world';

describe('terrainHeight', () => {
	it('is the same every time for the same spot', () => {
		expect(terrainHeight(3.2, -140)).toBe(terrainHeight(3.2, -140));
	});

	it('is smooth enough to roll over, including across ground chunks', () => {
		for (let z = 0; z > -CHUNK_LENGTH * 4; z -= 0.5) {
			for (const x of [-LANE_HALF_WIDTH, 0, LANE_HALF_WIDTH]) {
				const step = Math.abs(
					terrainHeight(x, z) - terrainHeight(x, z - 0.1),
				);
				expect(step).toBeLessThan(0.2);
			}
		}
	});
});
