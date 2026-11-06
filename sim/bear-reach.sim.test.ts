// Simulations of the game, for tuning it: `pnpm sim`. They play the game's
// own classes for minutes at a time, so they aren't part of `pnpm test` or CI,
// and write what they find to sim/out/. The bears' "!" is drawn on a canvas.
// @vitest-environment happy-dom
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { MathUtils, Object3D, Vector3 } from 'three';
import { expect, it } from 'vitest';

import { type BearActor, Bears } from '../src/game/bears';
import { bearChance } from '../src/game/difficulty';
import type { Tree } from '../src/game/forest';
import { Player, TURN_END } from '../src/game/player';
import { LANE_HALF_WIDTH, terrainHeight } from '../src/game/world';

// How likely a bear up a tree in the lane is to catch me, by where I am
// across the lane: in the middle, near an edge, or hugging one. It plays the
// game's own Player and Bears, one bear at a time, with no other trees in the
// way, and me either holding a line or swerving away once the bear charges.
// For each place I hold and each place a tree stands, a few passes, with the
// trees' sizes (and so the bears' climbs) left to chance.

const dt = 1 / 60;
const trials = Number(process.env.SIM_TRIALS ?? 4);
const outDirectory = path.resolve(import.meta.dirname, 'out');

// Where I hold a line: one half of the lane is enough, as the other mirrors it.
const lines = Array.from({ length: 17 }, (_, i) => i * 1.5);
// Where trees stand. Beyond this from me, no bear ever got me.
const treeStep = 0.5;
const farthest = 12;
const trees = Array.from(
	{ length: (LANE_HALF_WIDTH * 2) / treeStep + 1 },
	(_, i) => i * treeStep - LANE_HALF_WIDTH,
);
// Early, mid-run, and once everything's as fast as it gets.
const distances = [150, 450, 900];
// Slowing down, rolling, speeding up.
const pushes = [-1, 0, 1];

interface Behaviour {
	name: string;
	// Seconds after a bear starts charging that I swerve, or none to hold my
	// line regardless.
	reaction?: number;
}

const behaviours: Behaviour[] = [
	{ name: 'holding a line' },
	{ name: 'swerving after 0.5 s', reaction: 0.5 },
	{ name: 'swerving after 0.8 s', reaction: 0.8 },
];

/**
 * A tree for a bear to climb.
 * @param x - Across the slope.
 * @param z - Down the slope.
 * @returns The tree.
 */
