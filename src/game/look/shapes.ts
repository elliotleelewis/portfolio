import { BoxGeometry, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// How round a box's edges are, as a share of its thinnest side.
const bevelShare = 0.18;
// The roundest edge, in metres: big boxes (a car, a hut) stay boxy.
const maxBevel = 0.04;
// Below this an edge is too small to see rounded, so it isn't, which saves
// its triangles (a key, a tooth, a sheet of paper).
const minBevel = 0.004;

/**
 * Creates a box with softly rounded edges, so it catches the light along
 * them like something made, not a primitive. A box too small for that to
 * show stays sharp.
 * @param width - Its width (x), in metres.
 * @param height - Its height (y).
 * @param depth - Its depth (z).
 * @returns The geometry.
 */
export const roundedBox = (
	width: number,
	height: number,
	depth: number,
): BufferGeometry => {
	const radius = Math.min(
		maxBevel,
		Math.min(width, height, depth) * bevelShare,
	);
	// One step of rounding: its normals bend smoothly round the edge, which is
	// what catches the light, for a few more triangles than a sharp box.
	return radius < minBevel
		? new BoxGeometry(width, height, depth)
		: new RoundedBoxGeometry(width, height, depth, 1, radius);
};
