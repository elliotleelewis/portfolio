// Models me, in the world's folded-paper style, and writes models/me.glb:
// `pnpm models:me`, then `pnpm models` to get me ready for the game. The
// style is in models/README.md ("The style"): chunky folded paper, hard
// facets, flat colour a little lighter or darker from fold to fold, a face
// cut from paper, and a likeness made of what's recognisable from afar (my
// hair, glasses, grin, tee and daypack), never a sculpted face.
//
// I'm built standing in Blender's axes, as a modeller would think of me:
// Z up, facing -Y, my left at +X. glTF's are Y up, facing +Z, so each
// point (x, y, z) is written as (x, z, -y).
import path from 'node:path';

import {
	Document,
	type Node,
	NodeIO,
	type TypedArray,
} from '@gltf-transform/core';
import {
	BoxGeometry,
	BufferGeometry,
	Color,
	ConeGeometry,
	IcosahedronGeometry,
	Matrix4,
	Path,
	Quaternion,
	Shape,
	ShapeGeometry,
	Vector2,
	Vector3,
} from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

import { FINISHES } from '../../src/game/look/surfaces';

const out = path.join(import.meta.dirname, '../../models/me.glb');

// My colours, from the hero photo (src/media/hero.webp).
const colours = {
	skin: '#f0c7ad',
	blush: '#e9a08e',
	// Strawberry blond, darker underneath.
	hair: '#d8b48e',
	hairUnder: '#bf9671',
	tee: '#8c918a',
	trousers: '#3f454c',
	shoes: '#6a5440',
	soles: '#2e2925',
	pack: '#55605a',
	packDark: '#414a45',
	// Clear grey frames.
	frames: '#b9b6ae',
	eye: '#2a2420',
	mouth: '#7a3a34',
	teeth: '#f6f1e6',
};

// How much lighter or darker each fold is than its paper's colour.
const fold = 0.07;

// The same "random" folds and tufts every time.
const dice = { seed: 4 };
const random = (): number => {
	dice.seed = (dice.seed * 16_807) % 2_147_483_647;
	return (dice.seed - 1) / 2_147_483_646;
};

/**
 * A point, in Blender's axes.
 * @param x - Across, to my left.
 * @param y - Back, behind me.
 * @param z - Up.
 * @returns The point.
 */
const at = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

/**
 * A point a little way from another.
 * @param from - The other point.
 * @param x - How far across.
 * @param y - How far back.
 * @param z - How far up.
 * @returns The point.
 */
const offset = (from: Vector3, x: number, y: number, z: number): Vector3 =>
	from.clone().add(at(x, y, z));

/**
 * The same point on my other side.
 * @param v - The point.
 * @returns It, mirrored.
 */
const mirror = (v: Vector3): Vector3 => new Vector3(-v.x, v.y, v.z);

// My head: a big faceted ball, with my face a flat sheet of paper just in
// front of it.
const head = at(0, 0, 1.52);
const headSize = 0.26;
const face = at(0, -0.236, 0);

// Where my joints are, on my left.
const shoulder = at(0.28, 0, 1.13);
const elbow = at(0.33, 0, 0.92);
const wrist = at(0.385, -0.02, 0.71);
const hip = at(0.11, 0, 0.72);
const knee = at(0.11, 0, 0.42);
const ankle = at(0.11, 0, 0.12);

// The game's humanoid skeleton (models/README.md): Unreal's bone names,
// with a palm and a sole where my hands and feet touch the ground.
interface BoneSpec {
	name: string;
	head: Vector3;
	parent?: string;
}
const bones: BoneSpec[] = [
	{ name: 'pelvis', head: at(0, 0, 0.72) },
	{ name: 'spine_03', head: at(0, 0, 0.92), parent: 'pelvis' },
	{ name: 'Head', head: at(0, 0, 1.28), parent: 'spine_03' },
];
for (const [side, flip] of [
	['l', (v: Vector3): Vector3 => v],
	['r', mirror],
] as const) {
	bones.push(
		{ name: `upperarm_${side}`, head: flip(shoulder), parent: 'spine_03' },
		{
			name: `lowerarm_${side}`,
			head: flip(elbow),
			parent: `upperarm_${side}`,
		},
		{
			name: `palm_${side}`,
			head: flip(offset(wrist, 0, 0, -0.07)),
			parent: `lowerarm_${side}`,
		},
		{ name: `thigh_${side}`, head: flip(hip), parent: 'pelvis' },
		{ name: `calf_${side}`, head: flip(knee), parent: `thigh_${side}` },
		{
			name: `sole_${side}`,
			head: flip(at(0.11, -0.05, 0.001)),
			parent: `calf_${side}`,
		},
	);
}

