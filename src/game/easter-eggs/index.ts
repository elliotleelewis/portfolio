import { ANTHONY_OUTHOUSE } from './anthony-outhouse';
import { HECTOR_JAILBREAK } from './hector-jailbreak';
import { JAKE_TAHOE } from './jake-tahoe';
import { KEVIN_MONEY_RAIN } from './kevin-money-rain';
import { KYLE_KEEPY_UPPIES } from './kyle-keepy-uppies';
import { TOMMY_BATTLESTATION } from './tommy-battlestation';
import { TYLER_WOOD_STOVE } from './tyler-wood-stove';
import { type EasterEgg } from './types';

export { disposeObject } from './parts';
export type { EasterEgg, EasterEggInstance, EasterEggShowcase } from './types';

// Landmarks from the stag do, alphabetically by name (the gallery's order).
// Add new ones here.
export const ALL_EASTER_EGGS: readonly EasterEgg[] = [
	ANTHONY_OUTHOUSE,
	HECTOR_JAILBREAK,
	JAKE_TAHOE,
	KEVIN_MONEY_RAIN,
	KYLE_KEEPY_UPPIES,
	TOMMY_BATTLESTATION,
	TYLER_WOOD_STOVE,
].toSorted((a, b) => a.gallery.name.localeCompare(b.gallery.name));

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
