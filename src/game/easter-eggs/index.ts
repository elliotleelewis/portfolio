import { JAKE_TAHOE } from './jake-tahoe';
import { KYLE_KEEPY_UPPIES } from './kyle-keepy-uppies';
import { type EasterEgg } from './types';

export { disposeObject } from './parts';
export type { EasterEgg, EasterEggInstance } from './types';

// Landmarks from the stag do, placed down the mountain in this order (then
// round again). Add new ones here.
export const EASTER_EGGS: EasterEgg[] = [JAKE_TAHOE, KYLE_KEEPY_UPPIES];
