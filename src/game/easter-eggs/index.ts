import { shuffle } from '../shuffle';

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

// Shuffled once per page load, then placed down the mountain in that order
// and round again, so every run in a visit shares the order.
export const EASTER_EGGS: readonly EasterEgg[] = shuffle(ALL_EASTER_EGGS);
