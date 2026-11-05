import {
	BoxGeometry,
	BufferGeometry,
	ConeGeometry,
	Float32BufferAttribute,
	IcosahedronGeometry,
	InstancedMesh,
	Material,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	Path,
	Quaternion,
	Shape,
	ShapeGeometry,
	SkinnedMesh,
	Vector2,
	Vector3,
} from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

/**
 * The world's folded-paper shapes (models/README.md, "The style"): faceted
 * balls, prisms, blocks with their edges folded, spikes, and flat shapes
 * cut out of paper. All in the game's axes: Y up, facing +Z.
 */

/**
 * A point, as a modeller thinks of one: across (to the left, +X), back
 * (behind, -Z) and up (+Y).
 * @param across - To the left.
 * @param back - Behind.
 * @param up - Up.
 * @returns The point, in the game's axes.
 */
export const at = (across: number, back: number, up: number): Vector3 =>
	new Vector3(across, up, -back);

/**
 * A point a little way from another.
 * @param from - The other point.
 * @param across - How far to the left.
 * @param back - How far behind.
 * @param up - How far up.
 * @returns The point.
 */
export const near = (
	from: Vector3,
	across: number,
	back: number,
	up: number,
): Vector3 => from.clone().add(at(across, back, up));

/**
 * A faceted ball: a head, a hand, an ear.
 * @param centre - Its middle.
 * @param size - Its radius.
 * @param squash - How much narrower, shallower or shorter it is: across,
 * back and up.
 * @param detail - How finely it's folded: 0 (20 faces) for most balls, 1
 * (80) for a head.
 * @returns The shape.
 */
export const ball = (
	centre: Vector3,
	size: number,
	squash: readonly [number, number, number] = [1, 1, 1],
	detail = 0,
): BufferGeometry =>
	new IcosahedronGeometry(1, detail)
		.scale(size * squash[0], size * squash[2], size * squash[1])
		.translate(centre.x, centre.y, centre.z);

/**
 * Turns any triangle that faces into a closed shape round to face out.
 * @param geometry - The shape, unindexed.
 * @param middle - A point inside it.
 * @returns The shape.
 */
const outward = (geometry: BufferGeometry, middle: Vector3): BufferGeometry => {
	const position = geometry.getAttribute('position');
	const [p, q, r] = [new Vector3(), new Vector3(), new Vector3()];
	for (let i = 0; i < position.count; i += 3) {
		p.fromBufferAttribute(position, i);
		q.fromBufferAttribute(position, i + 1);
		r.fromBufferAttribute(position, i + 2);
		const normal = q.clone().sub(p).cross(r.clone().sub(p));
		const centre = p.clone().add(q).add(r).divideScalar(3);
		if (normal.dot(centre.sub(middle)) >= 0) {
			continue;
		}
		position.setXYZ(i + 1, r.x, r.y, r.z);
		position.setXYZ(i + 2, q.x, q.y, q.z);
	}
	return geometry;
};

/**
 * A tapering prism from a to b: a limb, a body.
 * @param a - One end.
 * @param b - The other.
 * @param ra - How thick it is at a.
 * @param rb - How thick it is at b.
 * @param sides - How many sides it has.
 * @param twist - How far round its sides are turned.
 * @returns The shape.
 */
