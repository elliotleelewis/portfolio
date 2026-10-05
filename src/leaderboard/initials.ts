// What each of the three initials can be, in the order ▲ and ▼ step
// through them, like an arcade cabinet's.
export const INITIAL_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const INITIALS_LENGTH = 3;

const initialsPattern = /^[A-Z0-9]{3}$/;

// Digits that read as letters, so "A55" can't sneak past as "ASS".
const lookalikes: Record<string, string> = {
	'0': 'O',
	'1': 'I',
	'3': 'E',
	'4': 'A',
	'5': 'S',
	'6': 'G',
	'7': 'T',
	'8': 'B',
	'9': 'G',
};

// Initials that would put something rude on the board, after swapping
// lookalike digits for letters.
const blocked = new Set([
	'ASS',
	'CUM',
	'CNT',
	'COK',
	'DIC',
	'DIK',
	'FAG',
	'FCK',
	'FUC',
	'FUK',
	'FUQ',
	'JIZ',
	'KKK',
	'KYS',
	'NAZ',
	'NGA',
	'NGR',
	'NIG',
	'PIS',
	'PNS',
	'SEX',
	'SHT',
	'TIT',
	'VAG',
	'WNK',
	'XXX',
]);

/**
 * Whether something is three initials the board accepts: capital letters
 * and digits only.
 * @param value - What to check.
 * @returns True for initials like "ELL" or "R2D".
 */
export const isInitials = (value: unknown): value is string =>
	typeof value === 'string' && initialsPattern.test(value);

/**
 * Whether initials would put something rude on the board.
 * @param initials - Three initials.
 * @returns True if they're not allowed.
 */
export const isBlocked = (initials: string): boolean => {
	const read = initials.replaceAll(
		/\d/g,
		(digit) => lookalikes[digit] ?? digit,
	);
	return blocked.has(initials) || blocked.has(read);
};

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
	isInitials(value) ? value : 'AAA';
