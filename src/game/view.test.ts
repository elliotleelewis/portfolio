import { describe, expect, it } from 'vitest';

import { blocksChaseView } from './view';

// The landscape chase camera sits behind and to the right of me (uphill is +z).
const offset = { x: 6.5, z: 6.5 };
const player = { x: 0, z: 0 };

describe('blocksChaseView', () => {
	it('hides a tree on the line between me and the camera', () => {
		expect(blocksChaseView({ x: 3, z: 3 }, player, offset)).toBe(true);
	});

	it('never hides the tree I am about to hit', () => {
		// Regression: these used to vanish for a few frames, then pop back.
		expect(blocksChaseView({ x: 0, z: -1 }, player, offset)).toBe(false);
		expect(blocksChaseView({ x: 0.5, z: 0 }, player, offset)).toBe(false);
		expect(blocksChaseView({ x: 0.8, z: 0.8 }, player, offset)).toBe(false);
	});

	it('leaves trees off to the side alone', () => {
		expect(blocksChaseView({ x: 8, z: -2 }, player, offset)).toBe(false);
	});

	it('leaves trees well behind the camera alone', () => {
		expect(blocksChaseView({ x: 12, z: 12 }, player, offset)).toBe(false);
	});
});
