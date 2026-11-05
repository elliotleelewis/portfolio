// Writes my model, models/me.glb, from how I look (ME in
// src/game/people/cast.ts), built by the same folded-paper person builder
// as everyone in the easter eggs (src/game/people/person.ts): `pnpm
// models:me`, then `pnpm models` to get me ready for the game. I'm a glTF so
// I can be loaded and skinned like any model on the humanoid skeleton
// (models/README.md).
import path from 'node:path';

import {
	Document,
	type Node,
	NodeIO,
	type TypedArray,
} from '@gltf-transform/core';
import { Box3, Matrix4, Vector3 } from 'three';

import { FINISHES } from '../../src/game/look/surfaces';
import { ME } from '../../src/game/people/cast';
import { BONES, personParts } from '../../src/game/people/person';

const out = path.join(import.meta.dirname, '../../models/me.glb');

// Blinking squashes my eyes to a line, about their middles.
const shut = 0.15;

const positions: number[] = [];
const normals: number[] = [];
const colours: number[] = [];
const joints: number[] = [];
const weights: number[] = [];
const blink: number[] = [];
const knockedOut: number[] = [];
const boneIndex = new Map(BONES.map(({ name }, i) => [name, i]));
const middle = new Vector3();
const v = new Vector3();
for (const part of personParts(ME)) {
	const { geometry } = part;
	const position = geometry.getAttribute('position');
	const normal = geometry.getAttribute('normal');
	const colour = geometry.getAttribute('color');
	// Faces fold away to nothing, into their middles: my everyday one (my eyes
	// and grin) when I'm knocked out, and the knocked-out one until then.
	geometry.computeBoundingBox();
	(geometry.boundingBox ?? new Box3()).getCenter(middle);
	const isOut = part.mouth === 'knockedOut';
	const isAwake = part.isEye === true || part.mouth === 'grin';
	const joint = boneIndex.get(part.bone) ?? 0;
	for (let i = 0; i < position.count; i++) {
		v.fromBufferAttribute(position, i);
		const where = isOut ? middle : v;
		positions.push(where.x, where.y, where.z);
		normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
		colours.push(colour.getX(i), colour.getY(i), colour.getZ(i));
		joints.push(joint, 0, 0, 0);
		weights.push(1, 0, 0, 0);
		blink.push(0, part.isEye ? (v.y - middle.y) * (shut - 1) : 0, 0);
		const unfold = v.clone().sub(middle);
		const change = isOut
			? unfold
			: isAwake
				? unfold.negate()
				: new Vector3();
		knockedOut.push(change.x, change.y, change.z);
	}
	geometry.dispose();
}

const document = new Document();
const buffer = document.createBuffer();
const accessor = (array: TypedArray, type: 'VEC3' | 'VEC4' | 'MAT4') =>
	document.createAccessor().setArray(array).setType(type).setBuffer(buffer);

// The skeleton, each bone placed from its parent, unturned at rest.
const nodes = new Map<string, Node>();
for (const bone of BONES) {
	const parent =
		bone.parent === undefined ? undefined : nodes.get(bone.parent);
	const from =
		BONES.find(({ name }) => name === bone.parent)?.head ?? new Vector3();
	const offset = bone.head.clone().sub(from);
	const node = document
		.createNode(bone.name)
		.setTranslation(offset.toArray());
	parent?.addChild(node);
	nodes.set(bone.name, node);
}
// Each bone's inverse bind matrix: from where it is at rest to its origin.
const inverseBinds = new Float32Array(
	BONES.flatMap(({ head: { x, y, z } }) =>
		new Matrix4().makeTranslation(-x, -y, -z).toArray(),
	),
);
const skin = document
	.createSkin('me')
	.setInverseBindMatrices(accessor(inverseBinds, 'MAT4'));
for (const { name } of BONES) {
	const node = nodes.get(name);
	if (node) {
		skin.addJoint(node);
	}
}

const { roughness, metalness } = FINISHES.matte;
const blinkPositions = accessor(new Float32Array(blink), 'VEC3');
const knockedOutPositions = accessor(new Float32Array(knockedOut), 'VEC3');
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
	.setAttribute('COLOR_0', accessor(new Float32Array(colours), 'VEC3'))
	.setAttribute('JOINTS_0', accessor(new Uint16Array(joints), 'VEC4'))
	.setAttribute('WEIGHTS_0', accessor(new Float32Array(weights), 'VEC4'))
	.addTarget(
		document
			.createPrimitiveTarget('blink')
			.setAttribute('POSITION', blinkPositions),
	)
	.addTarget(
		document
			.createPrimitiveTarget('knockedOut')
			.setAttribute('POSITION', knockedOutPositions),
	);
const mesh = document
	.createMesh('me')
	.addPrimitive(primitive)
	.setWeights([0, 0])
	.setExtras({ targetNames: ['blink', 'knockedOut'] });
const scene = document
	.createScene('me')
	.addChild(document.createNode('me').setMesh(mesh).setSkin(skin));
const root = nodes.get('pelvis');
if (root) {
	scene.addChild(root);
}

await new NodeIO().write(out, document);
console.log(`me.glb: ${String(positions.length / 9)} triangles`);
