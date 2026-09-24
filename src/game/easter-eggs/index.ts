import { BATTLESTATION } from './battlestation';
import { JAILBREAK } from './jailbreak';
import { KEEPY_UPPIES } from './keepy-uppies';
import { MONEY_RAIN } from './money-rain';
import { OUTHOUSE } from './outhouse';
import { TAHOE_READER } from './tahoe-reader';
import { type EasterEgg } from './types';
import { WOOD_STOVE } from './wood-stove';

export { disposeObject } from './parts';
export type { EasterEgg, EasterEggInstance, EasterEggShowcase } from './types';

// Landmarks from the stag do, in gallery order. Add new ones here.
export const ALL_EASTER_EGGS: readonly EasterEgg[] = [
	OUTHOUSE,
	JAILBREAK,
	TAHOE_READER,
	MONEY_RAIN,
	KEEPY_UPPIES,
	BATTLESTATION,
	WOOD_STOVE,
];

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

export const EASTER_EGGS: readonly EasterEgg[] = shuffle(ALL_EASTER_EGGS);
