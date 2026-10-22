// The bears' alert badge and some easter eggs are painted on a canvas, so
// these need a DOM.
// @vitest-environment happy-dom
import {
	BufferAttribute,
	BufferGeometry,
	Color,
	Group,
	InstancedMesh,
	Mesh,
	MeshLambertMaterial,
	Object3D,
	Points,
	Sprite,
	Vector3,
} from 'three';
import { afterAll, describe, expect, it } from 'vitest';

import { type BearActor, Bears, MAX_BEARS } from './bears';
import { createCharacter } from './character';
import { ChaseCamera } from './chase-camera';
import type { DrawBudget } from './draw-budget';
import { ALL_EASTER_EGGS, mergeParts } from './easter-eggs';
import { Effects } from './effects';
import { Forest, type Tree } from './forest';
import { createGalleryGround, createGalleryTrees } from './gallery-scenery';
import { Player } from './player';
import { isBlockingChaseView } from './view';
import {
	CHUNK_LENGTH,
	GROUND_CHUNKS,
	createGroundChunk,
	createLedge,
	createMountains,
	createStars,
	shapeGroundChunk,
} from './world';

interface Cost {
	// Draw calls, counting a shadow caster twice: once for the picture and
	// once for the sun's shadow map.
	draws: number;
	// Triangles drawn, counted the same way.
	triangles: number;
}

// The most each part of the game can cost to draw, at its worst. On a
// phone draw calls run out long before triangles do. Everything drawn is
// under one of these (the end-to-end tests check), so nothing new can be
// drawn without one. Raising a budget is fine, but do it on purpose: see
// "The drawing budget" in the README.
const budgets: Record<DrawBudget, Cost> = {
	me: { draws: 8, triangles: 10_000 },
	// However many bears are out.
	bears: { draws: 12, triangles: 125_000 },
	// Two for each bear after me, its "!" and the one pinned to the edge of
	// the view, with every bear after me at once.
	'bear alerts': { draws: 2 * MAX_BEARS, triangles: 0 },
	// Each easter egg, as it plays and once it's smashed.
	'easter egg': { draws: 60, triangles: 20_000 },
	// Every tree there is, with four fading out of the camera's way.
	trees: { draws: 16, triangles: 55_000 },
	ground: { draws: 6, triangles: 15_000 },
	horizon: { draws: 2, triangles: 20_000 },
	effects: { draws: 4, triangles: 2500 },
	'gallery scenery': { draws: 8, triangles: 65_000 },
};

/**
 * Which budget something counts against: the nearest one marked on it or
 * above it.
 * @param object - The thing.
 * @param root - Where to stop looking.
 * @returns Its budget, if one's marked.
 */
const budgetOf = (object: Object3D, root: Object3D): unknown => {
	for (let node: Object3D | null = object; node; node = node.parent) {
		const budget: unknown = node.userData.drawBudget;
		if (budget !== undefined || node === root) {
			return budget;
		}
	}
	return undefined;
};

/**
 * What an object costs to draw, as the renderer would count it with
 * everything in view: everything under it that counts against this budget,
 * or against none.
 * @param root - The object.
 * @param budget - The budget.
 * @returns Its draw calls and triangles.
 */
const costOf = (root: Object3D, budget: DrawBudget): Cost => {
	const cost: Cost = { draws: 0, triangles: 0 };
	root.traverseVisible((child) => {
		const counted = budgetOf(child, root);
		if (counted !== undefined && counted !== budget) {
			return;
		}
		if (child instanceof Points || child instanceof Sprite) {
			cost.draws++;
			return;
		}
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
		const material: unknown = child.material;
		const passes = child.castShadow ? 2 : 1;
		const groups = Array.isArray(material) ? material.length : 1;
		const instances = child instanceof InstancedMesh ? child.count : 1;
		const vertices = geometry.index?.count ?? position.count;
		cost.draws += passes * groups;
		cost.triangles += (passes * instances * vertices) / 3;
	});
	return cost;
};

/**
 * Adds up what several things cost to draw.
 * @param costs - What each costs.
 * @returns What they cost together.
 */
const total = (...costs: Cost[]): Cost => ({
	draws: costs.reduce((sum, { draws }) => sum + draws, 0),
	triangles: costs.reduce((sum, { triangles }) => sum + triangles, 0),
});

// The budgets checked so far, so the last test can check none were missed.
const checked = new Set<DrawBudget>();

/**
 * Checks a part costs no more than its budget.
 * @param budget - The part's budget.
 * @param cost - What it costs.
 */
const expectWithin = (budget: DrawBudget, cost: Cost): void => {
	checked.add(budget);
	expect(cost.draws).toBeLessThanOrEqual(budgets[budget].draws);
	expect(cost.triangles).toBeLessThanOrEqual(budgets[budget].triangles);
};

/**
 * The bears, with every bear there can be up its own tree.
 * @returns The bears.
 */
