/**
 * A shuffled copy of a list (Fisher–Yates).
 * @param items - The list to shuffle.
 * @param random - Source of randomness in [0, 1).
 * @returns A new list with the same items in a random order.
 */
export const shuffle = <T>(
	items: readonly T[],
	random: () => number = Math.random,
): T[] => {
	const shuffled = [...items];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		const swap = shuffled[i];
		shuffled[i] = shuffled[j];
		shuffled[j] = swap;
	}
	return shuffled;
};
