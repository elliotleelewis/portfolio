/**
 * Randomly shuffles given array
 *
 * @param array - Array to shuffle
 * @param randomFn - Function for generating random numbers (defaults to "Math.random")
 * @returns Shuffled array
 */
export const shuffle = <T>(
	array: T[],
	randomFn: () => number = Math.random,
): T[] => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(randomFn() * (i + 1));
		const [swapI, swapJ] = [array[i], array[j]];
		if (swapI !== undefined && swapJ !== undefined) {
			[array[i], array[j]] = [swapJ, swapI];
		}
	}
	return array;
};
