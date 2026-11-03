import { Color } from 'three';
import { describe, expect, it } from 'vitest';

import { createPines, pineTint } from './pines';

describe('pines', () => {
	it('makes each kind one geometry, coloured, for one draw call', () => {
		const { geometries, materials } = createPines();
		expect(geometries).toHaveLength(materials.length);
		for (const geometry of geometries) {
			expect(geometry.getAttribute('position')).toBeDefined();
			expect(geometry.getAttribute('normal')).toBeDefined();
			expect(geometry.getAttribute('color')).toBeDefined();
		}
	});

	it('costs about a fifth more triangles than a pine of plain cones', () => {
		const { geometries } = createPines();
		// The old pines: 14 triangles a tier, and a 24-triangle trunk.
		const plain = [6, 5, 8].map((tiers) => tiers * 14 + 24);
		for (const [i, geometry] of geometries.entries()) {
			const triangles = geometry.getAttribute('position').count / 3;
			expect(triangles).toBeLessThanOrEqual(plain[i] * 1.3);
		}
	});

	it('faces its branches up and out, and their undersides down', () => {
		const [geometry] = createPines().geometries;
		const normals = geometry.getAttribute('normal');
		let up = 0;
		let down = 0;
		for (let i = 0; i < normals.count; i++) {
			const y = normals.getY(i);
			if (y > 0.1) {
				up++;
			} else if (y < -0.1) {
				down++;
			}
		}
		expect(up).toBeGreaterThan(0);
		expect(down).toBe(up);
	});

	it('paints its shading in: lit tips, and a dark hollow underneath', () => {
		const [geometry] = createPines().geometries;
		const colors = geometry.getAttribute('color');
		const brightness: number[] = [];
		for (let i = 0; i < colors.count; i++) {
			brightness.push(colors.getY(i));
		}
		expect(Math.max(...brightness)).toBeGreaterThan(
			Math.min(...brightness) * 2,
		);
	});

	it('gives each tree a tint of its own, the same every time', () => {
		const first = pineTint(3, new Color());
		expect(pineTint(3, new Color()).equals(first)).toBe(true);
		expect(pineTint(4, new Color()).equals(first)).toBe(false);
		for (let i = 0; i < 100; i++) {
			const { r, g, b } = pineTint(i, new Color());
			for (const channel of [r, g, b]) {
				expect(channel).toBeGreaterThan(0.75);
				expect(channel).toBeLessThan(1.3);
			}
		}
	});
});