const treeAt = (x: number, z: number): Tree<BearActor> => {
	const body = new Object3D();
	body.position.set(x, terrainHeight(x, z) - 0.15, z);
	body.scale.setScalar(MathUtils.randFloat(0.75, 1.25));
	return {
		body,
		kind: 0,
		slot: 0,
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
 * Me and the bears, rolling, with my distance down the mountain held still so
 * my speed and theirs stay as they are there.
 */
class Run {
	private readonly _player = new Player({
		onRolling: () => {
			// Not needed here.
		},
		onMove: () => {
			// Not needed here.
		},
	});
	private _time = TURN_END - dt;
	// The bears that got me, this pass.
	private readonly _caught = new Set<BearActor>();
	private readonly _bears = new Bears(this._player, {
		isCaught: () => false,
		onCatch: (bear) => {
			this._caught.add(bear);
		},
		onSpot: () => {
			// Not needed here.
		},
		isInTheWay: () => false,
	});
	private readonly _distance: number;
	private readonly _push: number;

	/**
	 * @param distance - How far down the mountain I am, in metres.
	 * @param push - How hard I'm speeding up (1) or slowing down (-1).
	 */
	public constructor(distance: number, push: number) {
		this._distance = distance;
		this._push = push;
	}

	private step(turn: number): void {
		// The player keeps its distance to itself. Holding it still keeps my
		// speed, and the bears', as they are this far down.
		Reflect.set(this._player, '_distance', this._distance);
		if (this._player.distance !== this._distance) {
			throw new Error(
				'Player no longer keeps its distance in _distance.',
			);
		}
		this._time += dt;
		this._player.update(dt, this._time, { turn, push: this._push }, false);
		this._bears.update(dt, this._time);
	}

	private steerTo(line: number): number {
		const { x } = this._player.position;
		return MathUtils.clamp(
			(line - x) * 0.5 - this._player.lateral * 0.15,
			-1,
			1,
		);
	}

	/**
	 * Settles onto a line, then rolls past one bear up a tree.
	 * @param line - Where I hold across the slope.
	 * @param x - Where the tree is across the slope.
	 * @param reaction - When I swerve once it charges, if I do.
	 * @returns Whether the bear got me.
	 */
	public pass(line: number, x: number, reaction?: number): boolean {
		for (let i = 0; i < 300; i++) {
			this.step(this.steerTo(line));
		}
		const ahead = this._player.speed * 3.2 + 25;
		const bear = this._bears.climb(
			treeAt(x, this._player.position.z - ahead),
		);
		if (!bear) {
			throw new Error('No bear to climb the tree.');
		}
		this._caught.clear();
		let charging = 0;
		let swerve = 0;
		for (let i = 0; i < 60 * 30; i++) {
			let turn = this.steerTo(line);
			if (reaction !== undefined && bear.state === 'charging') {
				charging += dt;
				if (charging >= reaction) {
					const me = this._player.position.x;
					// Away from it, even towards the edge: cutting back past it
					// gets me caught more.
					swerve ||=
						Math.sign(me - bear.rig.root.position.x) ||
						-Math.sign(me) ||
						1;
					turn = swerve;
				}
			}
			this.step(turn);
			if (
				this._caught.has(bear) ||
				bear.state === 'free' ||
				bear.state === 'leaving'
			) {
				break;
			}
		}
		this._bears.release(bear);
		return this._caught.has(bear);
	}
}

/**
 * How often a bear up each tree got me, holding each line.
 * @param behaviour - How I ride.
 * @param distance - How far down the mountain.
 * @param push - Speeding up or slowing down.
 * @returns For each line, for each tree, the share of passes I was caught.
 */
const catches = (
	behaviour: Behaviour,
	distance: number,
	push: number,
): number[][] => {
	const run = new Run(distance, push);
	return lines.map((line) =>
		trees.map((x) => {
			if (Math.abs(x - line) > farthest) {
				return 0;
			}
			let caught = 0;
			for (let i = 0; i < trials; i++) {
				if (run.pass(line, x, behaviour.reaction)) {
					caught++;
				}
			}
			return caught / trials;
		}),
	);
};

/**
 * How likely a bear is to catch me, holding each line, for bears placed
 * across the lane by `weight`.
 * @param caught - From `catches`.
 * @param weight - How likely a tree at x is to have a bear, against the
 * middle of the lane.
 * @returns For each line, the catches per pass for each bear the lane would
 * have with bears equally likely across it, as a percentage.
 */
const perBear = (caught: number[][], weight: (x: number) => number): number[] =>
	caught.map(
		(row) =>
			(row.reduce((sum, c, i) => sum + c * weight(trees[i] ?? 0), 0) /
				trees.length) *
			100,
	);

const shown = [0, 12, 18, 21, 22.5, 24];

/**
 * A row of the report's table.
 * @param cells - The row's cells.
 * @returns The row, in Markdown.
 */
const tableRow = (cells: string[]): string => `| ${cells.join(' | ')} |`;

it(
	'measures how far bears reach, across the lane',
	{ timeout: 60 * 60 * 1000 },
	() => {
		const sections: string[] = [
			'# How likely a bear is to catch me, by where I am across the lane',
			'',
			`How often, in %, a bear catches me as I roll past, for each bear the lane would have with bears equally likely across it, holding a line this many metres from the middle (${String(LANE_HALF_WIDTH)} is the edge). "Even" has bears equally likely across the lane; "now" is \`bearChance\` as it is. ${String(trials)} passes a tree and line, from \`pnpm sim\`.`,
		];
		const results: Record<string, unknown> = {};
		for (const behaviour of behaviours) {
			sections.push(
				'',
				`## ${behaviour.name}`,
				'',
				tableRow([
					'Down the mountain',
					'Speed',
					'Bears',
					...shown.map((x) => `${String(x)} m`),
				]),
				tableRow(['---', '---', '---', ...shown.map(() => '---:')]),
			);
			for (const distance of distances) {
				for (const push of pushes) {
					const caught = catches(behaviour, distance, push);
					results[
						`${behaviour.name}, ${String(distance)} m, ${String(push)}`
					] = caught;
					const middle = bearChance(distance, 0);
					const placements: [string, (x: number) => number][] = [
						['even', () => 1],
						['now', (x) => bearChance(distance, x) / middle],
					];
					for (const [placement, weight] of placements) {
						const chance = perBear(caught, weight);
						sections.push(
							tableRow([
								`${String(distance)} m`,
								['slowing', 'rolling', 'speeding'][push + 1] ??
									'',
								placement,
								...shown.map((x) =>
									(chance[lines.indexOf(x)] ?? 0).toFixed(1),
								),
							]),
						);
					}
				}
			}
		}
		mkdirSync(outDirectory, { recursive: true });
		writeFileSync(
			path.join(outDirectory, 'bear-reach.md'),
			`${sections.join('\n')}\n`,
		);
		writeFileSync(
			path.join(outDirectory, 'bear-reach.json'),
			JSON.stringify({ lines, trees, trials, results }),
		);
		console.log(sections.join('\n'));
		expect(Object.keys(results)).toHaveLength(
			behaviours.length * distances.length * pushes.length,
		);
	},
);
