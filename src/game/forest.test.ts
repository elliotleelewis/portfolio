import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { Forest, type ForestHooks, TREE_WINDOW, type Tree } from './forest';
import { terrainHeight } from './world';

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
		for (const { mesh } of forest.trees) {
			expect(mesh.position.z).toBeLessThanOrEqual(20);
			expect(mesh.position.z).toBeGreaterThanOrEqual(20 - TREE_WINDOW);
		}
	});

	it('keeps trees out of the easter egg clearings', () => {
		const forest = new Forest<string>(
			hooks({ isInClearing: (x) => Math.abs(x) < 10 }),
		);
		forest.plant();
		for (const { mesh } of forest.trees) {
			expect(Math.abs(mesh.position.x)).toBeGreaterThanOrEqual(10);
		}
	});

	it('moves the trees I have passed on ahead of me', () => {
		const forest = new Forest<string>(hooks());
		forest.plant();
		forest.update(1 / 60, -100);
		for (const { mesh } of forest.trees) {
			expect(mesh.position.z).toBeLessThanOrEqual(-75);
		}
	});

	it('finds the trees I am rolling into', () => {
		const forest = new Forest<string>(hooks());
		forest.plant();
		const [tree] = forest.trees;
		const player = tree.mesh.position.clone();
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
		tree.mesh.position.set(0, terrainHeight(0, -60) - 0.15, -60);
		const player = tree.mesh.position.clone();
		forest.fell(tree, new Vector3(0.3, 0, -1).normalize(), 20);
		for (let i = 0; i < 180; i++) {
			forest.update(1 / 60, player.z);
		}
		const { x, y, z } = tree.mesh.position;
		expect(tree.state).toBe('falling');
		expect(tree.angle).toBeGreaterThan(1);
		expect(y).toBeCloseTo(terrainHeight(x, z) - 0.15, 1);
		expect(forest.hits(player)).not.toContain(tree);
	});

	it('fades out trees in the way of the camera, then stands them back up', () => {
		let isBlocking = true;
		const forest = new Forest<string>(
			hooks({ isBlockingView: () => isBlocking }),
		);
		forest.plant();
		const [tree] = forest.trees;
		for (let i = 0; i < 30; i++) {
			forest.update(1 / 60, 0);
		}
		expect(tree.mesh.visible).toBe(false);
		// Once recycled ahead, it's a fresh, solid tree.
		isBlocking = false;
		forest.update(1 / 60, -1000);
		expect(tree.mesh.visible).toBe(true);
		expect(tree.material.opacity).toBe(1);
	});
});
