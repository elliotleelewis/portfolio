import {
	BoxGeometry,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	SkinnedMesh,
	Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';

import { mergeParts } from './easter-eggs';
import { Effects } from './effects';

const run = (effects: Effects, seconds: number): void => {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		effects.update(1 / 60);
	}
};

// How big the first bit of debris is drawn (0 once it has gone).
const firstDebrisScale = (effects: Effects): number => {
	const debris = effects.group.children.find(
		(child) => child instanceof InstancedMesh,
	);
	if (!(debris instanceof InstancedMesh)) {
		throw new TypeError('No debris');
	}
	const matrix = new Matrix4();
	debris.getMatrixAt(0, matrix);
	return new Vector3().setFromMatrixScale(matrix).x;
};

describe('Effects', () => {
	it('sends a burst of debris flying, which then fades away', () => {
		const effects = new Effects();
		effects.burst({
			origin: new Vector3(0, 10, -50),
			count: 10,
			lift: [0, 0],
			spread: { x: 8, z: 8 },
			upward: [2, 9],
			drift: { x: 0, z: 0 },
		});
		run(effects, 0.1);
		expect(firstDebrisScale(effects)).toBeGreaterThan(0.9);
		run(effects, 2);
		expect(firstDebrisScale(effects)).toBe(0);
	});

	it('flashes a fireball that burns out', () => {
		const effects = new Effects();
		expect(effects.isExploding).toBe(false);
		effects.explode(new Vector3(0, 10, -50));
		run(effects, 0.3);
		expect(effects.isExploding).toBe(true);
		run(effects, 0.5);
		expect(effects.isExploding).toBe(false);
	});

	it('flings the pieces of something smashed apart, then clears them away', () => {
		const effects = new Effects();
		const slope = new Group();
		const thing = new Group();
		slope.add(thing);
		const box = new BoxGeometry();
		const wood = new MeshStandardMaterial();
		for (const x of [-1, 0, 1]) {
			const piece = new Mesh(box, wood);
			piece.position.set(x, 20, -50);
			thing.add(piece);
		}
		const shattered = mergeParts({ object: thing }).shatter();
		effects.shatter(shattered, new Vector3(0, 19, -50), 20);
		expect(effects.shardCount).toBe(3);
		// Still drawn together.
		const drawn = shattered.object.children.filter(
			(child) => child instanceof Mesh,
		);
		expect(drawn).toHaveLength(1);
		expect(drawn[0]).toBeInstanceOf(SkinnedMesh);
		expect(shattered.object.parent).toBe(effects.group);
		run(effects, 0.2);
		for (const piece of shattered.pieces) {
			expect(piece.position.y).toBeGreaterThan(20);
		}
		run(effects, 3);
		expect(effects.shardCount).toBe(0);
		expect(shattered.object.parent).toBeNull();
	});
});
