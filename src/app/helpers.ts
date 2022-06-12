import type { EasingLogic } from 'ngx-page-scroll-core';

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

/**
 * Easing function for scroll behaviour
 *
 * @param t - current time
 * @param b - beginning value
 * @param c - change in value
 * @param d - duration
 * @returns scroll position
 */
export const easeInOut: EasingLogic = (t, b, c, d) => {
	t /= d / 2;
	if (t < 1) {
		return (c / 2) * t * t + b;
	}
	t--;
	return (-c / 2) * (t * (t - 2) - 1) + b;
};
