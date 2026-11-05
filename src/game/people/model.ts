import {
	Bone,
	Box3,
	BufferGeometry,
	Float32BufferAttribute,
	Group,
	type Material,
	Skeleton,
	SkinnedMesh,
	Uint16BufferAttribute,
	Vector3,
} from 'three';

import { BONES, type PersonSpec, personParts } from './person';

// Blinking squashes the eyes to a line, about their middles.
const shut = 0.15;

/**
 * Someone as one skinned mesh on the humanoid skeleton, for the game to
 * pose with `createHumanoid` (`humanoid.ts`): one draw, two with its
 * shadow. Their parts are each skinned to the bone they move with, and
 * their face has two shape keys: `blink`, which shuts their eyes, and
 * `knockedOut`, which folds their everyday face away and unfolds the one
 * they wear once a bear gets them (if they have one).
 * @param spec - How they look.
 * @param material - Their paper (`personMaterial`).
 * @returns Them, standing at rest with their feet at the origin.
 */
export const personModel = (spec: PersonSpec, material: Material): Group => {
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
	for (const part of personParts(spec)) {
		const { geometry } = part;
		const position = geometry.getAttribute('position');
		const normal = geometry.getAttribute('normal');
		const colour = geometry.getAttribute('color');
		// Faces fold away to nothing, into their middles: the everyday one
		// (eyes and first mouth) when they're knocked out, and the
		// knocked-out one until then.
		geometry.computeBoundingBox();
		(geometry.boundingBox ?? new Box3()).getCenter(middle);
		const isOut = part.mouth === 'knockedOut';
		const isAwake = part.isEye === true || part.mouth === spec.mouths[0];
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

	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
	geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
	geometry.setAttribute('skinIndex', new Uint16BufferAttribute(joints, 4));
	geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
	const blinkKey = new Float32BufferAttribute(blink, 3);
	blinkKey.name = 'blink';
	const knockedOutKey = new Float32BufferAttribute(knockedOut, 3);
	knockedOutKey.name = 'knockedOut';
	geometry.morphAttributes.position = spec.mouths.includes('knockedOut')
		? [blinkKey, knockedOutKey]
		: [blinkKey];
	geometry.morphTargetsRelative = true;

	// The skeleton, each bone placed from its parent, unturned at rest.
	const bones = new Map<string, Bone>();
	for (const { name, head, parent } of BONES) {
		const bone = new Bone();
		bone.name = name;
		const above = parent === undefined ? undefined : bones.get(parent);
		const from =
			BONES.find((other) => other.name === parent)?.head ?? new Vector3();
		bone.position.copy(head).sub(from);
		above?.add(bone);
		bones.set(name, bone);
	}
	const mesh = new SkinnedMesh(geometry, material);
	const root = bones.get('pelvis');
	const model = new Group();
	model.add(mesh);
	if (root) {
		model.add(root);
	}
	model.updateMatrixWorld(true);
	mesh.bind(new Skeleton(bones.values().toArray()));
	mesh.updateMorphTargets();
	return model;
};
