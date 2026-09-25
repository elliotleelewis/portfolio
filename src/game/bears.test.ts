// The bears' alert badge is drawn on a canvas, so these need a DOM.
// @vitest-environment happy-dom
import { Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { type BearActor, Bears } from './bears';
import { type Tree } from './forest';
import { Player, TURN_END } from './player';
import { terrainHeight } from './world';

const dt = 1 / 60;

const treeAt = (x: number, z: number): Tree<BearActor> => {
	const mesh = new Mesh();
	mesh.position.set(x, terrainHeight(x, z), z);
	return {
		mesh,
		material: undefined as never,
		isFading: false,
		opacity: 1,
		occupant: undefined,
		state: 'standing',
		yaw: 0,
		axis: new Vector3(),
		angle: 0,
		angularVelocity: 0,
		velocity: new Vector3(),
		hitRadius: 1,
	};
};

/**
 * A player that has finished the intro and is rolling.
 * @returns The player and the game time.
 */
const rollingPlayer = (): { player: Player; time: number } => {
	const player = new Player({
		onRolling: () => {
			// Not needed here.
		},
		onMove: () => {
			// Not needed here.
		},
	});
	let time = TURN_END - dt;
	for (let i = 0; i < 2; i++) {
		time += dt;
		player.update(dt, time, { turn: 0, push: 0 }, false);
	}
	return { player, time };
};

const setup = () => {
	const { player, time } = rollingPlayer();
	const catches: BearActor[] = [];
	const bears = new Bears(player, {
		isCaught: () => catches.length > 0,
		onCatch: (bear) => {
			catches.push(bear);
		},
	});
	const run = (seconds: number): void => {
		for (let i = 0; i < Math.round(seconds / dt); i++) {
			bears.update(dt, time);
		}
	};
	return { player, bears, catches, run };
};

/**
 * Sends a bear up a tree, failing the test if none is free.
 * @param bears - The bears.
 * @param tree - The tree.
 * @returns The bear.
 */
const climbOrFail = (bears: Bears, tree: Tree<BearActor>): BearActor => {
	const bear = bears.climb(tree);
	if (!bear) {
		throw new Error('No free bear');
	}
	return bear;
};

describe('Bears', () => {
	it('sends a bear up a tree, until the pool runs out', () => {
		const { bears } = setup();
		const trees = Array.from(
			{ length: bears.actors.length + 1 },
			(_value, i) => treeAt(0, -100 - i * 10),
		);
		const climbed = trees.map((tree) => bears.climb(tree));
		expect(climbed.at(0)?.state).toBe('clinging');
		expect(trees[0].occupant).toBe(climbed[0]);
		expect(climbed.at(-1)).toBeUndefined();
	});

	it('stays up its tree until I come near', () => {
		const { player, bears, run } = setup();
		const bear = climbOrFail(bears, treeAt(0, player.position.z - 200));
		run(1);
		expect(bear.state).toBe('clinging');
		expect(bears.isTreeBound(bear)).toBe(true);
	});

	it('climbs down, charges and catches me when I come close', () => {
		const { player, bears, catches, run } = setup();
		// Close enough to spot me at the crawl I'm at just after the intro.
		const tree = treeAt(player.position.x + 2, player.position.z - 6);
		const bear = bears.climb(tree);
		run(4);
		expect(catches).toEqual([bear]);
		expect(tree.occupant).toBeUndefined();
	});

	it('gives up on bears I have left behind', () => {
		const { player, bears, run } = setup();
		const bear = bears.climb(treeAt(0, player.position.z + 40));
		run(dt);
		expect(bear?.state).toBe('free');
		expect(bear?.rig.root.visible).toBe(false);
	});

	it('sends the bears near a blast flying, and lands them out cold', () => {
		const { player, bears, run } = setup();
		const near = bears.climb(treeAt(0, player.position.z - 300));
		const far = bears.climb(treeAt(0, player.position.z - 400));
		const blasted = bears.blast({ x: 0, z: player.position.z - 305 }, 20);
		expect(blasted).toBe(1);
		expect(near?.state).toBe('blasted');
		expect(far?.state).toBe('clinging');
		run(3);
		const { x, y, z } = near?.rig.root.position ?? new Vector3();
		expect(y).toBeCloseTo(terrainHeight(x, z) + 0.6);
	});

	it('frees a bear and its tree when released', () => {
		const { player, bears } = setup();
		const tree = treeAt(0, player.position.z - 100);
		const bear = climbOrFail(bears, tree);
		bears.release(bear);
		expect(bear.state).toBe('free');
		expect(tree.occupant).toBeUndefined();
	});
});
