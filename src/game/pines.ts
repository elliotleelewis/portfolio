import {
	BufferAttribute,
	BufferGeometry,
	Color,
	MeshLambertMaterial,
	Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The kinds of pine on the mountain: how many tiers of branches each has,
// how tall it is and how wide its lowest tier.
const kinds = [
	{ tiers: 6, height: 8, radius: 1.5 },
	{ tiers: 5, height: 6.5, radius: 1.7 },
	{ tiers: 8, height: 11, radius: 1.4 },
] as const;

// Each kind's tint, over its painted colours.
const kindTints = ['#ffffff', '#dfe8d4', '#c9d6c2'];

// The tiers' greens, from the bottom up, and the bark.
const greens = ['#2f4f2a', '#3b5d30', '#456a36', '#3e6233'];
const bark = '#5a4230';

// Branch tips round each tier: every other one reaches out and droops.
const tips = 10;
// How far in the short tips are, as a share of the long ones.
const shortReach = 0.72;
// How far the long tips droop, and the short ones lift, as a share of a
// tier's height.
const droop = 0.07;
// How high under a tier its middle is, as a share of its height: the
// underside's hollow, which keeps it in shadow.
const hollow = 0.22;
// How much lighter or darker each part of a tier is than its green: lit
// tips, a shaded inside and a dark underside, painted in so the shading
// costs nothing to draw.
const shade = { top: 1.15, long: 1.05, short: 0.75, under: 0.6, core: 0.4 };
// The trunk's sides, and how far it's sunk into the ground.
const trunkSides = 5;
const trunkSink = 0.3;

/**
 * A tree's own, steady random numbers, so every pine of a kind is the same
 * shape and each tree keeps its tint.
 * @param seed - Which numbers.
 * @returns Numbers from 0 to 1.
 */
const steadyRandom = (seed: number): (() => number) => {
	let state = seed;
	return () => {
		state = (state * 16_807) % 2_147_483_647;
		return (state - 1) / 2_147_483_646;
	};
};

/**
 * Builds triangles into a geometry: each corner's position and colour.
 * @param corners - Each triangle's three corners, in order round it, so it
 * faces the way it's seen from.
 * @returns The geometry.
 */
const triangles = (
	corners: readonly { at: Vector3; color: Color }[],
): BufferGeometry => {
	const positions = new Float32Array(corners.length * 3);
	const colors = new Float32Array(corners.length * 3);
	for (const [i, { at, color }] of corners.entries()) {
		at.toArray(positions, i * 3);
		color.toArray(colors, i * 3);
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(positions, 3));
	geometry.setAttribute('color', new BufferAttribute(colors, 3));
	geometry.computeVertexNormals();
	return geometry;
};

/**
 * A tier of branches: a star of tips round a peak, every other tip reaching
 * out and drooping, over a hollow underside.
 * @param bottom - How high its tips are.
 * @param height - From its tips to its peak.
 * @param radius - How far its long tips reach.
 * @param turn - How far round its tips are turned.
 * @param green - Its colour.
 * @param random - Nudges each tip, so it isn't too even.
 * @returns The tier.
 */
const tier = (
	bottom: number,
	height: number,
	radius: number,
	turn: number,
	green: Color,
	random: () => number,
): BufferGeometry => {
	const peak = new Vector3(0, bottom + height, 0);
	const core = new Vector3(0, bottom + height * hollow, 0);
	const ring = Array.from({ length: tips }, (_value, k) => {
		const isLong = k % 2 === 0;
		const angle = turn + (k / tips) * Math.PI * 2;
		const reach =
			radius * (isLong ? 1 : shortReach) * (0.94 + random() * 0.12);
		return {
			at: new Vector3(
				Math.cos(angle) * reach,
				bottom + height * (isLong ? -droop : droop),
				Math.sin(angle) * reach,
			),
			isLong,
		};
	});
	const tint = (factor: number): Color =>
		green.clone().multiplyScalar(factor);
	const corners = ring.flatMap((tip, k) => {
		const next = ring[(k + 1) % tips] ?? tip;
		const tipShade = (t: typeof tip): number =>
			t.isLong ? shade.long : shade.short;
		return [
			// Its side, seen from outside and above.
			{ at: peak, color: tint(shade.top) },
			{ at: next.at, color: tint(tipShade(next)) },
			{ at: tip.at, color: tint(tipShade(tip)) },
			// Its underside, seen from below.
			{ at: core, color: tint(shade.core) },
			{ at: tip.at, color: tint(shade.under) },
			{ at: next.at, color: tint(shade.under) },
		];
	});
	return triangles(corners);
};

/**
 * A point round the trunk.
 * @param i - Which side it's at the start of.
 * @param radius - How far out.
 * @param y - How high.
 * @returns The point.
 */
const ring = (i: number, radius: number, y: number): Vector3 => {
	const angle = (i / trunkSides) * Math.PI * 2;
	return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
};

/**
 * A trunk: a tapering post, sunk into the ground and hidden at the top, so
 * it needs no ends.
 * @param height - How high it reaches.
 * @returns The trunk.
 */
const trunk = (height: number): BufferGeometry => {
	const color = new Color(bark);
	const dark = color.clone().multiplyScalar(0.6);
	const corners = Array.from({ length: trunkSides }, (_value, k) => {
		const bottomA = ring(k, 0.2, -trunkSink);
		const bottomB = ring(k + 1, 0.2, -trunkSink);
		const topA = ring(k, 0.1, height);
		const topB = ring(k + 1, 0.1, height);
		return [
			{ at: bottomA, color: dark },
			{ at: topB, color },
			{ at: bottomB, color: dark },
			{ at: bottomA, color: dark },
			{ at: topA, color },
			{ at: topB, color },
		];
	}).flat();
	return triangles(corners);
};

/**
 * Builds a pine as one geometry (a trunk and tiers of branches), so every
 * pine of its kind takes one draw call.
 * @param kind - Its kind's shape.
 * @param kind.tiers - How many tiers of branches.
 * @param kind.height - How tall.
 * @param kind.radius - How wide its lowest tier.
 * @param seed - Its own random numbers.
 * @returns The geometry.
 */
const pine = (
	{ tiers, height, radius }: (typeof kinds)[number],
	seed: number,
): BufferGeometry => {
	const random = steadyRandom(seed);
	const start = height * 0.2;
	const step = (height - start) / (tiers + 0.6);
	const parts = [trunk(height * 0.35)];
	for (let i = 0; i < tiers; i++) {
		// Higher tiers are newer growth, a little lighter.
		const green = new Color(greens[i % greens.length]).multiplyScalar(
			1 + (0.15 * i) / tiers,
		);
		parts.push(
			tier(
				start + i * step,
				step * 1.9,
				radius * (1 - i / (tiers + 0.5)),
				i * 0.9,
				green,
				random,
			),
		);
	}
	const merged = mergeGeometries(parts);
	for (const part of parts) {
		part.dispose();
	}
	return merged;
};

export interface Pines {
	// One geometry and one material for each kind of pine.
	geometries: BufferGeometry[];
	materials: MeshLambertMaterial[];
}

/**
 * Creates the kinds of pine, to draw each kind's trees in one go.
 * @returns Each kind's geometry and material.
 */
export const createPines = (): Pines => ({
	geometries: kinds.map((kind, i) => pine(kind, i + 1)),
	materials: kindTints.map(
		(color) =>
			new MeshLambertMaterial({
				color,
				vertexColors: true,
				flatShading: true,
			}),
	),
});

/**
 * A tree's own tint, a little lighter or darker, warmer or cooler than its
 * kind's, so no two neighbours look cut from the same pattern. Always the
 * same for the same tree.
 * @param index - Which tree.
 * @param into - Where to put it.
 * @returns `into`.
 */
export const pineTint = (index: number, into: Color): Color => {
	const random = steadyRandom(index * 7919 + 1);
	const lightness = 0.86 + random() * 0.26;
	const warmth = (random() - 0.5) * 0.14;
	return into.setRGB(
		lightness * (1 + warmth),
		lightness,
		lightness * (1 - warmth),
	);
};
