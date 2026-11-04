import { Group, type Object3D } from 'three';

import { withBudget } from './draw-budget';
import { createHumanoid, readHumanoidModel } from './humanoid';
import modelUrl from './models/me.glb?url';

/**
 * Height (from the feet) of the point the character spins around while
 * cartwheeling. Roughly the middle of the body when in a star pose.
 */
const pivotHeight = 1.05;

/**
 * Me, rigged to the humanoid skeleton (see `humanoid.ts`), in the frames
 * that move me about the slope.
 */
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
	chest: Group;
	head: Group;
	// Shut as they're squashed (scale.y), from 1 (open) to 0.15 (shut).
	eyes: Object3D[];
	leftArm: Group;
	rightArm: Group;
	leftForearm: Group;
	rightForearm: Group;
	leftLeg: Group;
	rightLeg: Group;
	leftShin: Group;
	rightShin: Group;
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
	loaded.model = await readHumanoidModel(data);
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
 * Builds me, from my model: each run's own copy.
 * @returns The character rig.
 */
export const createCharacter = (): Character => {
	if (!loaded.model) {
		throw new Error('Load my model first (loadCharacterModel)');
	}
	const me = createHumanoid(loaded.model);
	// Lowered about my middle, to spin about it.
	me.body.position.y = -pivotHeight;
	const facing = new Group();
	facing.add(me.body);
	const roller = new Group();
	roller.position.y = pivotHeight;
	roller.add(facing);
	const lean = new Group();
	lean.add(roller);
	const root = withBudget(new Group(), 'me');
	root.add(lean);
	return {
		...me,
		root,
		lean,
		roller,
		facing,
		extremities: me.contacts,
	};
};