const allTheBears = (): Bears => {
	const bears = new Bears(
		new Player({
			onRolling: () => {
				// Not needed here.
			},
			onMove: () => {
				// Not needed here.
			},
		}),
		{
			isCaught: () => false,
			onCatch: () => {
				// Not needed here.
			},
			isInTheWay: () => false,
		},
	);
	for (let i = 0; i < MAX_BEARS; i++) {
		const body = new Object3D();
		body.position.set(0, 0, -100 - i * 10);
		const tree: Tree<BearActor> = {
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
		bears.climb(tree);
	}
	return bears;
};

/**
 * Plays an easter egg as I roll up to it from 60m out, and on past.
 * @param update - Moves it on a step.
 * @param onStep - Called after each step.
 */
const approach = (
	update: (frame: { time: number; dt: number; player: Vector3 }) => void,
	onStep: () => void,
): void => {
	const dt = 1 / 30;
	for (let i = 0; i < 300; i++) {
		const time = i * dt;
		update({ time, dt, player: new Vector3(0.5, 0, 60 - time * 12) });
		onStep();
	}
};

describe('drawing budget', () => {
	it('keeps me within mine', () => {
		expectWithin('me', costOf(createCharacter().root, 'me'));
	});

	it('keeps the bears within theirs, however many are out', () => {
		const bears = allTheBears();
		bears.draw();
		expectWithin('bears', costOf(bears.group, 'bears'));
		bears.dispose();
	});

	it("keeps the bears' alerts within theirs, with every bear after me", () => {
		const bears = allTheBears();
		// Each with its "!" up, and pinned to the edge of the view too.
		for (const { rig, pin } of bears.actors) {
			rig.alert.visible = true;
			pin.visible = true;
		}
		bears.draw();
		expectWithin(
			'bear alerts',
			total(
				costOf(bears.group, 'bear alerts'),
				costOf(bears.pins, 'bear alerts'),
			),
		);
		bears.dispose();
	});

	it.each(ALL_EASTER_EGGS)(
		"keeps the $id within an easter egg's, all through its moment",
		(egg) => {
			const instance = mergeParts(egg.create(), egg.clearingRadius);
			const worst = costOf(instance.object, 'easter egg');
			approach(
				(frame) => instance.update?.(frame),
				() => {
					const cost = costOf(instance.object, 'easter egg');
					worst.draws = Math.max(worst.draws, cost.draws);
					worst.triangles = Math.max(worst.triangles, cost.triangles);
				},
			);
			expectWithin('easter egg', worst);
		},
	);

	it.each(ALL_EASTER_EGGS)(
		"keeps the $id within an easter egg's once smashed",
		(egg) => {
			const slope = new Group();
			const instance = mergeParts(egg.create(), egg.clearingRadius);
			slope.add(instance.object);
			approach(
				(frame) => instance.update?.(frame),
				() => {
					// Not needed here.
				},
			);
			const shattered = instance.shatter();
			expectWithin('easter egg', costOf(shattered.object, 'easter egg'));
			shattered.dispose();
		},
	);

	it('keeps the trees within theirs, with some fading out of the way', () => {
		const camera = new ChaseCamera(new Object3D());
		const forest = new Forest({
			isInClearing: () => false,
			isBlockingView: (x, z) =>
				isBlockingChaseView({ x, z }, { x: 0, z: 0 }, camera.offset),
			onPlace: () => {
				// Not needed here.
			},
		});
		forest.plant();
		// Four of them between me and the camera, and the rest well off to
		// the side.
		for (const [i, { body }] of forest.trees.entries()) {
			if (i < 4) {
				body.position
					.copy(camera.offset)
					.multiplyScalar(0.3 + i * 0.15);
			} else {
				body.position.set(40 + (i % 20), 0, -i);
			}
		}
		forest.update(1 / 60, 0);
		expectWithin(
			'trees',
			total(
				costOf(forest.group, 'trees'),
				costOf(forest.framing, 'trees'),
			),
		);
		forest.dispose();
	});

	it('keeps the ground within its', () => {
		const material = new MeshLambertMaterial();
		const ground = new Group();
		ground.add(createLedge(material, 60));
		for (let i = 0; i < GROUND_CHUNKS; i++) {
			const chunk = createGroundChunk(material);
			shapeGroundChunk(chunk, -CHUNK_LENGTH / 2 - i * CHUNK_LENGTH);
			ground.add(chunk);
		}
		expectWithin('ground', costOf(ground, 'ground'));
	});

	it('keeps the horizon within its', () => {
		const horizon = new Group();
		horizon.add(
			createMountains(new Color('#ffffff')),
			createStars(new Color('#ffffff')),
		);
		expectWithin('horizon', costOf(horizon, 'horizon'));
	});

	it('keeps the effects within theirs, mid-smash', () => {
		const effects = new Effects();
		const centre = new Vector3(0, 1, -50);
		effects.explode(centre);
		effects.burst({
			origin: centre,
			count: 40,
			lift: [0, 0],
			spread: { x: 14, z: 14 },
			upward: [4, 12],
			drift: { x: 0, z: 0 },
		});
		effects.update(1 / 60);
		expectWithin('effects', costOf(effects.group, 'effects'));
		effects.dispose();
	});

	it("keeps the gallery's scenery within its", () => {
		const scenery = new Group();
		scenery.add(
			createGalleryGround(ALL_EASTER_EGGS.length),
			createGalleryTrees(ALL_EASTER_EGGS.length),
		);
		expectWithin('gallery scenery', costOf(scenery, 'gallery scenery'));
	});

	afterAll(() => {
		// Every budget has a test.
		expect(checked).toEqual(new Set(Object.keys(budgets)));
	});
});
