// The bears' alert badge and some easter eggs are painted on a canvas, so
// these need a DOM.
// @vitest-environment happy-dom
import {
	BufferAttribute,
	BufferGeometry,
	InstancedMesh,
	Mesh,
	type Object3D,
	Points,
	Sprite,
	Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';

import { createBear, createBearParts } from './bear';
import { createCharacter } from './character';
import { ALL_EASTER_EGGS, mergeStill } from './easter-eggs';

interface Cost {
	// Draw calls, counting a shadow caster twice: once for the picture and
	// once for the sun's shadow map.
	draws: number;
	// Triangles drawn, counted the same way.
	triangles: number;
}

// The most each part can cost to draw. A frame holds me, several bears and
// one or two easter eggs at once, and on a phone draw calls run out long
// before triangles do. Raising a budget is fine, but do it on purpose: see
// "The drawing budget" in the README.
const characterBudget: Cost = { draws: 40, triangles: 10_000 };
const bearBudget: Cost = { draws: 20, triangles: 6000 };
const easterEggBudget: Cost = { draws: 90, triangles: 20_000 };

/**
 * What an object costs to draw, as the renderer would count it with
 * everything in view.
 * @param root - The object.
 * @returns Its draw calls and triangles.
 */
const costOf = (root: Object3D): Cost => {
	const cost: Cost = { draws: 0, triangles: 0 };
	root.traverseVisible((child) => {
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

describe('drawing budget', () => {
	it('keeps me within mine', () => {
		const cost = costOf(createCharacter().root);
		expect(cost.draws).toBeLessThanOrEqual(characterBudget.draws);
		expect(cost.triangles).toBeLessThanOrEqual(characterBudget.triangles);
	});

	it('keeps each bear within theirs', () => {
		const cost = costOf(createBear(createBearParts()).root);
		expect(cost.draws).toBeLessThanOrEqual(bearBudget.draws);
		expect(cost.triangles).toBeLessThanOrEqual(bearBudget.triangles);
	});

	it.each(ALL_EASTER_EGGS)(
		"keeps the $id within an easter egg's, all through its moment",
		(egg) => {
			const instance = mergeStill(egg.create());
			const worst = costOf(instance.object);
			// Rolling up to it from 60m out, and on past.
			const dt = 1 / 30;
			for (let i = 0; i < 300; i++) {
				const time = i * dt;
				const player = new Vector3(0.5, 0, 60 - time * 12);
				instance.update?.({ time, dt, player });
				const cost = costOf(instance.object);
				worst.draws = Math.max(worst.draws, cost.draws);
				worst.triangles = Math.max(worst.triangles, cost.triangles);
			}
			expect(worst.draws).toBeLessThanOrEqual(easterEggBudget.draws);
			expect(worst.triangles).toBeLessThanOrEqual(
				easterEggBudget.triangles,
			);
		},
	);
});
