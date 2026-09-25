// Hits closer together than this, in seconds, build a combo.
export const COMBO_WINDOW = 1.5;

/**
 * The combo after flattening another tree: one more if it came quickly
 * after the last, otherwise starting again from one.
 * @param combo - The combo so far.
 * @param sinceLastHit - Seconds since the previous tree went down.
 * @returns The new combo, which is also the points this tree is worth.
 */
export const nextCombo = (combo: number, sinceLastHit: number): number =>
	sinceLastHit < COMBO_WINDOW ? combo + 1 : 1;

/**
 * Bonus points for bears blasted by one smashed easter egg: 5 a bear, times
 * again by how many went at once.
 * @param bears - How many bears the blast caught.
 * @returns The bonus.
 */
export const bearBlastPoints = (bears: number): number => 5 * bears * bears;
