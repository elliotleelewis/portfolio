import { Group, MeshLambertMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import {
	CHUNK_LENGTH,
	LANE_HALF_WIDTH,
	SLOPE_ANGLE,
	createLedge,
	slopeSurfaceHeight,
	terrainHeight,
} from './world';

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

describe('the ledge', () => {
	it('finds the slope surface where a tilted slope point lands', () => {
		const slope = new Group();
		slope.rotation.x = -SLOPE_ANGLE;
		slope.updateMatrixWorld();
		for (const [x, z] of [
			[0, -3],
			[5, -10],
			[-12, -1],
		]) {
			const point = slope.localToWorld(
				new Vector3(x, terrainHeight(x, z), z),
			);
			expect(slopeSurfaceHeight(point.x, point.z)).toBeCloseTo(
				point.y,
				4,
			);
		}
	});

	it('tucks its far edge just under the slope, leaving no gap', () => {
		const ledge = createLedge(new MeshLambertMaterial(), 60);
		const position = ledge.geometry.getAttribute('position');
		let tucked = 0;
		for (let i = 0; i < position.count; i++) {
			const x = position.getX(i);
			const z = position.getZ(i) + ledge.position.z;
			if (z < 0) {
				tucked++;
				expect(position.getY(i)).toBeLessThan(slopeSurfaceHeight(x, z));
			} else if (z === 0) {
				expect(position.getY(i)).toBeCloseTo(terrainHeight(x, 0));
			}
		}
		expect(tucked).toBeGreaterThan(0);
	});
});
