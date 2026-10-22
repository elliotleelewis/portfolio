import {
	Box3,
	BufferAttribute,
	BufferGeometry,
	Color,
	Mesh,
	type Object3D,
	SkinnedMesh,
	Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';

import { type Character, createCharacter } from './character';

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

/**
 * Strikes a pose: mid-cartwheel, leaning, looking round, blinking.
 * @param c - Me.
 */
const pose = (c: Character): void => {
	c.root.position.set(2, 0.3, -5);
	c.lean.rotation.z = 0.2;
	c.roller.rotation.x = 1.2;
	c.roller.position.y = 0.4;
	c.facing.rotation.y = 1.1;
	c.body.position.y = -1.03;
	c.head.rotation.set(-0.2, 0.5, 0);
	c.leftArm.rotation.z = 2.1;
	c.rightArm.rotation.z = -1.7;
	c.leftLeg.rotation.z = 0.4;
	c.rightLeg.rotation.set(0.3, 0, -0.5);
	for (const eye of c.eyes) {
		eye.scale.y = 0.15;
	}
};
/**
 * Every vertex I draw, wherever it is in the world, summed up.
 * @param c - Me.
 * @returns How many there are, their total, and their squares'.
 */
const drawn = (c: Character): number[] => {
	c.root.updateMatrixWorld(true);
	let count = 0;
	let squares = 0;
	const sum = new Vector3();
	const vertex = new Vector3();
	c.root.traverseVisible((child) => {
		if (!(child instanceof Mesh)) {
			return;
		}
		const geometry: unknown = child.geometry;
		if (!(geometry instanceof BufferGeometry)) {
			return;
		}
		const position: unknown = geometry.getAttribute('position');
		if (!(position instanceof BufferAttribute)) {
			return;
		}
		for (let i = 0; i < position.count; i++) {
			child.getVertexPosition(i, vertex).applyMatrix4(child.matrixWorld);
			count++;
			sum.add(vertex);
			squares += vertex.lengthSq();
		}
	});
	return [count, sum.x, sum.y, sum.z, squares];
};

describe('createCharacter', () => {
	it('draws me in a handful of meshes, each on the joints it moves with', () => {
		const c = createCharacter();
		const meshes = meshesOf(c.root);
		expect(meshes.length).toBeLessThanOrEqual(5);
		// Skinned to my joints, or (my glasses) all on the one joint.
		for (const mesh of meshes) {
			expect(mesh instanceof SkinnedMesh || mesh.parent === c.head).toBe(
				true,
			);
		}
	});

	it('still blinks', () => {
		const c = createCharacter();
		const eye = new Color('#3a2e28');
		/**
		 * How tall my eyes are drawn, from top to bottom.
		 * @returns Their height.
		 */
		const eyeHeight = (): number => {
			c.root.updateMatrixWorld(true);
			let lowest = Infinity;
			let highest = -Infinity;
			const vertex = new Vector3();
			for (const mesh of meshesOf(c.root)) {
				if (!(mesh instanceof SkinnedMesh)) {
					continue;
				}
				const geometry: unknown = mesh.geometry;
				const color: unknown =
					geometry instanceof BufferGeometry
						? geometry.getAttribute('color')
						: undefined;
				if (!(color instanceof BufferAttribute)) {
					continue;
				}
				for (let i = 0; i < color.count; i++) {
					const isEye =
						Math.abs(color.getX(i) - eye.r) < 1e-4 &&
						Math.abs(color.getY(i) - eye.g) < 1e-4 &&
						Math.abs(color.getZ(i) - eye.b) < 1e-4;
					if (!isEye) {
						continue;
					}
					mesh.getVertexPosition(i, vertex).applyMatrix4(
						mesh.matrixWorld,
					);
					lowest = Math.min(lowest, vertex.y);
					highest = Math.max(highest, vertex.y);
				}
			}
			return highest - lowest;
		};
		const open = eyeHeight();
		expect(open).toBeGreaterThan(0.02);
		for (const eye of c.eyes) {
			eye.scale.y = 0.15;
		}
		c.keepUp();
		expect(eyeHeight()).toBeCloseTo(open * 0.15, 4);
	});

	it("draws me just as I am unmerged, however I'm posed", () => {
		const merged = createCharacter();
		const plain = createCharacter();
		plain.unmerge();
		pose(merged);
		pose(plain);
		merged.keepUp();
		const [count, ...rest] = drawn(plain);
		const [mergedCount, ...mergedRest] = drawn(merged);
		expect(mergedCount).toBe(count);
		for (const [i, value] of rest.entries()) {
			expect(mergedRest[i]).toBeCloseTo(value, 2);
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
