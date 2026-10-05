// Picking initials for the leaderboard, like on an arcade cabinet. The
// Function decides which initials the board takes (functions/_lib/
// initials.ts); this is only for picking them.

// What each of the three initials can be, in the order ▲ and ▼ step
// through them.
export const INITIAL_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const INITIALS_LENGTH = 3;

const initialsPattern = /^[A-Z0-9]{3}$/;

/**
 * The character before or after one, wrapping round from 9 to A.
 * @param character - One initial.
 * @param delta - 1 for the next character, -1 for the one before.
 * @returns The new initial.
 */
export const stepCharacter = (character: string, delta: number): string => {
	const count = INITIAL_CHARACTERS.length;
	const index = Math.max(INITIAL_CHARACTERS.indexOf(character), 0);
	return INITIAL_CHARACTERS.charAt((index + (delta % count) + count) % count);
};

/**
 * Reads initials from storage, which could hold anything.
 * @param value - What was stored.
 * @returns The initials, or AAA (where an arcade cabinet starts) if they
 * aren't any.
 */
export const readInitials = (value: unknown): string =>
	typeof value === 'string' && initialsPattern.test(value) ? value : 'AAA';
