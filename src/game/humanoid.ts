import {
	BufferGeometry,
	Group,
	MathUtils,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	Quaternion,
	SkinnedMesh,
} from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { isFinish, surface } from './look/surfaces';

// How shut the eyes are when blinking, as a share of open: a model's
// `blink` shape key shuts them this far (models/README.md).
const blinkShut = 0.15;

/**
 * The humanoid skeleton every person in the game is rigged to: Unreal's bone
 * names, with a palm and a sole where each hand and foot
 * touches the ground. These are the bones the game turns or reads; a model
 * can have more (fingers, twist bones), which follow as they're weighted.
 * See models/README.md.
 */
const humanoidBones = [
	'pelvis',
	'spine_03',
	'Head',
	'upperarm_l',
	'upperarm_r',
	'lowerarm_l',
	'lowerarm_r',
	'thigh_l',
	'thigh_r',
	'calf_l',
	'calf_r',
	'palm_l',
	'palm_r',
	'sole_l',
	'sole_r',
] as const;

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
	// Where the palms and soles are (left palm, right palm, left sole, right
	// sole), moving with the joints, for what has to touch the ground.
	contacts: Object3D[];
	// Turns the model's bones to match the joints, and blinks.
	keepUp: () => void;
}

/**
 * Reads a model rigged to the humanoid skeleton, checking it has
 * everything the game needs.
 * @param data - The model, as a .glb file.
 * @returns The model, to make people from with {@link createHumanoid}.
 */
export const readHumanoidModel = async (
	data: ArrayBuffer,
): Promise<Object3D> => {
	const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
	const { scene } = await loader.parseAsync(data, '');
	for (const name of humanoidBones) {
		if (!scene.getObjectByName(name)) {
			throw new Error(`The model has no "${name}" bone`);
		}
	}
	const blinks: boolean[] = [];
	scene.traverse((part) => {
		if (!(part instanceof Mesh)) {
			return;
		}
		const material: unknown = part.material;
		if (
			!(material instanceof MeshStandardMaterial) ||
			!isFinish(material.name)
		) {
			throw new Error(
				'Every material in the model is named for its finish',
			);
		}
		blinks.push(part.morphTargetDictionary?.blink !== undefined);
	});
	if (!blinks.includes(true)) {
		throw new Error('The model has no "blink" shape key');
	}
	return scene;
};

/**
 * Remakes a model's material in its finish, so people are finished like
 * the rest of the world.
 * @param material - The material, named for its finish.
 * @param hasVertexColors - Whether its colours are painted on its vertices.
 * @returns The material.
 */
const finished = (
	material: MeshStandardMaterial,
	hasVertexColors: boolean,
): MeshStandardMaterial => {
	const finish = isFinish(material.name) ? material.name : 'matte';
	return surface(`#${material.color.getHexString()}`, finish, {
		vertexColors: hasVertexColors,
		transparent: material.opacity < 1,
		opacity: material.opacity,
	});
};

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
 * @param model - The model, from {@link readHumanoidModel}.
 * @returns The person.
 */
export const createHumanoid = (model: Object3D): Humanoid => {
	type HumanoidBone = (typeof humanoidBones)[number];
	const copy = clone(model);
	const bone = (name: HumanoidBone): Object3D =>
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
			if (material instanceof MeshStandardMaterial) {
				part.material = finished(
					material,
					geometry.hasAttribute('color'),
				);
			}
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
	const joint = (name: HumanoidBone, parent: Object3D, tilt = 0): Group => {
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

	// Each mesh's `blink` shape key, and how far it's on.
	const blinking: { index: number; influences: number[] }[] = [];
	copy.traverse((part) => {
		const index =
			part instanceof SkinnedMesh
				? part.morphTargetDictionary?.blink
				: undefined;
		if (
			index !== undefined &&
			part instanceof SkinnedMesh &&
			part.morphTargetInfluences
		) {
			blinking.push({ index, influences: part.morphTargetInfluences });
		}
	});

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
			for (const { index, influences } of blinking) {
				influences[index] = shut;
			}
		},
	};
};
