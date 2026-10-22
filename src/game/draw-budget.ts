import type { Object3D } from 'three';

/**
 * The parts of the game and the gallery that each have a drawing budget
 * (see `draw-budget.test.ts`). Everything drawn is under one of them, which
 * the end-to-end tests check, so nothing is drawn without a budget.
 */
export type DrawBudget =
	| 'me'
	| 'bears'
	| 'bear alerts'
	| 'easter egg'
	| 'trees'
	| 'ground'
	| 'horizon'
	| 'effects'
	| 'gallery scenery';

/**
 * Marks an object as one of the parts with a drawing budget: everything
 * drawn under it counts against that budget.
 * @param object - The object.
 * @param budget - Its budget.
 * @returns The object.
 */
export const withBudget = <T extends Object3D>(
	object: T,
	budget: DrawBudget,
): T => {
	object.userData.drawBudget = budget;
	return object;
};
