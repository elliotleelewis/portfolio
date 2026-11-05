import { Group, type Object3D } from 'three';

import { withBudget } from './draw-budget';
import { createHumanoid } from './humanoid';
import { ME } from './people/cast';
import { personModel } from './people/model';
import { personMaterial } from './people/person';

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
	// How I look: knocked out (crossed eyes and a wobbly mouth), from 0 to 1.
	face: { knockedOut: number };
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

// My model, built the first time a run asks for it, for each run to take a
// copy of.
const built: { model?: Object3D } = {};

/**
 * Builds me (`ME`, in people/cast.ts): each run's own copy.
 * @returns The character rig.
 */
export const createCharacter = (): Character => {
	built.model ??= personModel(ME, personMaterial());
	const me = createHumanoid(built.model);
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
