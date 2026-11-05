import type { BufferGeometry } from 'three';

import { at, block } from './paper';

// How far a box's edges are folded in, as a share of its thinnest side.
const bevelShare = 0.18;
// The deepest fold, in metres: big boxes (a car, a hut) stay boxy.
const maxBevel = 0.04;
// Below this a fold is too small to see, so a box isn't folded, which saves
// its triangles (a key, a tooth, a sheet of paper).
const minBevel = 0.004;

/**
 * Creates a box with its edges folded once, like folded paper (models/
 * README.md, "The style"), so they catch the light along a facet. A box too
 * small for that to show stays sharp.
 * @param width - Its width (x), in metres.
 * @param height - Its height (y).
 * @param depth - Its depth (z).
 * @returns The geometry.
 */
export const foldedBox = (
	width: number,
	height: number,
	depth: number,
): BufferGeometry => {
	const bevel = Math.min(
		maxBevel,
		Math.min(width, height, depth) * bevelShare,
	);
	return block(
		at(0, 0, 0),
		[width, depth, height],
		bevel < minBevel ? 0 : bevel,
	);
};
