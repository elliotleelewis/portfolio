// Makes the template for my model, models/me.glb, from the procedural
// version of me (./me.ts): my shape, coloured and skinned to the skeleton
// the game turns, ready to open in Blender and model over. See
// models/README.md. Run with `pnpm models:template`; it overwrites the
// model, so only run it to start again.
import path from 'node:path';

import {
	Document,
	type Node,
	NodeIO,
	type TypedArray,
} from '@gltf-transform/core';
import {
	BufferAttribute,
	BufferGeometry,
	Color,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	Vector3,
} from 'three';

import { FINISHES, type Finish, isFinish } from '../../src/game/look/surfaces';

import { buildMe } from './me';

// How shut my eyes are when blinking: their height, as a share of open.
const blinkShut = 0.15;

/**
 * Which finish a material is in.
 * @param material - The material.
 * @returns Its finish.
 */
const finishOf = (material: MeshStandardMaterial): Finish => {
	for (const [name, { roughness, metalness }] of Object.entries(FINISHES)) {
		if (
			isFinish(name) &&
			material.roughness === roughness &&
			material.metalness === metalness
		) {
			return name;
		}
	}
	throw new Error('A part of me is in no finish');
};

// Everything in one finish (and see-through or not), for one primitive.
interface Batch {
	finish: Finish;
	opacity: number;
	positions: number[];
	normals: number[];
	colors: number[];
	joints: number[];
	weights: number[];
	blink: number[];
	indices: number[];
}

const me = buildMe();
me.body.updateMatrixWorld(true);

// The skeleton: where each bone is, with my feet at the origin.
const at = (object: Object3D): Vector3 =>
	object.getWorldPosition(new Vector3());
const [leftArm, rightArm] = me.arms;
const [leftLeg, rightLeg] = me.legs;
const [leftHand, rightHand] = me.hands;
const [leftFoot, rightFoot] = me.feet;
const hips = new Vector3(0, 0.95, 0);
const bones: { name: string; at: Vector3; parent?: string }[] = [
	{ name: 'body', at: hips },
	{ name: 'head', at: at(me.head), parent: 'body' },
	{ name: 'arm.L', at: at(leftArm), parent: 'body' },
	{ name: 'arm.R', at: at(rightArm), parent: 'body' },
	{ name: 'leg.L', at: at(leftLeg), parent: 'body' },
	{ name: 'leg.R', at: at(rightLeg), parent: 'body' },
	{ name: 'hand.L', at: at(leftHand), parent: 'arm.L' },
	{ name: 'hand.R', at: at(rightHand), parent: 'arm.R' },
	{ name: 'foot.L', at: at(leftFoot), parent: 'leg.L' },
	{ name: 'foot.R', at: at(rightFoot), parent: 'leg.R' },
];

// Which bone each part moves with: the nearest of my joints above it.
const joints = new Map<Object3D, number>([
	[me.head, 1],
	[leftArm, 2],
	[rightArm, 3],
	[leftLeg, 4],
	[rightLeg, 5],
]);
const boneOf = (part: Object3D): number => {
	for (let node: Object3D | null = part; node; node = node.parent) {
		const bone = joints.get(node);
		if (bone !== undefined) {
			return bone;
		}
	}
	return 0;
};

