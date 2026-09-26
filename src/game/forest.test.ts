import { InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { Forest, type ForestHooks, TREE_WINDOW, type Tree } from './forest';
import { APPEAR_AHEAD, terrainHeight } from './world';

const hooks = (overrides: Partial<ForestHooks<string>> = {}) => ({
	isInClearing: () => false,
	isBlockingView: () => false,
	onPlace: () => {
		// Nothing up the trees in these tests.
	},
	...overrides,
});

const standing = (forest: Forest<string>): Tree<string>[] =>
	forest.trees.filter(({ state }) => state === 'standing');

describe('Forest', () => {
	it('plants every tree ahead of me, telling the game about each', () => {
		const placed: Tree<string>[] = [];
		const forest = new Forest<string>(
			hooks({
				onPlace: (tree) => {
					placed.push(tree);
				},
			}),
		);
		forest.plant();
		expect(placed).toHaveLength(forest.trees.length);
		for (const { body } of forest.trees) {
			expect(body.position.z).toBeLessThanOrEqual(20);
			expect(body.position.z).toBeGreaterThanOrEqual(20 - TREE_WINDOW);
		}
	});

	it('keeps trees out of the easter egg clearings', () => {
		const forest = new Forest<string>(
			hooks({ isInClearing: (x) => Math.abs(x) < 10 }),
		);
		forest.plant();
		for (const { body } of forest.trees) {
			expect(Math.abs(body.position.x)).toBeGreaterThanOrEqual(10);
		}
	});

	it('moves the trees I have passed on ahead of me', () => {
		const forest = new Forest<string>(hooks());
		forest.plant();
		forest.update(1 / 60, -100);
		for (const { body } of forest.trees) {
			expect(body.position.z).toBeLessThanOrEqual(-75);
		}
	});

	it('replants passed trees out of sight, in the haze', () => {
		const forest = new Forest<string>(hooks());
		forest.plant();
		let replanted = 0;
		// Roll down the slope a little at a time, as the game does.
		for (let playerZ = 0; playerZ > -200; playerZ -= 0.5) {
			const before = forest.trees.map(({ body }) => body.position.z);
			forest.update(1 / 60, playerZ);
			for (const [i, { body }] of forest.trees.entries()) {
				// Only trees that jumped ahead (not ones barely moving).
				if (body.position.z >= before[i] - 1) {
					continue;
				}
				replanted++;
				expect(playerZ - body.position.z).toBeGreaterThanOrEqual(
					APPEAR_AHEAD - 0.5,
				);
			}
		}
		expect(replanted).toBeGreaterThan(0);
	});

	it('finds the trees I am rolling into', () => {
		const forest = new Forest<string>(hooks());
		forest.plant();
		const [tree] = forest.trees;
		const player = tree.body.position.clone();
		expect(forest.hits(player)).toContain(tree);
		expect(forest.hits(player.clone().setX(player.x + 50))).not.toContain(
			tree,
		);
	});

	it('topples a tree onto the ground, and stops finding it as a hit', () => {
		const forest = new Forest<string>(hooks());
		forest.plant();
		const [tree] = standing(forest);
		// Somewhere known in the lane, clear of the rocky banks either side.
		tree.body.position.set(0, terrainHeight(0, -60) - 0.15, -60);
		const player = tree.body.position.clone();
		forest.fell(tree, new Vector3(0.3, 0, -1).normalize(), 20);
		for (let i = 0; i < 180; i++) {
			forest.update(1 / 60, player.z);
		}
		const { x, y, z } = tree.body.position;
		expect(tree.state).toBe('falling');
		expect(tree.angle).toBeGreaterThan(1);
		expect(y).toBeCloseTo(terrainHeight(x, z) - 0.15, 1);
		expect(forest.hits(player)).not.toContain(tree);
	});

	it('draws every tree of each kind in one go', () => {
		const forest = new Forest<string>(hooks());
		forest.plant();
		const batches = forest.group.children.filter(
			(child): child is InstancedMesh => child instanceof InstancedMesh,
		);
		expect(batches).toHaveLength(3);
		const drawn = batches.reduce((sum, { count }) => sum + count, 0);
		expect(drawn).toBe(forest.trees.length);
		// Each tree is drawn where it stands.
		const [tree] = forest.trees;
		const matrix = new Matrix4();
		batches[tree.kind].getMatrixAt(tree.slot, matrix);
		expect(
			new Vector3()
				.setFromMatrixPosition(matrix)
				.distanceTo(tree.body.position),
		).toBeLessThan(1e-3);
	});

	it('fades out trees in the way of the camera, then stands them back up', () => {
		let isBlocking = true;
		const forest = new Forest<string>(
			hooks({ isBlockingView: () => isBlocking }),
		);
		forest.plant();
		const [tree] = forest.trees;
		const batch = () =>
			forest.group.children.filter(
				(child): child is InstancedMesh =>
					child instanceof InstancedMesh,
			)[tree.kind];
		const scaleInBatch = () => {
			const matrix = new Matrix4();
			batch().getMatrixAt(tree.slot, matrix);
			return new Vector3().setFromMatrixScale(matrix).x;
		};
		// Half-way through fading: out of its batch, drawn see-through on its
		// own instead.
		for (let i = 0; i < 9; i++) {
			forest.update(1 / 60, 0);
		}
		expect(tree.isFading).toBe(true);
		expect(tree.opacity).toBeGreaterThan(0);
		expect(tree.opacity).toBeLessThan(1);
		expect(scaleInBatch()).toBe(0);
		const ghosts = forest.group.children.filter(
			(child) =>
				child instanceof Mesh && !(child instanceof InstancedMesh),
		);
		expect(ghosts).toHaveLength(
			forest.trees.filter((t) => t.isFading).length,
		);
		// Once gone, it's not drawn at all.
		for (let i = 0; i < 30; i++) {
			forest.update(1 / 60, 0);
		}
		expect(tree.opacity).toBe(0);
		expect(scaleInBatch()).toBe(0);
		expect(
			forest.group.children.some(
				(child) =>
					child instanceof Mesh && !(child instanceof InstancedMesh),
			),
		).toBe(false);
		// Once recycled ahead, it's a fresh, solid tree back in its batch.
		isBlocking = false;
		forest.update(1 / 60, -1000);
		expect(tree.isFading).toBe(false);
		expect(tree.opacity).toBe(1);
		expect(scaleInBatch()).toBeGreaterThan(0);
	});
});
