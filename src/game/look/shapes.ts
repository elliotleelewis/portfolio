import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	CatmullRomCurve3,
	LatheGeometry,
	Vector2,
	Vector3,
} from 'three';
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
 * @param round - How round its edges are, in metres, for something soft
 * (a backpack) rather than made.
 * @returns The geometry.
 */
export const roundedBox = (
	width: number,
	height: number,
	depth: number,
	round?: number,
): BufferGeometry => {
	const radius =
		round ??
		Math.min(maxBevel, Math.min(width, height, depth) * bevelShare);
	// One step of rounding (two for something soft): its normals bend smoothly
	// round the edge, which is what catches the light, for a few more
	// triangles than a sharp box.
	return radius < minBevel
		? new BoxGeometry(width, height, depth)
		: new RoundedBoxGeometry(
				width,
				height,
				depth,
				round === undefined ? 1 : 2,
				radius,
			);
};

/**
 * A point along a {@link sweep}: where it passes, and how thick it is there.
 */
export interface SweepPoint {
	at: readonly [number, number, number];
	radius: number;
}

/**
 * Creates a smooth tube along a curve through points, thicker or thinner
 * at each, with rounded ends: a limb, a strap, a lock of hair. Like the
 * other shapes, it merges with them (`mergeParts`).
 * @param points - Where it passes, from one end to the other.
 * @param options - How finely it's made.
 * @param options.sides - How many sides round it.
 * @param options.steps - How many rings between each pair of points.
 * @param options.flatten - How much flatter it is one way than the other
 * (a strap, a lock of hair), from 1 (round).
 * @returns The geometry.
 */
export const sweep = (
	points: readonly SweepPoint[],
	{ sides = 10, steps = 3, flatten = 1 } = {},
): BufferGeometry => {
	const curve = new CatmullRomCurve3(
		points.map(({ at }) => new Vector3(...at)),
		false,
		'centripetal',
	);
	const rings = (points.length - 1) * steps;
	const frames = curve.computeFrenetFrames(rings, false);
	const radiusAt = (u: number): number => {
		const t = curve.getUtoTmapping(u, 0) * (points.length - 1);
		const i = Math.min(Math.floor(t), points.length - 2);
		const from = points[i]?.radius ?? 0;
		const to = points[i + 1]?.radius ?? from;
		return from + (to - from) * (t - i);
	};
	const positions: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	const centre = new Vector3();
	const out = new Vector3();
	for (let i = 0; i <= rings; i++) {
		const u = i / rings;
		curve.getPointAt(u, centre);
		const radius = radiusAt(u);
		const normal = frames.normals[i] ?? new Vector3(1, 0, 0);
		const binormal = frames.binormals[i] ?? new Vector3(0, 0, 1);
		for (let j = 0; j < sides; j++) {
			const angle = (j / sides) * Math.PI * 2;
			out.copy(centre)
				.addScaledVector(normal, Math.cos(angle) * radius)
				.addScaledVector(
					binormal,
					(Math.sin(angle) * radius) / flatten,
				);
			positions.push(out.x, out.y, out.z);
			uvs.push(j / sides, u);
		}
	}
	for (let i = 0; i < rings; i++) {
		for (let j = 0; j < sides; j++) {
			const a = i * sides + j;
			const b = i * sides + ((j + 1) % sides);
			const c = a + sides;
			const d = b + sides;
			indices.push(a, b, c, b, d, c);
		}
	}
	// Each end rounded off to a point just past it, a little way along.
	for (const [ring, direction] of [
		[0, -1],
		[rings, 1],
	] as const) {
		const tangent = frames.tangents[ring] ?? new Vector3(0, 1, 0);
		curve.getPointAt(ring / rings, centre);
		out.copy(centre).addScaledVector(
			tangent,
			direction * radiusAt(ring / rings) * 0.7,
		);
		const tip = positions.length / 3;
		positions.push(out.x, out.y, out.z);
		uvs.push(0.5, ring / rings);
		for (let j = 0; j < sides; j++) {
			const a = ring * sides + j;
			const b = ring * sides + ((j + 1) % sides);
			if (direction < 0) {
				indices.push(tip, b, a);
			} else {
				indices.push(tip, a, b);
			}
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute(
		'position',
		new BufferAttribute(new Float32Array(positions), 3),
	);
	geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
};

/**
 * Creates a smooth, round shape from its outline, turned about its upright
 * axis: a head, a torso, a hand. Squashed front to back or side to side,
 * it's oval rather than round.
 * @param outline - Its outline, as how far out it is at each height, from
 * the bottom up: `[radius, height]`.
 * @param options - Its shape.
 * @param options.sides - How many sides round it.
 * @param options.width - How wide it is side to side, as a share of round.
 * @param options.depth - How deep it is front to back, as a share of round.
 * @returns The geometry.
 */
export const lathe = (
	outline: readonly (readonly [number, number])[],
	{ sides = 20, width = 1, depth = 1 } = {},
): BufferGeometry =>
	new LatheGeometry(
		outline.map(([radius, height]) => new Vector2(radius, height)),
		sides,
	).scale(width, 1, depth);
