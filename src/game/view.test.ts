import { describe, expect, it } from 'vitest';

import { isBlockingChaseView, isInChaseCameraWay } from './view';

// The landscape chase camera sits behind and to the right of me (uphill is +z).
const offset = { x: 6.5, z: 6.5 };
const player = { x: 0, z: 0 };

describe('isBlockingChaseView', () => {
	it('hides a tree on the line between me and the camera', () => {
		expect(isBlockingChaseView({ x: 3, z: 3 }, player, offset)).toBe(true);
	});

	it('never hides the tree I am about to hit', () => {
		// Regression: these used to vanish for a few frames, then pop back.
		expect(isBlockingChaseView({ x: 0, z: -1 }, player, offset)).toBe(
			false,
		);
		expect(isBlockingChaseView({ x: 0.5, z: 0 }, player, offset)).toBe(
			false,
		);
		expect(isBlockingChaseView({ x: 0.8, z: 0.8 }, player, offset)).toBe(
			false,
		);
	});

	it('leaves trees off to the side alone', () => {
		expect(isBlockingChaseView({ x: 8, z: -2 }, player, offset)).toBe(
			false,
		);
	});

	it('leaves trees well behind the camera alone', () => {
		expect(isBlockingChaseView({ x: 12, z: 12 }, player, offset)).toBe(
			false,
		);
	});
});

describe('isInChaseCameraWay', () => {
	const player = { x: 0, z: 0 };
	const offset = { x: 6.5, z: 6.5 };

	it('counts anything blocking the view of me', () => {
		expect(isInChaseCameraWay({ x: 3.25, z: 3.25 }, player, offset)).toBe(
			true,
		);
	});

	it('counts anything right up by the camera, even off to one side', () => {
		expect(isInChaseCameraWay({ x: 9, z: 5 }, player, offset)).toBe(true);
	});

	it('leaves alone anything well clear of the camera', () => {
		expect(isInChaseCameraWay({ x: -6, z: 6 }, player, offset)).toBe(false);
		expect(isInChaseCameraWay({ x: 0, z: -10 }, player, offset)).toBe(
			false,
		);
	});
});
