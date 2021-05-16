/**
 * Randomly shuffles given array
 *
 * @param array - Array to shuffle
 * @returns Shuffled array
 */
export const shuffle = <T>(array: T[]): T[] => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const [swapI, swapJ] = [array[i], array[j]];
		if (swapI !== undefined && swapJ !== undefined) {
			[array[i], array[j]] = [swapJ, swapI];
		}
	}
	return array;
};
