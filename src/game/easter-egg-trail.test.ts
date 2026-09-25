// Some easter eggs paint their textures on a canvas, so these need a DOM.
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import {
	EASTER_EGG_SPACING,
	EasterEggTrail,
	type PlacedEasterEgg,
} from './easter-egg-trail';
import { TREE_WINDOW } from './forest';
import { Player } from './player';

const player = (): Player =>
	new Player({
		onRolling: () => {
			// Not needed here.
		},
		onMove: () => {
			// Not needed here.
		},
	});

const setup = (canSmash = true) => {
	const me = player();
	const smashed: PlacedEasterEgg[] = [];
	const trail = new EasterEggTrail(me, {
		canSmash: () => canSmash,
		onSmash: (placed) => {
			smashed.push(placed);
		},
	});
	const [first] = trail.eggs;
	return { me, trail, smashed, first };
};

describe('EasterEggTrail', () => {
	it('plans the first easter egg down the slope, in its own clearing', () => {
		const { trail, first } = setup();
		expect(first.z).toBeLessThan(-EASTER_EGG_SPACING + 25);
		expect(first.z).toBeGreaterThan(-EASTER_EGG_SPACING - 25);
		expect(trail.isInClearing(first.x, first.z)).toBe(true);
		const edge = first.z + first.egg.clearingRadius + 5;
		expect(trail.isInClearing(first.x, edge)).toBe(false);
		expect(trail.isInClearing(first.x, edge, 10)).toBe(true);
	});

	it('keeps planning easter eggs ahead of me as I roll', () => {
		const { me, trail } = setup();
		for (let z = 0; z > -1000; z -= 50) {
			me.position.z = z;
			trail.update(1 / 60, 10);
		}
		const last = trail.eggs.at(-1);
		expect(last?.z).toBeLessThan(me.position.z - TREE_WINDOW - 60);
	});

	it('brings easter eggs to life as I near them, and clears them once passed', () => {
		const { me, trail, first } = setup();
		me.position.set(40, 0, first.z + 100);
		trail.update(1 / 60, 10);
		const object = first.instance?.object;
		expect(object?.parent).toBe(trail.group);
		me.position.z = first.z - 50;
		trail.update(1 / 60, 10);
		expect(trail.eggs).not.toContain(first);
		expect(object?.parent).toBeNull();
	});

	it('smashes an easter egg I roll into, once', () => {
		const { me, trail, smashed, first } = setup();
		me.position.set(first.x, 0, first.z);
		trail.update(1 / 60, 10);
		trail.update(1 / 60, 10);
		expect(smashed).toEqual([first]);
		expect(first.isSmashed).toBe(true);
		expect(first.instance?.object.parent).toBeNull();
	});

	it("doesn't smash anything when it can't (like during the intro)", () => {
		const { me, trail, smashed, first } = setup(false);
		me.position.set(first.x, 0, first.z);
		trail.update(1 / 60, 10);
		expect(smashed).toEqual([]);
		expect(first.isSmashed).toBe(false);
	});
});
