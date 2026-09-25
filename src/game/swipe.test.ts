import { describe, expect, it } from 'vitest';

import { dragOffset, swipeStep } from './swipe';

describe('dragOffset', () => {
	it('follows the finger up to one easter egg either way', () => {
		expect(dragOffset(0.3, true, true)).toBe(0.3);
		expect(dragOffset(-0.8, true, true)).toBe(-0.8);
		expect(dragOffset(1, true, true)).toBe(1);
	});

	it('gives less and less past the next easter egg', () => {
		const a = dragOffset(1.2, true, true);
		const b = dragOffset(2, true, true);
		const c = dragOffset(10, true, true);
		expect(a).toBeGreaterThan(1);
		// Slower than the finger.
		expect(a - 1).toBeLessThan(0.1);
		expect(b).toBeGreaterThan(a);
		expect(b - 1).toBeLessThan(0.2);
		expect(c).toBeLessThan(1.25);
	});

	it('pulls against elastic past either end of the row', () => {
		expect(dragOffset(-0.5, false, true)).toBeLessThan(0);
		expect(dragOffset(-0.5, false, true)).toBeGreaterThan(-0.25);
		expect(dragOffset(0.5, true, false)).toBeGreaterThan(0);
		expect(dragOffset(0.5, true, false)).toBeLessThan(0.25);
		// The other way is still free.
		expect(dragOffset(0.5, false, true)).toBe(0.5);
	});
});

describe('swipeStep', () => {
	it('lands on the nearest easter egg after a slow drag', () => {
		expect(swipeStep(0.3, 0)).toBe(0);
		expect(swipeStep(0.6, 0)).toBe(1);
		expect(swipeStep(-0.7, 0.2)).toBe(-1);
	});

	it('moves on after a quick flick, however short', () => {
		expect(swipeStep(0.1, 2)).toBe(1);
		expect(swipeStep(-0.1, -2)).toBe(-1);
		expect(swipeStep(0, 3)).toBe(1);
	});

	it('stays put when flicked back against the drag', () => {
		expect(swipeStep(0.7, -2)).toBe(0);
		expect(swipeStep(-0.4, 2)).toBe(0);
	});

	it('never goes more than one easter egg', () => {
		expect(swipeStep(1.2, 5)).toBe(1);
	});
});
