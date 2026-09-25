import { describe, expect, it } from 'vitest';

import { isBlockingChaseView } from './view';

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