const batches = new Map<string, Batch>();
const vertex = new Vector3();
const normal = new Vector3();
const linear = new Color();
me.body.traverse((part) => {
	const isEye = me.eyes.some((eye) => eye === part);
	if (!(part instanceof Mesh)) {
		return;
	}
	const material: unknown = part.material;
	const source: unknown = part.geometry;
	if (
		!(material instanceof MeshStandardMaterial) ||
		!(source instanceof BufferGeometry)
	) {
		throw new TypeError('Every part of me is a standard material');
	}
	const finish = finishOf(material);
	const opacity = material.transparent ? material.opacity : 1;
	const key = `${finish}:${String(opacity)}`;
	const batch = batches.get(key) ?? {
		finish,
		opacity,
		positions: [],
		normals: [],
		colors: [],
		joints: [],
		weights: [],
		blink: [],
		indices: [],
	};
	batches.set(key, batch);

	const geometry = source.clone().applyMatrix4(part.matrixWorld);
	const position: unknown = geometry.getAttribute('position');
	const normals: unknown = geometry.getAttribute('normal');
	if (
		!(position instanceof BufferAttribute) ||
		!(normals instanceof BufferAttribute)
	) {
		throw new TypeError('Every part of me has positions and normals');
	}
	const first = batch.positions.length / 3;
	const bone = boneOf(part);
	const eyeCentre = at(part).y;
	linear.copy(material.color);
	for (let i = 0; i < position.count; i++) {
		vertex.fromBufferAttribute(position, i);
		normal.fromBufferAttribute(normals, i);
		batch.positions.push(vertex.x, vertex.y, vertex.z);
		batch.normals.push(normal.x, normal.y, normal.z);
		batch.colors.push(linear.r, linear.g, linear.b);
		batch.joints.push(bone, 0, 0, 0);
		batch.weights.push(1, 0, 0, 0);
		// Blinking squashes my eyes down to a line, about their middles.
		batch.blink.push(
			0,
			isEye ? (vertex.y - eyeCentre) * (blinkShut - 1) : 0,
			0,
		);
	}
	const index = geometry.getIndex();
	const count = index?.count ?? position.count;
	for (let i = 0; i < count; i++) {
		batch.indices.push(first + (index ? index.getX(i) : i));
	}
	geometry.dispose();
});

const document = new Document();
const buffer = document.createBuffer();
const accessor = (
	array: TypedArray,
	type: 'SCALAR' | 'VEC3' | 'VEC4' | 'MAT4',
) => document.createAccessor().setArray(array).setType(type).setBuffer(buffer);

const nodes = new Map<string, Node>();
for (const bone of bones) {
	const parent = bone.parent ? nodes.get(bone.parent) : undefined;
	const offset = bone.at
		.clone()
		.sub(
			bones.find(({ name }) => name === bone.parent)?.at ?? new Vector3(),
		);
	const node = document
		.createNode(bone.name)
		.setTranslation(offset.toArray());
	parent?.addChild(node);
	nodes.set(bone.name, node);
}
const skeleton = bones.map(({ name }) => nodes.get(name));
const inverseBinds = new Float32Array(
	bones.flatMap(({ at: { x, y, z } }) => [
		1,
		0,
		0,
		0,
		0,
		1,
		0,
		0,
		0,
		0,
		1,
		0,
		-x,
		-y,
		-z,
		1,
	]),
);
const skin = document
	.createSkin('me')
	.setInverseBindMatrices(accessor(inverseBinds, 'MAT4'));
for (const joint of skeleton) {
	if (joint) {
		skin.addJoint(joint);
	}
}

const mesh = document
	.createMesh('me')
	.setWeights([0])
	.setExtras({ targetNames: ['blink'] });
for (const batch of batches.values()) {
	const { roughness, metalness } = FINISHES[batch.finish];
	const material = document
		.createMaterial(batch.finish)
		.setBaseColorFactor([1, 1, 1, batch.opacity])
		.setRoughnessFactor(roughness)
		.setMetallicFactor(metalness)
		.setAlphaMode(batch.opacity < 1 ? 'BLEND' : 'OPAQUE');
	const target = document
		.createPrimitiveTarget('blink')
		.setAttribute(
			'POSITION',
			accessor(new Float32Array(batch.blink), 'VEC3'),
		);
	const primitive = document
		.createPrimitive()
		.setMaterial(material)
		.setIndices(accessor(new Uint32Array(batch.indices), 'SCALAR'))
		.setAttribute(
			'POSITION',
			accessor(new Float32Array(batch.positions), 'VEC3'),
		)
		.setAttribute(
			'NORMAL',
			accessor(new Float32Array(batch.normals), 'VEC3'),
		)
		.setAttribute(
			'COLOR_0',
			accessor(new Float32Array(batch.colors), 'VEC3'),
		)
		.setAttribute(
			'JOINTS_0',
			accessor(new Uint16Array(batch.joints), 'VEC4'),
		)
		.setAttribute(
			'WEIGHTS_0',
			accessor(new Float32Array(batch.weights), 'VEC4'),
		)
		.addTarget(target);
	mesh.addPrimitive(primitive);
}

const model = document.createNode('me').setMesh(mesh).setSkin(skin);
const root = nodes.get('body');
const scene = document.createScene('me').addChild(model);
if (root) {
	scene.addChild(root);
}

await new NodeIO().write(
	path.join(import.meta.dirname, '../../models/me.glb'),
	document,
);
