import {
	BufferGeometry,
	Group,
	MathUtils,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	PropertyBinding,
	Quaternion,
	SkinnedMesh,
} from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { withBudget } from './draw-budget';
import { isFinish, surface } from './look/surfaces';
import modelUrl from './models/me.glb?url';

/**
 * Height (from the feet) of the point the character spins around while
 * cartwheeling. Roughly the middle of the body when in a star pose.
 */
const pivotHeight = 1.05;

// How shut my eyes are when blinking, as a share of open: my model's
// `blink` shape key shuts them this far (models/README.md).
const blinkShut = 0.15;

// The bones my model has to have, which the game turns (models/README.md),
// named as in Blender. three.js leaves the dots out (`armL`).
const boneNames = [
	'body',
	'head',
	'arm.L',
	'arm.R',
	'leg.L',
	'leg.R',
	'hand.L',
	'hand.R',
	'foot.L',
	'foot.R',
] as const;

export interface Character {
	// Positioned on the slope.
	root: Group;
	// Leans into turns.
	lean: Group;
	// Spins around its local x-axis to cartwheel.
	roller: Group;
	// Turns the body to face sideways before rolling.
	facing: Group;
	body: Group;
	head: Group;
	// Shut as they're squashed (scale.y), from 1 (open) to 0.15 (shut).
	eyes: Object3D[];
	leftArm: Group;
	rightArm: Group;
	leftLeg: Group;
	rightLeg: Group;
	// Hands and feet; used to keep the cartwheel on the ground.
	extremities: Object3D[];
	// Brings my model up to date, once I've been posed.
	keepUp: () => void;
}

// My model, once it's loaded, for each run to take a copy of.
const loaded: { model?: Object3D } = {};

/**
 * Reads my model (models/README.md), checking it has everything the game
 * needs, and keeps it for {@link createCharacter}.
 * @param data - The model, as a .glb file.
 */
export const readCharacterModel = async (data: ArrayBuffer): Promise<void> => {
	const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
	const { scene } = await loader.parseAsync(data, '');
	for (const name of boneNames) {
		if (!scene.getObjectByName(PropertyBinding.sanitizeNodeName(name))) {
			throw new Error(`My model has no "${name}" bone`);
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
				'Every material in my model is named for its finish',
			);
		}
		blinks.push(part.morphTargetDictionary?.blink !== undefined);
	});
	if (!blinks.includes(true)) {
		throw new Error('My model has no "blink" shape key');
	}
	loaded.model = scene;
};

/**
 * Loads my model, once, before the first run.
 */
export const loadCharacterModel = async (): Promise<void> => {
	if (loaded.model) {
		return;
	}
	const response = await fetch(modelUrl);
	await readCharacterModel(await response.arrayBuffer());
};

/**
 * Remakes a material from my model in its finish, so I'm finished like the
 * rest of the world.
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

// A joint the game turns, and the bone in my model it turns.
interface Retarget {
	joint: Object3D;
	bone: Object3D;
	// How the joint and the bone were, at rest.
	jointRest: Quaternion;
	boneRest: Quaternion;
	// Which way the bone's parent faces in my model, at rest.
	parentRest: Quaternion;
}

/**
 * Builds me, from my model: each run's own copy.
 * @returns The character rig.
 */
export const createCharacter = (): Character => {
	if (!loaded.model) {
		throw new Error('Load my model first (loadCharacterModel)');
	}
	const me = clone(loaded.model);
	me.updateMatrixWorld(true);
	const bone = (name: (typeof boneNames)[number]): Object3D =>
		me.getObjectByName(PropertyBinding.sanitizeNodeName(name)) ??
		new Object3D();
	// Each run's own geometry and materials, so freeing one run's me leaves
	// my model as it was.
	me.traverse((part) => {
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
		// I'm always in shot, and my model's bounds are only my rest pose's.
		part.frustumCulled = false;
	});

	// Placed on my model where its bones are, then lowered about my middle.
	const body = new Group();
	body.add(me);

	// The joints the game turns, where my model's bones are, posed as they
	// are at rest: my arms a little out from my sides.
	const joint = (name: (typeof boneNames)[number], tilt = 0): Group => {
		const group = new Group();
		bone(name).getWorldPosition(group.position);
		group.rotation.z = tilt;
		body.add(group);
		return group;
	};
	const head = joint('head');
	const leftArm = joint('arm.L', 0.08);
	const rightArm = joint('arm.R', -0.08);
	const leftLeg = joint('leg.L');
	const rightLeg = joint('leg.R');
	body.updateMatrixWorld(true);

	// Where my hands and feet are, moving with my arms and legs.
	const marker = (
		parent: Group,
		name: (typeof boneNames)[number],
	): Object3D => {
		const at = new Object3D();
		parent.add(at);
		bone(name).getWorldPosition(at.position);
		parent.worldToLocal(at.position);
		return at;
	};
	const extremities = [
		marker(leftArm, 'hand.L'),
		marker(rightArm, 'hand.R'),
		marker(leftLeg, 'foot.L'),
		marker(rightLeg, 'foot.R'),
	];
	body.position.y = -pivotHeight;
	const eyes = [new Object3D(), new Object3D()];
	head.add(...eyes);

	const retargets: Retarget[] = (
		[
			[head, 'head'],
			[leftArm, 'arm.L'],
			[rightArm, 'arm.R'],
			[leftLeg, 'leg.L'],
			[rightLeg, 'leg.R'],
		] as const
	).map(([group, name]) => {
		const target = bone(name);
		return {
			joint: group,
			bone: target,
			jointRest: group.quaternion.clone(),
			boneRest: target.quaternion.clone(),
			parentRest:
				target.parent?.getWorldQuaternion(new Quaternion()) ??
				new Quaternion(),
		};
	});
	// Each mesh's `blink` shape key, and how far it's on.
	const blinking: { index: number; influences: number[] }[] = [];
	me.traverse((part) => {
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

	const facing = new Group();
	facing.add(body);
	const roller = new Group();
	roller.position.y = pivotHeight;
	roller.add(facing);
	const lean = new Group();
	lean.add(roller);
	const root = withBudget(new Group(), 'me');
	root.add(lean);

	const turn = new Quaternion();
	return {
		root,
		lean,
		roller,
		facing,
		body,
		head,
		eyes,
		leftArm,
		rightArm,
		leftLeg,
		rightLeg,
		extremities,
		keepUp: () => {
			// Each joint's turn from rest, about my body's own axes, turned into
			// its bone's: whichever way my model's bones lie, they turn just as
			// the joints do.
			for (const {
				joint,
				bone: target,
				jointRest,
				boneRest,
				parentRest,
			} of retargets) {
				turn.copy(jointRest).invert().premultiply(joint.quaternion);
				target.quaternion
					.copy(parentRest)
					.invert()
					.multiply(turn)
					.multiply(parentRest)
					.multiply(boneRest);
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
