import type { ReadingDirection } from '../game/direction';

/**
 * Which way the page reads, from its `dir`.
 * @returns 'rtl' for right to left, otherwise 'ltr'.
 */
export const readingDirection = (): ReadingDirection =>
	globalThis.getComputedStyle(globalThis.document.documentElement)
		.direction === 'rtl'
		? 'rtl'
		: 'ltr';
