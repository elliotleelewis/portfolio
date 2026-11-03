import { Box3, BoxGeometry, type BufferGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { roundedBox } from './shapes';

/**
 * How big a geometry is, along each axis.
 * @param geometry - The geometry.
 * @returns Its size.
 */
const sizeOf = (geometry: BufferGeometry): Vector3 => {
	geometry.computeBoundingBox();
	return (geometry.boundingBox ?? new Box3()).getSize(new Vector3());
};

describe('roundedBox', () => {
	it('is the size it was asked for', () => {
		const box = roundedBox(0.8, 0.5, 0.3);
		const size = sizeOf(box);
		expect(size.x).toBeCloseTo(0.8);
		expect(size.y).toBeCloseTo(0.5);
		expect(size.z).toBeCloseTo(0.3);
	});

	it('rounds its edges, with normals that bend round them', () => {
		const box = roundedBox(0.8, 0.5, 0.3);
		const normals = box.getAttribute('normal');
		let isDiagonal = false;
		for (let i = 0; i < normals.count; i++) {
			const axes = [normals.getX(i), normals.getY(i), normals.getZ(i)];
			if (axes.filter((axis) => Math.abs(axis) > 0.1).length > 1) {
				isDiagonal = true;
			}
		}
		expect(isDiagonal).toBe(true);
	});

	it('leaves boxes too thin to see rounded sharp, saving their triangles', () => {
		const sheet = roundedBox(0.2, 0.3, 0.002);
		expect(sheet.getAttribute('position').count).toBe(
			new BoxGeometry().getAttribute('position').count,
		);
	});

	it('costs only a few more triangles than a sharp box', () => {
		const box = roundedBox(1, 1, 1);
		const triangles = (box.index?.count ?? 0) / 3;
		expect(triangles).toBeLessThanOrEqual(108);
	});
});
