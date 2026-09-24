import { JAKE_TAHOE } from './jake-tahoe';
import { KYLE_KEEPY_UPPIES } from './kyle-keepy-uppies';
import { type EasterEgg } from './types';

export { disposeObject } from './parts';
export type { EasterEgg, EasterEggInstance } from './types';

// Landmarks from the stag do. Add new ones here.
const allEasterEggs: EasterEgg[] = [JAKE_TAHOE, KYLE_KEEPY_UPPIES];

// Shuffled once per page load (Fisher–Yates), then placed down the mountain
// in that order and round again, so every run in a visit shares the order.
const shuffle = <T>(items: readonly T[]): T[] => {
	const shuffled = [...items];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const swap = shuffled[i];
		shuffled[i] = shuffled[j];
		shuffled[j] = swap;
	}
	return shuffled;
};

export const EASTER_EGGS: readonly EasterEgg[] = shuffle(allEasterEggs);
