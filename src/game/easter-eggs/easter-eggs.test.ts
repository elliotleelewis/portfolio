import { describe, expect, it } from 'vitest';

import { ALL_EASTER_EGGS, EASTER_EGGS } from '.';

describe('easter eggs', () => {
	it('each have their own id and a caption', () => {
		const ids = ALL_EASTER_EGGS.map(({ id }) => id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const { gallery } of ALL_EASTER_EGGS) {
			expect(gallery.caption.trim()).not.toBe('');
		}
	});

	it('fit inside their clearings', () => {
		for (const { clearingRadius, footprint } of ALL_EASTER_EGGS) {
			if (footprint) {
				expect(
					Math.hypot(footprint.halfWidth, footprint.halfDepth),
				).toBeLessThan(clearingRadius);
			}
		}
	});

	it('are all placed down the mountain, in a shuffled order', () => {
		expect(
			EASTER_EGGS.toSorted((a, b) => a.id.localeCompare(b.id)),
		).toEqual(ALL_EASTER_EGGS.toSorted((a, b) => a.id.localeCompare(b.id)));
	});
});
