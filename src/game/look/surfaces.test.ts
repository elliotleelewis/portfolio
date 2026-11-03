// Some easter eggs paint textures on a canvas, so these need a DOM.
// @vitest-environment happy-dom
import {
	Group,
	type Material,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	SphereGeometry,
} from 'three';
import { describe, expect, it } from 'vitest';

import { createBearParts } from '../bear';
import { createCharacter } from '../character';
import { ALL_EASTER_EGGS, mergeParts } from '../easter-eggs';
import { createMystery } from '../mystery';

import { FINISHES, surface } from './surfaces';

/**
 * Every material drawn under an object.
 * @param root - The object.
 * @returns Its materials.
 */
const materialsUnder = (root: Object3D): Material[] => {
	const found: Material[] = [];
	root.traverse((child) => {
		if (!(child instanceof Mesh)) {
			return;
		}

		const material: unknown = child.material;
		if (Array.isArray(material)) {
			found.push(
				...material.filter((m) => m instanceof MeshStandardMaterial),
			);
		} else if (material instanceof MeshStandardMaterial) {
			found.push(material);
		}
	});
	return found;
};

/**
 * Whether a material is finished in one of the world's finishes.
 * @param material - The material.
 * @returns True if it is.
 */
const hasAFinish = (material: Material): boolean =>
	material instanceof MeshStandardMaterial &&
	Object.values(FINISHES).some(
		({ roughness, metalness }) =>
			material.roughness === roughness &&
			material.metalness === metalness,
	);

describe('surface', () => {
	it('is matte unless asked otherwise', () => {
		const material = surface('#808080');
		expect(material.roughness).toBe(FINISHES.matte.roughness);
		expect(material.metalness).toBe(FINISHES.matte.metalness);
	});

	it('takes its roughness and metalness from its finish', () => {
		const material = surface('#808080', 'metal', { opacity: 0.5 });
		expect(material.roughness).toBe(FINISHES.metal.roughness);
		expect(material.metalness).toBe(FINISHES.metal.metalness);
		expect(material.opacity).toBe(0.5);
	});

	it('lets parts in different colours but the same finish merge into one draw call', () => {
		const root = new Group();
		for (const color of ['#ff0000', '#00ff00', '#0000ff']) {
			root.add(new Mesh(new SphereGeometry(0.1), surface(color)));
		}
		const merged = mergeParts({ object: root }, 1);
		let meshes = 0;
		merged.object.traverse((child) => {
			if (child instanceof Mesh) {
				meshes++;
			}
		});
		expect(meshes).toBe(1);
		merged.unmerge();
	});
});

describe('the world', () => {
	it.each(ALL_EASTER_EGGS)('finishes the $id in its finishes', (egg) => {
		const { object } = egg.create();
		const materials = materialsUnder(object);
		expect(materials.length).toBeGreaterThan(0);
		expect(materials.filter((m) => !hasAFinish(m))).toEqual([]);
	});

	it('finishes me in its finishes', () => {
		const me = createCharacter();
		expect(materialsUnder(me.root).filter((m) => !hasAFinish(m))).toEqual(
			[],
		);
	});

	it('finishes the bears and the mystery in its finishes', () => {
		const { fur, muzzle, nose, glint } = createBearParts();
		const mystery = materialsUnder(createMystery().object);
		expect(
			[fur, muzzle, nose, glint, ...mystery].filter(
				(m) => !hasAFinish(m),
			),
		).toEqual([]);
	});
});