// A part of me: stiff paper, so it moves with one bone, as one.
interface Part {
	geometry: BufferGeometry;
	colour: string;
	bone: string;
	// How much lighter or darker its folds are.
	fold: number;
	isEye?: boolean;
}
const parts: Part[] = [];

/**
 * Adds a part of me.
 * @param bone - The bone it moves with.
 * @param geometry - Its shape, in Blender's axes.
 * @param colour - Its paper.
 * @param options - How it folds, and whether it's an eye.
 * @param options.fold - How much lighter or darker its folds are.
 * @param options.isEye - Whether it's an eye, which blinks.
 */
const add = (
	bone: string,
	geometry: BufferGeometry,
	colour: string,
	{ fold: folds = fold, isEye = false } = {},
): void => {
	const flat = geometry.index ? geometry.toNonIndexed() : geometry;
	parts.push({ geometry: flat, colour, bone, fold: folds, isEye });
	if (flat !== geometry) {
		geometry.dispose();
	}
};

/**
 * A faceted ball: a head, a hand, an ear.
 * @param centre - Its middle.
 * @param size - Its radius.
 * @param squash - How much narrower, shallower or shorter it is.
 * @param detail - How finely it's folded: 0 (20 faces) for most balls, 1 (80)
 * for a head.
 * @returns The shape.
 */
