// The bears' alert badge is drawn on a canvas, so these need a DOM.
// @vitest-environment happy-dom
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { type BearActor, Bears, MAX_BEARS } from './bears';
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

const setup = (isInTheWay: (x: number, z: number) => boolean = () => false) => {
	const { player, time } = rollingPlayer();
	const catches: BearActor[] = [];
	const bears = new Bears(player, {
		isCaught: () => catches.length > 0,
		onCatch: (bear) => {
			catches.push(bear);
		},
		isInTheWay,
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
	it('sends a bear up a tree, adding bears until the pool is full', () => {
		const { bears } = setup();
		const trees = Array.from({ length: MAX_BEARS + 1 }, (_value, i) =>
			treeAt(0, -100 - i * 10),
		);
		const climbed = trees.map((tree) => bears.climb(tree));
		expect(climbed.at(0)?.state).toBe('clinging');
		expect(trees[0].occupant).toBe(climbed[0]);
		expect(climbed.at(-2)?.state).toBe('clinging');
		expect(climbed.at(-1)).toBeUndefined();
		expect(bears.actors).toHaveLength(MAX_BEARS);
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

	it('carries on past me once it has missed, rather than turning away', () => {
		const { player, bears, run } = setup();
		const bear = climbOrFail(bears, treeAt(0, player.position.z - 100));
		bear.state = 'charging';
		bear.heading = 0.3;
		bear.rig.root.position.set(0, 0, player.position.z + 4);
		run(dt);
		expect(bear.state).toBe('leaving');
		expect(bear.heading).toBe(0.3);
	});

	it("fades out a bear in the camera's way, then brings it back solid", () => {
		let isInTheWay = false;
		const { player, bears, run } = setup(() => isInTheWay);
		const bear = climbOrFail(bears, treeAt(0, player.position.z - 100));
		bear.state = 'leaving';
		bear.rig.root.position.set(0, 0, player.position.z + 4);
		run(0.1);
		expect(bear.isFading).toBe(false);

		isInTheWay = true;
		run(0.1);
		expect(bear.isFading).toBe(true);
		expect(bear.opacity).toBeLessThan(1);
		expect(bear.materials.every(({ transparent }) => transparent)).toBe(
			true,
		);
		run(0.3);
		expect(bear.state).toBe('free');

		const again = climbOrFail(bears, treeAt(0, player.position.z - 100));
		expect(again).toBe(bear);
		expect(again.opacity).toBe(1);
		expect(again.materials.every(({ transparent }) => !transparent)).toBe(
			true,
		);
	});

	it('never fades a bear that is still after me', () => {
		const { player, bears, run } = setup(() => true);
		const bear = climbOrFail(bears, treeAt(0, player.position.z - 100));
		run(0.5);
		expect(bear.state).toBe('clinging');
		expect(bear.isFading).toBe(false);
	});

	it('pins the "!" of a bear coming down out of shot to the edge of the view', () => {
		const { player, bears, run } = setup();
		const camera = new PerspectiveCamera(48, 16 / 9, 0.05, 1200);
		camera.position.set(0, 3, player.position.z + 8);
		camera.lookAt(0, 0, player.position.z);
		// Off to the right, just ahead of me, so it spots me.
		const bear = climbOrFail(
			bears,
			treeAt(player.position.x + 20, player.position.z - 4),
		);
		run(0.1);
		expect(bear.rig.alert.visible).toBe(true);
		bears.pinAlerts(camera);
		expect(bear.pin.visible).toBe(true);
		const spot = bear.pin.position.clone().project(camera);
		// Just inside the right-hand edge.
		expect(spot.x).toBeCloseTo(1 - 0.1 / camera.aspect, 2);
		expect(Math.abs(spot.y)).toBeLessThan(0.9);
		// As big as the "!" over the bear looks from the camera.
		const distance = bear.rig.alert
			.getWorldPosition(new Vector3())
			.distanceTo(camera.position);
		expect(
			bear.pin.scale.x / bear.pin.position.distanceTo(camera.position),
		).toBeCloseTo(bear.rig.alert.scale.x / distance, 5);

		// Once it's in shot, the "!" over it is enough.
		camera.lookAt(bear.rig.root.position);
		bears.pinAlerts(camera);
		expect(bear.pin.visible).toBe(false);
	});

	it('keeps a pinned "!" for a far-off bear big enough to notice', () => {
		const { player, bears, run } = setup();
		const camera = new PerspectiveCamera(48, 16 / 9, 0.05, 1200);
		camera.position.set(0, 3, player.position.z + 8);
		camera.lookAt(0, 0, player.position.z);
		const near = climbOrFail(
			bears,
			treeAt(player.position.x + 20, player.position.z - 4),
		);
		const far = climbOrFail(
			bears,
			treeAt(player.position.x - 120, player.position.z - 4),
		);
		run(0.1);
		// The far one hasn't spotted me, so show its "!" as if it had.
		far.rig.alert.visible = true;
		bears.pinAlerts(camera);
		expect(near.pin.visible).toBe(true);
		expect(far.pin.visible).toBe(true);
		expect(far.pin.scale.x).toBeLessThan(near.pin.scale.x);
		expect(far.pin.scale.x).toBeCloseTo((0.9 * 2) / 45);
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
