import {
	BufferGeometry,
	Group,
	Material,
	MathUtils,
	Mesh,
	Object3D,
	Quaternion,
	SkinnedMesh,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import type { Bone } from './people/person';

// How shut the eyes are when blinking, as a share of open: a model's
// `blink` shape key shuts them this far (models/README.md).
const blinkShut = 0.15;

/**
 * A person, rigged to the humanoid skeleton, for the game to pose. Pose the
 * joints, never the model's bones, then call `keepUp()`.
 */
export interface Humanoid {
	// Everything, with the feet at its origin.
	body: Group;
	// Bends and twists at the chest; carries the head and arms.
	chest: Group;
	head: Group;
	// Arms and legs turn at the shoulders and hips, and bend at the elbows
	// and knees. Each turns about the body's own axes, from its rest pose
	// (arms down, a little out from the sides).
	leftArm: Group;
	rightArm: Group;
	leftForearm: Group;
	rightForearm: Group;
	leftLeg: Group;
	rightLeg: Group;
	leftShin: Group;
	rightShin: Group;
	// Shut as they're squashed (scale.y), from 1 (open) to 0.15 (shut).
	eyes: Object3D[];
	// How they look: knocked out (crossed eyes and a wobbly mouth, if the
	// model has a `knockedOut` shape key), from 0 to 1.
	face: { knockedOut: number };
	// Where the palms and soles are (left palm, right palm, left sole, right
	// sole), moving with the joints, for what has to touch the ground.
	contacts: Object3D[];
	// Turns the model's bones to match the joints, blinks, and sets the face.
	keepUp: () => void;
}

/**
 * How something's turned, relative to something above it.
 * @param above - What it's relative to.
 * @param node - The thing.
 * @param into - Where to put it.
 * @returns `into`.
 */
const turnWithin = (
	above: Object3D,
	node: Object3D | null,
	into: Quaternion,
): Quaternion => {
	into.identity();
	for (let n = node; n && n !== above; n = n.parent) {
		into.premultiply(n.quaternion);
	}
	return into;
};

// A joint the game turns, and the bone it turns in the model, each as it
// was at rest, relative to the body.
interface Retarget {
	joint: Object3D;
	bone: Object3D;
	jointRest: Quaternion;
	boneRest: Quaternion;
}

/**
 * Makes a person from a model rigged to the humanoid skeleton: their own
 * copy of it, with joints for the game to pose.
 * @param model - The model (`personModel`, in people/model.ts).
 * @returns The person.
 */
export const createHumanoid = (model: Object3D): Humanoid => {
	const copy = clone(model);
	const bone = (name: Bone): Object3D =>
		copy.getObjectByName(name) ?? new Object3D();
	// Their own geometry and materials, so freeing them leaves the model as
	// it was.
	copy.traverse((part) => {
		if (!(part instanceof Mesh)) {
			return;
		}
		const geometry: unknown = part.geometry;
		const material: unknown = part.material;
		if (geometry instanceof BufferGeometry) {
			part.geometry = geometry.clone();
		}
		if (material instanceof Material) {
			part.material = material.clone();
		}
		part.castShadow = true;
		// The model's bounds are only its rest pose's.
		part.frustumCulled = false;
	});
	const body = new Group();
	body.add(copy);
	body.updateMatrixWorld(true);

	// The joints, where the model's bones are, in the bones' own hierarchy:
	// head and arms on the chest, forearms on the arms, shins on the legs.
	const joint = (name: Bone, parent: Object3D, tilt = 0): Group => {
		const group = new Group();
		parent.add(group);
		bone(name).getWorldPosition(group.position);
		parent.worldToLocal(group.position);
		group.rotation.z = tilt;
		group.updateMatrixWorld(true);
		return group;
	};
	const chest = joint('spine_03', body);
	const head = joint('Head', chest);
	// At rest, the arms hang a little out from the sides.
	const leftArm = joint('upperarm_l', chest, 0.08);
	const rightArm = joint('upperarm_r', chest, -0.08);
	const leftForearm = joint('lowerarm_l', leftArm);
	const rightForearm = joint('lowerarm_r', rightArm);
	const leftLeg = joint('thigh_l', body);
	const rightLeg = joint('thigh_r', body);
	const leftShin = joint('calf_l', leftLeg);
	const rightShin = joint('calf_r', rightLeg);
	const contacts = (
		[
			[leftForearm, 'palm_l'],
			[rightForearm, 'palm_r'],
			[leftShin, 'sole_l'],
			[rightShin, 'sole_r'],
		] as const
	).map(([parent, name]) => joint(name, parent));
	const eyes = [new Object3D(), new Object3D()];
	head.add(...eyes);

	// Parents first, so each bone turns from where its parent now is.
	const retargets: Retarget[] = (
		[
			[chest, 'spine_03'],
			[head, 'Head'],
			[leftArm, 'upperarm_l'],
			[rightArm, 'upperarm_r'],
			[leftForearm, 'lowerarm_l'],
			[rightForearm, 'lowerarm_r'],
			[leftLeg, 'thigh_l'],
			[rightLeg, 'thigh_r'],
			[leftShin, 'calf_l'],
			[rightShin, 'calf_r'],
		] as const
	).map(([group, name]) => ({
		joint: group,
		bone: bone(name),
		jointRest: turnWithin(body, group, new Quaternion()),
		boneRest: turnWithin(body, bone(name), new Quaternion()),
	}));

	// Each mesh's shape keys (`blink`, and `knockedOut` if it has one), and
	// how far each is on.
	const keys: { name: string; index: number; influences: number[] }[] = [];
	copy.traverse((part) => {
		if (!(part instanceof SkinnedMesh) || !part.morphTargetInfluences) {
			return;
		}
		for (const name of ['blink', 'knockedOut']) {
			const index = part.morphTargetDictionary?.[name];
			if (index !== undefined) {
				keys.push({
					name,
					index,
					influences: part.morphTargetInfluences,
				});
			}
		}
	});
	const face = { knockedOut: 0 };

	const now = new Quaternion();
	const rest = new Quaternion();
	const parent = new Quaternion();
	return {
		body,
		chest,
		head,
		leftArm,
		rightArm,
		leftForearm,
		rightForearm,
		leftLeg,
		rightLeg,
		leftShin,
		rightShin,
		eyes,
		face,
		contacts,
		keepUp: () => {
			// Each joint's turn since rest, about the body's own axes, given to its
			// bone, whichever way the model's bones lie: the bone ends up turned
			// just as the joint is, from where its parent now is.
			for (const {
				joint: group,
				bone: target,
				jointRest,
				boneRest,
			} of retargets) {
				turnWithin(body, group, now);
				rest.copy(jointRest).invert();
				now.multiply(rest).multiply(boneRest);
				turnWithin(body, target.parent, parent);
				target.quaternion.copy(parent.invert().multiply(now));
			}
			const [eye] = eyes;
			const shut = MathUtils.clamp(
				(1 - eye.scale.y) / (1 - blinkShut),
				0,
				1,
			);
			for (const { name, index, influences } of keys) {
				influences[index] = name === 'blink' ? shut : face.knockedOut;
			}
		},
	};
};