const ball = (
	centre: Vector3,
	size: number,
	squash: [number, number, number] = [1, 1, 1],
	detail = 0,
): BufferGeometry =>
	new IcosahedronGeometry(1, detail)
		.scale(size * squash[0], size * squash[1], size * squash[2])
		.translate(centre.x, centre.y, centre.z);

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
const prism = (
	a: Vector3,
	b: Vector3,
	ra: number,
	rb: number,
	sides: number,
	twist = 0,
): BufferGeometry => {
	const axis = b.clone().sub(a).normalize();
	const across =
		Math.abs(axis.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
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
	const triangles: Vector3[] = [];
	for (let k = 0; k < sides; k++) {
		const n = (k + 1) % sides;
		// Its side, and a slice of each end.
		triangles.push(
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
		);
	}
	return outward(
		new BufferGeometry().setFromPoints(triangles),
		a.clone().lerp(b, 0.5),
	);
};

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
 * A box, its edges folded once: a shoe, a pack.
 * @param centre - Its middle.
 * @param size - How wide, deep and tall it is.
 * @param bevel - How far its edges are folded in.
 * @returns The shape.
 */
const block = (
	centre: Vector3,
	size: [number, number, number],
	bevel = 0,
): BufferGeometry => {
	const [w, d, h] = size.map((v) => v / 2);
	if (bevel <= 0) {
		return new BoxGeometry(size[0], size[1], size[2]).translate(
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
 * A spike of hair: a four-sided cone, leaning.
 * @param base - Where it grows from.
 * @param lean - Which way it points.
 * @param r - How wide it is at its base.
 * @param h - How long it is.
 * @returns The shape.
 */
const spike = (
	base: Vector3,
	lean: Vector3,
	r: number,
	h: number,
): BufferGeometry =>
	new ConeGeometry(r, h, 4)
		// three.js's cones point up its Y; mine point up Z, then lean.
		.translate(0, h / 2, 0)
		.rotateX(Math.PI / 2)
		.applyQuaternion(
			new Quaternion().setFromUnitVectors(
				new Vector3(0, 0, 1),
				lean.clone().normalize(),
			),
		)
		.translate(base.x, base.y, base.z);

/**
 * A flat shape cut from paper and stuck on my face, facing front.
 * @param outline - Its outline, as (across, up) points.
 * @param where - Where it's stuck.
 * @param lift - How far in front of my face it stands.
 * @param holes - Shapes cut out of it.
 * @returns The shape.
 */
const cutOut = (
	outline: [number, number][],
	where: Vector3,
	lift = 0,
	holes: [number, number][][] = [],
): BufferGeometry => {
	const shape = new Shape(outline.map(([x, z]) => new Vector2(x, z)));
	for (const hole of holes) {
		shape.holes.push(new Path(hole.map(([x, z]) => new Vector2(x, z))));
	}
	// three.js's shapes lie flat, facing +Z: stood up to face -Y.
	return new ShapeGeometry(shape)
		.rotateX(Math.PI / 2)
		.translate(where.x, where.y - lift, where.z);
};

/**
 * Points round an oval.
 * @param rx - How wide it is.
 * @param rz - How tall it is.
 * @returns The points.
 */
const oval = (rx: number, rz: number): [number, number][] =>
	Array.from({ length: 10 }, (_value, k) => [
		Math.cos((2 * Math.PI * k) / 10) * rx,
		Math.sin((2 * Math.PI * k) / 10) * rz,
	]);

/**
 * Points round a rectangle.
 * @param w - Half its width.
 * @param h - Half its height.
 * @returns The points.
 */
const rectangle = (w: number, h: number): [number, number][] => [
	[-w, -h],
	[w, -h],
	[w, h],
	[-w, h],
];

// ---------------------------------------------------------------------------
// Me.

const c = colours;
for (const [side, flip, s] of [
	['l', (v: Vector3): Vector3 => v, 1],
	['r', mirror, -1],
] as const) {
	// Where my parts go on this side.
	const thighTop = flip(offset(hip, 0, 0, 0.06));
	const shinTop = flip(offset(knee, 0, 0, 0.03));
	const shinBottom = flip(offset(ankle, 0, 0, 0.02));
	const sleeveTop = flip(offset(shoulder, -0.01, 0, 0.03));
	const sleeveEnd = flip(shoulder.clone().lerp(elbow, 0.55));
	const armTop = flip(shoulder.clone().lerp(elbow, 0.4));
	const hand = flip(offset(wrist, 0, 0, -0.05));
	const ear = offset(head, s * 0.235, 0.02, -0.02);
	// Legs, in walking trousers, bending at the knee.
	add(
		`thigh_${side}`,
		prism(thighTop, flip(knee), 0.1, 0.088, 6),
		c.trousers,
	);
	add(`calf_${side}`, prism(shinTop, shinBottom, 0.088, 0.08, 6), c.trousers);
	// Trail shoes, on darker soles.
	const shoe = block(flip(at(0.11, -0.05, 0.075)), [0.17, 0.3, 0.12], 0.02);
	add(`calf_${side}`, shoe, c.shoes);
	const sole = block(flip(at(0.11, -0.05, 0.016)), [0.18, 0.31, 0.032]);
	add(`calf_${side}`, sole, c.soles);
	// Arms: a short sleeve, bare arms bending at the elbow, and hands.
	add(
		`upperarm_${side}`,
		prism(sleeveTop, sleeveEnd, 0.088, 0.082, 6),
		c.tee,
	);
	add(`upperarm_${side}`, prism(armTop, flip(elbow), 0.06, 0.056, 5), c.skin);
	add(`lowerarm_${side}`, ball(flip(elbow), 0.057), c.skin);
	add(
		`lowerarm_${side}`,
		prism(flip(elbow), flip(wrist), 0.056, 0.048, 5),
		c.skin,
	);
	add(`lowerarm_${side}`, ball(hand, 0.068, [0.8, 0.9, 1.1]), c.skin);
	// Ears, sticking out a little.
	add('Head', ball(ear, 0.065, [0.45, 0.8, 1]), c.skin);
}

// My middle: the top of my trousers, and a tee over my chest.
add(
	'pelvis',
	prism(at(0, 0, 0.62), at(0, 0, 0.84), 0.2, 0.2, 7, 0.3),
	c.trousers,
);
add(
	'spine_03',
	prism(at(0, 0, 0.78), at(0, 0, 1.2), 0.205, 0.25, 7, 0.3),
	c.tee,
);
add(
	'spine_03',
	prism(at(0, 0, 1.18), at(0, 0, 1.25), 0.25, 0.14, 7, 0.3),
	c.tee,
);
// My daypack, with a lid, and its straps over my shoulders.
add('spine_03', block(at(0, 0.28, 0.97), [0.36, 0.18, 0.44], 0.03), c.pack);
add('spine_03', block(at(0, 0.28, 1.19), [0.34, 0.2, 0.08], 0.02), c.packDark);
for (const s of [1, -1]) {
	add(
		'spine_03',
		block(at(s * 0.13, -0.245, 1), [0.055, 0.02, 0.4]),
		c.packDark,
	);
	add(
		'spine_03',
		block(at(s * 0.15, 0, 1.235), [0.055, 0.5, 0.02]),
		c.packDark,
	);
}
add('spine_03', prism(at(0, 0, 1.2), at(0, 0, 1.32), 0.075, 0.072, 6), c.skin);

// My head: a big, faceted ball.
add('Head', ball(head, headSize, [0.92, 0.9, 1], 1), c.skin, { fold: 0.05 });

// Hair: a folded cap, darker underneath, and tousled spikes, swept up and
// forward at the front.
const cap = offset(head, 0, 0.05, 0.1);
add('Head', ball(cap, 0.25, [0.96, 0.96, 0.72]), c.hairUnder);
for (let k = 0; k < 26; k++) {
	const t = (2 * Math.PI * k) / 26 + (random() - 0.5) * 0.2;
	const ring = [0.18, 0.12, 0.06][k % 3] ?? 0.1;
	const [x, y] = [Math.cos(t) * ring, Math.sin(t) * ring + 0.02];
	const base = offset(head, x, y, 0.2 - ring * 0.25);
	const front = Math.max(0, -Math.sin(t));
	const lean = at(Math.cos(t) * 0.45, Math.sin(t) * 0.45 - 0.35 * front, 1);
	const width = 0.065 + random() * 0.015;
	const length = 0.06 + random() * 0.03 + 0.05 * front;
	add('Head', spike(base, lean, width, length), c.hair, { fold: 0.1 });
}

// My face, cut from paper: smiling eyes, rosy cheeks, a big grin with teeth,
// and clear grey rectangular glasses.
const onFace = head.clone().add(face);
const flat = { fold: 0 };
for (const s of [1, -1]) {
	const eye = offset(onFace, s * 0.08, 0, 0.035);
	const cheek = offset(onFace, s * 0.14, 0.03, -0.045);
	const lens = offset(onFace, s * 0.085, 0, 0.04);
	const rim = [rectangle(0.053, 0.034)];
	add('Head', cutOut(oval(0.022, 0.026), eye), c.eye, {
		fold: 0,
		isEye: true,
	});
	add('Head', cutOut(oval(0.034, 0.025), cheek), c.blush, flat);
	add(
		'Head',
		cutOut(rectangle(0.066, 0.047), lens, 0.012, rim),
		c.frames,
		flat,
	);
}
const bridge = offset(onFace, 0, 0, 0.05);
add('Head', cutOut(rectangle(0.022, 0.006), bridge, 0.012), c.frames, flat);
const grin: [number, number][] = Array.from({ length: 11 }, (_value, k) => [
	Math.cos(Math.PI + (Math.PI * k) / 10) * 0.075,
	Math.sin(Math.PI + (Math.PI * k) / 10) * 0.05,
]);
const teeth: [number, number][] = grin.map(([x, z]) => [
	x * 0.86,
	Math.max(z, -0.016) * 0.86,
]);
add('Head', cutOut(grin, offset(onFace, 0, 0, -0.07), 0.002), c.mouth, flat);
add('Head', cutOut(teeth, offset(onFace, 0, 0, -0.072), 0.004), c.teeth, flat);

// ---------------------------------------------------------------------------
// Into one mesh: folds coloured, each part on its bone, my eyes blinking.

const positions: number[] = [];
const normals: number[] = [];
const vertexColours: number[] = [];
const joints: number[] = [];
const weights: number[] = [];
const blink: number[] = [];
const boneIndex = new Map(bones.map(({ name }, i) => [name, i]));
// Blinking squashes my eyes to a line, about their middles.
const eyeMiddle = head.z + 0.035;
const shut = 0.15;

const folded = new Color();
const [p, q, r, normal] = [
	new Vector3(),
	new Vector3(),
	new Vector3(),
	new Vector3(),
];
for (const part of parts) {
	const position = part.geometry.getAttribute('position');
	// In linear RGB, as glTF's vertex colours are (three.js converts hex).
	const paper = new Color(part.colour);
	// Each flat fold (the triangles in one plane) one colour.
	const folds = new Map<string, number>();
	const joint = boneIndex.get(part.bone) ?? 0;
	for (let i = 0; i < position.count; i += 3) {
		p.fromBufferAttribute(position, i);
		q.fromBufferAttribute(position, i + 1);
		r.fromBufferAttribute(position, i + 2);
		normal.copy(q).sub(p).cross(r.clone().sub(p));
		// Triangles with no area (three.js's cones repeat their tips) draw
		// nothing: leave them out.
		if (normal.lengthSq() < 1e-14) {
			continue;
		}
		normal.normalize();
		const [nx, ny, nz] = [normal.x, normal.y, normal.z].map((v) =>
			v.toFixed(2),
		);
		const plane = `${nx},${ny},${nz}|${normal.dot(p).toFixed(3)}`;
		const shade = folds.get(plane) ?? 1 + (random() * 2 - 1) * part.fold;
		folds.set(plane, shade);
		folded.copy(paper).multiplyScalar(shade);
		for (const v of [p, q, r]) {
			positions.push(v.x, v.z, -v.y);
			normals.push(normal.x, normal.z, -normal.y);
			vertexColours.push(
				Math.min(1, folded.r),
				Math.min(1, folded.g),
				Math.min(1, folded.b),
			);
			joints.push(joint, 0, 0, 0);
			weights.push(1, 0, 0, 0);
			blink.push(0, part.isEye ? (v.z - eyeMiddle) * (shut - 1) : 0, 0);
		}
	}
	part.geometry.dispose();
}

const document = new Document();
const buffer = document.createBuffer();
const accessor = (array: TypedArray, type: 'VEC3' | 'VEC4' | 'MAT4') =>
	document.createAccessor().setArray(array).setType(type).setBuffer(buffer);

// The skeleton, each bone placed from its parent, unturned at rest.
const nodes = new Map<string, Node>();
for (const bone of bones) {
	const parent =
		bone.parent === undefined ? undefined : nodes.get(bone.parent);
	const from =
		bones.find(({ name }) => name === bone.parent)?.head ?? new Vector3();
	const offset = bone.head.clone().sub(from);
	const node = document
		.createNode(bone.name)
		.setTranslation([offset.x, offset.z, -offset.y]);
	parent?.addChild(node);
	nodes.set(bone.name, node);
}
// Each bone's inverse bind matrix: from where it is at rest to its origin.
const inverseBinds = new Float32Array(
	bones.flatMap(({ head: { x, y, z } }) =>
		new Matrix4().makeTranslation(-x, -z, y).toArray(),
	),
);
const skin = document
	.createSkin('me')
	.setInverseBindMatrices(accessor(inverseBinds, 'MAT4'));
for (const { name } of bones) {
	const node = nodes.get(name);
	if (node) {
		skin.addJoint(node);
	}
}

const { roughness, metalness } = FINISHES.matte;
const blinkPositions = accessor(new Float32Array(blink), 'VEC3');
const primitive = document
	.createPrimitive()
	.setMaterial(
		document
			.createMaterial('matte')
			.setRoughnessFactor(roughness)
			.setMetallicFactor(metalness),
	)
	.setAttribute('POSITION', accessor(new Float32Array(positions), 'VEC3'))
	.setAttribute('NORMAL', accessor(new Float32Array(normals), 'VEC3'))
	.setAttribute('COLOR_0', accessor(new Float32Array(vertexColours), 'VEC3'))
	.setAttribute('JOINTS_0', accessor(new Uint16Array(joints), 'VEC4'))
	.setAttribute('WEIGHTS_0', accessor(new Float32Array(weights), 'VEC4'))
	.addTarget(
		document
			.createPrimitiveTarget('blink')
			.setAttribute('POSITION', blinkPositions),
	);
const mesh = document
	.createMesh('me')
	.addPrimitive(primitive)
	.setWeights([0])
	.setExtras({ targetNames: ['blink'] });
const scene = document
	.createScene('me')
	.addChild(document.createNode('me').setMesh(mesh).setSkin(skin));
const root = nodes.get('pelvis');
if (root) {
	scene.addChild(root);
}

await new NodeIO().write(out, document);
console.log(`me.glb: ${String(positions.length / 9)} triangles`);
