import { Box3, Mesh, type Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { createCharacter } from './character';

/**
 * Every mesh under an object.
 * @param object - The object.
 * @returns Its meshes.
 */
const meshesOf = (object: Object3D): Object3D[] => {
	const meshes: Object3D[] = [];
	object.traverse((child) => {
		if (child instanceof Mesh) {
			meshes.push(child);
		}
	});
	return meshes;
};

describe('createCharacter', () => {
	it('draws me with one mesh per material in each part that moves', () => {
		const c = createCharacter();
		expect(meshesOf(c.root)).toHaveLength(20);
		// Two sleeves-and-arms, and trousers and shoes.
		for (const limb of [c.leftArm, c.rightArm, c.leftLeg, c.rightLeg]) {
			expect(meshesOf(limb)).toHaveLength(2);
		}
	});

	it('keeps my eyes on their own, so they can blink', () => {
		const c = createCharacter();
		for (const eye of c.eyes) {
			expect(eye.parent).toBe(c.head);
		}
	});

	it('still knows where my hands and feet are', () => {
		const c = createCharacter();
		c.root.updateMatrixWorld(true);
		const [leftHand, rightHand, leftFoot, rightFoot] = c.extremities.map(
			(extremity) => extremity.getWorldPosition(new Vector3()),
		);
		expect(leftHand.x).toBeCloseTo(0.29, 2);
		expect(rightHand.x).toBeCloseTo(-0.29, 2);
		expect(leftHand.y).toBeCloseTo(0.772, 3);
		expect(leftFoot.toArray()).toEqual([
			expect.closeTo(0.1, 3),
			expect.closeTo(0.05, 3),
			expect.closeTo(0.04, 3),
		]);
		expect(rightFoot.x).toBeCloseTo(-0.1, 3);
	});

	it('is still my size and shape', () => {
		const c = createCharacter();
		c.root.updateMatrixWorld(true);
		const box = new Box3().setFromObject(c.root, true);
		expect(box.min.toArray()).toEqual([
			expect.closeTo(-0.338, 3),
			expect.closeTo(0.005, 3),
			expect.closeTo(-0.24, 3),
		]);
		expect(box.max.toArray()).toEqual([
			expect.closeTo(0.338, 3),
			expect.closeTo(1.889, 3),
			expect.closeTo(0.17, 3),
		]);
	});
});
