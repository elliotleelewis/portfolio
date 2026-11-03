import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
	Box3,
	type Object3D,
	PropertyBinding,
	SkinnedMesh,
	Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';

import {
	type Character,
	createCharacter,
	readCharacterModel,
} from './character';

/**
 * How many skinned meshes there are under an object.
 * @param object - The object.
 * @returns How many.
 */
const skinnedCount = (object: Object3D): number => {
	let count = 0;
	object.traverse((child) => {
		if (child instanceof SkinnedMesh) {
			count++;
		}
	});
	return count;
};

/**
 * Strikes a pose: mid-cartwheel, leaning, looking round, arms and legs out.
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
};

/**
 * Where one of my model's bones is.
 * @param c - Me.
 * @param name - The bone.
 * @returns Where it is in the world.
 */
const boneAt = (c: Character, name: string): Vector3 => {
	const bone = c.root.getObjectByName(PropertyBinding.sanitizeNodeName(name));
	if (!bone) {
		throw new Error(`No ${name} bone`);
	}
	return bone.getWorldPosition(new Vector3());
};

describe('createCharacter', () => {
	it('draws me in a few skinned meshes, one for each finish', () => {
		const count = skinnedCount(createCharacter().root);
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThanOrEqual(3);
	});

	it('blinks', () => {
		const c = createCharacter();
		const blinks = (): number[] => {
			const shut: number[] = [];
			c.root.traverse((child) => {
				const index =
					child instanceof SkinnedMesh
						? child.morphTargetDictionary?.blink
						: undefined;
				if (index !== undefined && child instanceof SkinnedMesh) {
					shut.push(child.morphTargetInfluences?.[index] ?? 0);
				}
			});
			return shut;
		};
		c.keepUp();
		expect(blinks().every((shut) => shut === 0)).toBe(true);
		for (const eye of c.eyes) {
			eye.scale.y = 0.15;
		}
		c.keepUp();
		expect(blinks().every((shut) => shut === 1)).toBe(true);
	});

	it("turns my model's bones with my joints, however I'm posed", () => {
		const c = createCharacter();
		pose(c);
		c.keepUp();
		c.root.updateMatrixWorld(true);
		for (const [i, name] of [
			'hand.L',
			'hand.R',
			'foot.L',
			'foot.R',
		].entries()) {
			const marked = c.extremities[i].getWorldPosition(new Vector3());
			expect(marked.distanceTo(boneAt(c, name))).toBeLessThan(1e-4);
		}
	});

	it('has my hands at my sides, and my feet on the ground', () => {
		const c = createCharacter();
		c.root.updateMatrixWorld(true);
		const [leftHand, rightHand, leftFoot, rightFoot] = c.extremities.map(
			(extremity) => extremity.getWorldPosition(new Vector3()),
		);
		// Out past my hips, and below them, as I stand at rest.
		expect(leftHand.x).toBeGreaterThan(0.2);
		expect(rightHand.x).toBeLessThan(-0.2);
		expect(leftHand.y).toBeLessThan(1);
		for (const foot of [leftFoot, rightFoot]) {
			expect(foot.y).toBeGreaterThanOrEqual(0);
			expect(foot.y).toBeLessThan(0.1);
		}
		expect(leftFoot.x).toBeGreaterThan(0);
		expect(rightFoot.x).toBeLessThan(0);
	});

	it('is my height, standing on the ground', () => {
		const c = createCharacter();
		c.root.updateMatrixWorld(true);
		const box = new Box3().setFromObject(c.root, true);
		expect(box.min.y).toBeCloseTo(0, 1);
		expect(box.max.y).toBeGreaterThan(1.75);
		expect(box.max.y).toBeLessThan(2.05);
	});
});

describe('readCharacterModel', () => {
	const model = readFileSync(path.join(import.meta.dirname, 'models/me.glb'));

	it("turns down a model that's missing a bone the game turns", async () => {
		// The bone renamed, in the model's JSON, without touching the rest.
		const broken = Buffer.from(model);
		broken.write('"arm.X"', broken.indexOf('"arm.L"'));
		await expect(
			readCharacterModel(
				broken.buffer.slice(
					broken.byteOffset,
					broken.byteOffset + broken.byteLength,
				),
			),
		).rejects.toThrow('no "arm.L" bone');
	});
});
