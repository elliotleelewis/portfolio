import {
	RegExpMatcher,
	englishDataset,
	englishRecommendedTransformers,
} from 'obscenity';
import * as z from 'zod/mini';

// Three initials the board accepts: capital letters and digits only, like
// "ELL" or "R2D".
export const INITIALS = z.string().check(z.regex(/^[A-Z0-9]{3}$/));

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

/**
 * Whether something is three initials the board accepts.
 * @param value - What to check.
 * @returns True for initials like "ELL" or "R2D".
 */
export const isInitials = (value: unknown): value is string =>
	INITIALS.safeParse(value).success;

// Finds rude words, from obscenity's English list, however they're spelled.
const matcher = new RegExpMatcher({
	...englishDataset.build(),
	...englishRecommendedTransformers,
});

/**
 * Reads the extra initials to turn away, from the `blockedInitials` secret:
 * three-letter abbreviations and slurs that word lists miss. It's kept out
 * of the repo, and set on the Pages project.
 * @param list - The secret: initials separated by commas.
 * @returns The initials, in capitals.
 */
export const readBlocked = (list = ''): ReadonlySet<string> =>
	new Set(
		list
			.split(',')
			.map((initials) => initials.trim().toUpperCase())
			.filter((initials) => isInitials(initials)),
	);

/**
 * Whether initials would put something rude on the board.
 * @param initials - Three initials.
 * @param blocked - Extra initials to turn away (see `readBlocked`).
 * @returns True if they're not allowed.
 */
export const isBlocked = (
	initials: string,
	blocked: ReadonlySet<string> = new Set(),
): boolean => {
	const read = initials.replaceAll(
		/\d/g,
		(digit) => lookalikes[digit] ?? digit,
	);
	return [initials, read].some(
		(spelling) => blocked.has(spelling) || matcher.hasMatch(spelling),
	);
};
