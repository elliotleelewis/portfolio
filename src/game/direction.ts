// Which way the page reads.
export type ReadingDirection = 'ltr' | 'rtl';

// How to mirror things across the screen to suit the reading direction: 1
// as built (left to right), or -1 to flip them.
export type Mirror = 1 | -1;

/**
 * How to mirror the scenes for a reading direction, so moving forwards (down
 * the mountain, or on to the next easter egg) goes the way the page reads.
 * @param direction - Which way the page reads.
 * @returns 1 for left to right, -1 for right to left.
 */
export const mirrorFor = (direction: ReadingDirection): Mirror =>
	direction === 'rtl' ? -1 : 1;