export const prism = (
	a: Vector3,
	b: Vector3,
	ra: number,
	rb: number,
	sides: number,
	twist = 0,
): BufferGeometry => {
	const axis = b.clone().sub(a).normalize();
	const across =
		Math.abs(axis.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
	const side = axis.clone().cross(across).normalize();
	const other = axis.clone().cross(side);
	const ring = (end: Vector3, r: number): Vector3[] =>
		Array.from({ length: sides }, (_value, k) => {
			const t = (2 * Math.PI * k) / sides + twist;
			return end
				.clone()
				.addScaledVector(side, Math.cos(t) * r)
				.addScaledVector(other, Math.sin(t) * r);
		});
	const [bottom, top] = [ring(a, ra), ring(b, rb)];
	const corners: number[] = [];
	for (let k = 0; k < sides; k++) {
		const n = (k + 1) % sides;
		// Its side, and a slice of each end.
		for (const v of [
			bottom[k],
			bottom[n],
			top[n],
			bottom[k],
			top[n],
			top[k],
			a,
			bottom[n],
			bottom[k],
			b,
			top[k],
			top[n],
		]) {
			corners.push(v.x, v.y, v.z);
		}
	}
	const geometry = new BufferGeometry().setAttribute(
		'position',
		new Float32BufferAttribute(corners, 3),
	);
	return outward(geometry, a.clone().lerp(b, 0.5));
};

/**
 * A box, its edges folded once if it has a bevel: a shoe, a pack.
 * @param centre - Its middle.
 * @param size - How wide, deep and tall it is.
 * @param bevel - How far its edges are folded in.
 * @returns The shape.
 */
export const block = (
	centre: Vector3,
	size: readonly [number, number, number],
	bevel = 0,
): BufferGeometry => {
	const [w, d, h] = size.map((v) => v / 2);
	if (bevel <= 0) {
		return new BoxGeometry(size[0], size[2], size[1]).translate(
			centre.x,
			centre.y,
			centre.z,
		);
	}
	// Each corner folded off: three points where each corner was, the hull
	// round them all.
	const points: Vector3[] = [];
	for (const sx of [1, -1]) {
		for (const sy of [1, -1]) {
			for (const sz of [1, -1]) {
				points.push(
					at(sx * w, sy * (d - bevel), sz * (h - bevel)),
					at(sx * (w - bevel), sy * d, sz * (h - bevel)),
					at(sx * (w - bevel), sy * (d - bevel), sz * h),
				);
			}
		}
	}
	return new ConvexGeometry(points).translate(centre.x, centre.y, centre.z);
};

/**
 * A spike (of hair, say): a four-sided cone, leaning.
 * @param base - Where it grows from.
 * @param lean - Which way it points.
 * @param r - How wide it is at its base.
 * @param h - How long it is.
 * @returns The shape.
 */
export const spike = (
	base: Vector3,
	lean: Vector3,
	r: number,
	h: number,
): BufferGeometry =>
	new ConeGeometry(r, h, 4)
		.translate(0, h / 2, 0)
		.applyQuaternion(
			new Quaternion().setFromUnitVectors(
				new Vector3(0, 1, 0),
				lean.clone().normalize(),
			),
		)
		.translate(base.x, base.y, base.z);

/**
 * A flat shape cut from paper and stuck on, facing front (+Z): an eye, a
 * mouth, a frame of glasses.
 * @param outline - Its outline, as (across, up) points.
 * @param where - Where it's stuck.
 * @param lift - How far in front of where it's stuck it stands.
 * @param holes - Shapes cut out of it.
 * @param turn - How far it's turned, in its plane.
 * @returns The shape.
 */
export const cutOut = (
	outline: readonly (readonly [number, number])[],
	where: Vector3,
	lift = 0,
	holes: readonly (readonly (readonly [number, number])[])[] = [],
	turn = 0,
): BufferGeometry => {
	const shape = new Shape(outline.map(([x, y]) => new Vector2(x, y)));
	for (const hole of holes) {
		shape.holes.push(new Path(hole.map(([x, y]) => new Vector2(x, y))));
	}
	return new ShapeGeometry(shape)
		.rotateZ(turn)
		.translate(where.x, where.y, where.z + lift);
};

/**
 * Points round an oval.
 * @param rx - How wide it is.
 * @param ry - How tall it is.
 * @returns The points.
 */
export const oval = (rx: number, ry: number): [number, number][] =>
	Array.from({ length: 10 }, (_value, k) => [
		Math.cos((2 * Math.PI * k) / 10) * rx,
		Math.sin((2 * Math.PI * k) / 10) * ry,
	]);

/**
 * Points round a rectangle.
 * @param w - Half its width.
 * @param h - Half its height.
 * @returns The points.
 */
export const rectangle = (w: number, h: number): [number, number][] => [
	[-w, -h],
	[w, -h],
	[w, h],
	[-w, h],
];

/**
 * The same "random" numbers every time, for folds and tufts.
 * @param seed - Which numbers.
 * @returns Numbers from 0 to 1.
 */
export const steadyRandom = (seed: number): (() => number) => {
	const state = { seed };
	return () => {
		state.seed = (state.seed * 16_807) % 2_147_483_647;
		return (state.seed - 1) / 2_147_483_646;
	};
};

/**
 * Cuts a shape down to the triangles wanted: a beard from a shell round
 * the head, say.
 * @param source - The shape. Freed.
 * @param isWanted - Whether to keep a triangle, from its middle.
 * @returns What's kept, unindexed.
 */
export const keep = (
	source: BufferGeometry,
	isWanted: (centre: Vector3) => boolean,
): BufferGeometry => {
	const flat = source.index ? source.toNonIndexed() : source;
	const position = flat.getAttribute('position');
	const [p, q, r] = [new Vector3(), new Vector3(), new Vector3()];
	const kept: number[] = [];
	for (let i = 0; i < position.count; i += 3) {
		p.fromBufferAttribute(position, i);
		q.fromBufferAttribute(position, i + 1);
		r.fromBufferAttribute(position, i + 2);
		const centre = p.clone().add(q).add(r).divideScalar(3);
		if (isWanted(centre)) {
			kept.push(...p, ...q, ...r);
		}
	}
	if (flat !== source) {
		flat.dispose();
	}
	source.dispose();
	return new BufferGeometry().setAttribute(
		'position',
		new Float32BufferAttribute(kept, 3),
	);
};

/**
 * Paints a shape as folded paper: each flat fold (the triangles in one
 * plane) one colour, a little lighter or darker than its paper, with flat
 * normals. Leaves out triangles with no area.
 * @param source - The shape. Freed.
 * @param paper - Its paper's colour, in linear RGB.
 * @param amount - How much lighter or darker its folds can be.
 * @param random - Where the folds' shades come from.
 * @returns The shape, unindexed, with colours and normals.
 */
export const fold = (
	source: BufferGeometry,
	paper: readonly [number, number, number],
	amount: number,
	random: () => number,
): BufferGeometry => {
	const flat = source.index ? source.toNonIndexed() : source;
	const position = flat.getAttribute('position');
	const [p, q, r, n] = [
		new Vector3(),
		new Vector3(),
		new Vector3(),
		new Vector3(),
	];
	const positions: number[] = [];
	const normals: number[] = [];
	const colours: number[] = [];
	const shades = new Map<string, number>();
	for (let i = 0; i < position.count; i += 3) {
		p.fromBufferAttribute(position, i);
		q.fromBufferAttribute(position, i + 1);
		r.fromBufferAttribute(position, i + 2);
		n.copy(q).sub(p).cross(r.clone().sub(p));
		// Triangles with no area (three.js's cones repeat their tips) draw
		// nothing.
		if (n.lengthSq() < 1e-14) {
			continue;
		}
		n.normalize();
		const plane = `${n.x.toFixed(2)},${n.y.toFixed(2)},${n.z.toFixed(2)}|${n.dot(p).toFixed(3)}`;
		const shade = shades.get(plane) ?? 1 + (random() * 2 - 1) * amount;
		shades.set(plane, shade);
		for (const v of [p, q, r]) {
			positions.push(v.x, v.y, v.z);
			normals.push(n.x, n.y, n.z);
			colours.push(...paper.map((c) => Math.min(1, c * shade)));
		}
	}
	if (flat !== source) {
		flat.dispose();
	}
	source.dispose();
	const folded = new BufferGeometry();
	folded.setAttribute('position', new Float32BufferAttribute(positions, 3));
	folded.setAttribute('normal', new Float32BufferAttribute(normals, 3));
	folded.setAttribute('color', new Float32BufferAttribute(colours, 3));
	return folded;
};

// How much lighter or darker a fold can be than its paper.
const folds = 0.07;

/**
 * Whether something is a mesh of one material.
 * @param object - The thing.
 * @returns True if it is.
 */
const isPart = (object: Object3D): object is Mesh<BufferGeometry, Material> =>
	object instanceof Mesh &&
	object.geometry instanceof BufferGeometry &&
	object.material instanceof Material;

/**
 * Whether a part can be folded as paper: a plain, untextured, solid mesh,
 * not already coloured by its geometry, with nothing changing its shape.
 * @param mesh - The part.
 * @returns True if it can.
 */
const isFoldable = (mesh: Mesh<BufferGeometry, Material>): boolean => {
	const { geometry, material } = mesh;
	return (
		!(mesh instanceof SkinnedMesh) &&
		!(mesh instanceof InstancedMesh) &&
		material instanceof MeshStandardMaterial &&
		// Textures need the UVs folding leaves out.
		[
			material.map,
			material.emissiveMap,
			material.alphaMap,
			material.normalMap,
			material.roughnessMap,
			material.metalnessMap,
		].every((map) => map === null) &&
		!material.transparent &&
		!geometry.hasAttribute('color') &&
		Object.keys(geometry.morphAttributes).length === 0
	);
};

/**
 * Folds everything made of plain parts as paper (models/README.md, "The
 * style"): each part's faces flat, each fold a little lighter or darker,
 * painted into its vertex colours. Textured, see-through and instanced
 * parts are left as they are.
 * @param object - What to fold.
 * @param seed - Which shades its folds get.
 */
export const foldPaper = (object: Object3D, seed = 1): void => {
	const random = steadyRandom(seed);
	const meshes: Mesh<BufferGeometry, Material>[] = [];
	object.traverse((child) => {
		if (isPart(child)) {
			meshes.push(child);
		}
	});
	// A material shared with a part that can't be folded keeps its own
	// colour, or that part would have none.
	const unfoldable = new Set<Material>(
		meshes
			.filter((mesh) => !isFoldable(mesh))
			.map(({ material }) => material),
	);
	const folded = new Map<BufferGeometry, BufferGeometry>();
	for (const mesh of meshes) {
		const { geometry, material } = mesh;
		if (
			!isFoldable(mesh) ||
			!(material instanceof MeshStandardMaterial) ||
			unfoldable.has(material)
		) {
			continue;
		}
		const paper =
			folded.get(geometry) ??
			fold(geometry.clone(), [1, 1, 1], folds, random);
		folded.set(geometry, paper);
		mesh.geometry = paper;
		material.vertexColors = true;
	}
};
