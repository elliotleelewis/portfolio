import { describe, expect, it } from 'vitest';

import { Player, type PlayerControls, TURN_END } from './player';
import { LANE_HALF_WIDTH, terrainHeight } from './world';

const coast: PlayerControls = { turn: 0, push: 0 };
const dt = 1 / 60;

/**
 * Runs a player from a given time for a while.
 * @param player - The player.
 * @param from - Game time to start at.
 * @param seconds - How long to run.
 * @param controls - How to steer.
 * @param isCaught - Whether a bear has got them.
 * @returns The game time at the end.
 */
const run = (
	player: Player,
	from: number,
	seconds: number,
	controls = coast,
	isCaught = false,
): number => {
	let time = from;
	for (let i = 0; i < Math.round(seconds / dt); i++) {
		time += dt;
		player.update(dt, time, controls, isCaught);
	}
	return time;
};

const noHooks = {
	onRolling: () => {
		// Not needed here.
	},
	onMove: () => {
		// Not needed here.
	},
};

describe('Player', () => {
	it('stays put through the intro, then starts rolling once', () => {
		let rolls = 0;
		const player = new Player({
			...noHooks,
			onRolling: () => {
				rolls++;
			},
		});
		run(player, 0, TURN_END - 0.1);
		expect(player.isRolling).toBe(false);
		expect(player.distance).toBe(0);
		run(player, TURN_END - 0.1, 1);
		expect(player.isRolling).toBe(true);
		expect(rolls).toBe(1);
	});

	it('rolls down the mountain along the ground, reporting each step', () => {
		let moves = 0;
		const player = new Player({
			...noHooks,
			onMove: () => {
				moves++;
			},
		});
		run(player, TURN_END, 3);
		const { x, y, z } = player.position;
		expect(player.distance).toBeGreaterThan(10);
		expect(z).toBeCloseTo(-player.distance);
		expect(y).toBeCloseTo(terrainHeight(x, z));
		expect(moves).toBe(180);
	});

	it('steers, but stays in the lane', () => {
		const player = new Player(noHooks);
		run(player, TURN_END, 1, { turn: 1, push: 0 });
		expect(player.position.x).toBeGreaterThan(1);
		run(player, TURN_END + 1, 20, { turn: 1, push: 0 });
		expect(player.position.x).toBeLessThanOrEqual(LANE_HALF_WIDTH);
	});

	it('speeds up or slows down when pushed', () => {
		const fast = new Player(noHooks);
		const slow = new Player(noHooks);
		run(fast, TURN_END, 4, { turn: 0, push: 1 });
		run(slow, TURN_END, 4, { turn: 0, push: -1 });
		expect(fast.speed).toBeGreaterThan(slow.speed * 1.5);
	});

	it('skids to a stop once caught', () => {
		const player = new Player(noHooks);
		const time = run(player, TURN_END, 3);
		const rollingSpeed = player.speed;
		run(player, time, 3, coast, true);
		expect(player.speed).toBeLessThan(rollingSpeed * 0.01);
	});
});
