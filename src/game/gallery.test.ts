// Some easter eggs paint their textures on a canvas, so these need a DOM.
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { ALL_EASTER_EGGS } from './easter-eggs';
import { GALLERY_SPACING, Gallery } from './gallery';
import { MYSTERY_CAPTION } from './mystery';

// Every easter egg, found.
const all = Object.fromEntries(ALL_EASTER_EGGS.map(({ id }) => [id, 1]));

/**
 * Runs the gallery for a while.
 * @param gallery - The gallery.
 * @param seconds - How long.
 */
const run = (gallery: Gallery, seconds: number): void => {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		gallery.step(1 / 60);
	}
};

/**
 * A gallery of found easter eggs, settled on the first, ready to drag.
 * @returns The gallery, and what it has told the hero since settling.
 */
const setUpDrag = () => {
	const onSelect = vi.fn();
	const gallery = new Gallery({ onSelect }, all);
	gallery.resize(1600, 900);
	run(gallery, 2);
	onSelect.mockClear();
	return { gallery, onSelect };
};

describe('Gallery', () => {
	it('lines every easter egg up in a row, starting at the first', () => {
		const onSelect = vi.fn();
		const gallery = new Gallery({ onSelect }, all);
		expect(gallery.count).toBe(ALL_EASTER_EGGS.length);
		expect(gallery.easterEggs.children).toHaveLength(gallery.count);
		expect(onSelect).toHaveBeenCalledWith(
			0,
			ALL_EASTER_EGGS[0].gallery.caption,
			false,
		);
		gallery.dispose();
	});

	it('wraps round both ends of the row', () => {
		const onSelect = vi.fn();
		const gallery = new Gallery({ onSelect }, all);
		gallery.previous();
		expect(gallery.index).toBe(gallery.count - 1);
		gallery.next();
		expect(gallery.index).toBe(0);
		gallery.select(-1);
		expect(gallery.index).toBe(gallery.count - 1);
		gallery.dispose();
	});

	it('glides the camera over to the chosen easter egg', () => {
		const gallery = new Gallery({ onSelect: vi.fn() }, all);
		gallery.resize(1600, 900);
		const index = 1;
		gallery.select(index);
		run(gallery, 4);
		const x = index * GALLERY_SPACING;
		expect(Math.abs(gallery.focus.x - x)).toBeLessThan(3);
		expect(Math.abs(gallery.camera.position.x - x)).toBeLessThan(
			GALLERY_SPACING / 2,
		);
		gallery.dispose();
	});

	it('hides the easter eggs I have not found behind a mystery', () => {
		const onSelect = vi.fn();
		const [first, second] = ALL_EASTER_EGGS;
		const gallery = new Gallery({ onSelect }, { [second.id]: 3 });
		expect(gallery.hits).toEqual(
			ALL_EASTER_EGGS.map(({ id }) => (id === second.id ? 3 : 0)),
		);
		// Starts at the one I've found.
		expect(gallery.index).toBe(1);
		expect(onSelect).toHaveBeenLastCalledWith(
			1,
			second.gallery.caption,
			false,
		);
		gallery.select(0);
		expect(onSelect).toHaveBeenLastCalledWith(0, MYSTERY_CAPTION, true);
		expect(onSelect).not.toHaveBeenCalledWith(
			0,
			first.gallery.caption,
			expect.anything(),
		);
		gallery.dispose();
	});

	it('starts at the first easter egg when none are found yet', () => {
		const onSelect = vi.fn();
		const gallery = new Gallery({ onSelect }, {});
		expect(gallery.hits.every((hits) => hits === 0)).toBe(true);
		expect(gallery.index).toBe(0);
		expect(onSelect).toHaveBeenCalledWith(0, MYSTERY_CAPTION, true);
		run(gallery, 1);
		gallery.dispose();
	});

	it('runs the row right to left for right-to-left pages', () => {
		const gallery = new Gallery({ onSelect: vi.fn() }, all, 'rtl');
		gallery.resize(1600, 900);
		gallery.select(1);
		run(gallery, 4);
		expect(gallery.focus.x).toBeLessThan(-GALLERY_SPACING / 2);
		gallery.dispose();
	});

	describe('dragging', () => {
		it('pulls the camera along with the finger', () => {
			const { gallery } = setUpDrag();
			const start = gallery.focus.x;
			gallery.drag(0.3);
			run(gallery, 1);
			// About halfway to the next easter egg.
			expect(gallery.focus.x - start).toBeGreaterThan(
				GALLERY_SPACING * 0.4,
			);
			expect(gallery.focus.x - start).toBeLessThan(GALLERY_SPACING * 0.6);
			gallery.dispose();
		});

		it('keeps the easter egg under the finger as a drag sets off', () => {
			const { gallery } = setUpDrag();
			const start = gallery.focus.x;
			// A tenth of the way to the next one.
			gallery.drag(0.06);
			run(gallery, 1);
			const moved = gallery.focus.x - start;
			expect(moved).toBeGreaterThan(0);
			// Far less than a tenth of the way along the row.
			expect(moved).toBeLessThan(GALLERY_SPACING * 0.05);
			gallery.dispose();
		});

		it('shows the next caption past halfway, and lands on it', () => {
			const { gallery, onSelect } = setUpDrag();
			const [, second] = ALL_EASTER_EGGS;
			const atSecond = () =>
				gallery.easterEggs.children.find(
					({ position }) => position.x === GALLERY_SPACING,
				);
			const before = atSecond();
			gallery.drag(0.18);
			expect(onSelect).not.toHaveBeenCalled();
			gallery.drag(0.42);
			expect(onSelect).toHaveBeenLastCalledWith(
				1,
				second.gallery.caption,
				false,
			);
			// Only once it lands does the easter egg start its moment over.
			expect(atSecond()).toBe(before);
			gallery.release(0);
			expect(gallery.index).toBe(1);
			expect(atSecond()).not.toBe(before);
			gallery.dispose();
		});

		it('springs back after a short, slow drag', () => {
			const { gallery, onSelect } = setUpDrag();
			const [first] = ALL_EASTER_EGGS;
			gallery.drag(0.36);
			gallery.drag(0.18);
			gallery.release(0.1);
			expect(gallery.index).toBe(0);
			expect(onSelect).toHaveBeenLastCalledWith(
				0,
				first.gallery.caption,
				false,
			);
			gallery.dispose();
		});

		it('moves on after a flick, however short', () => {
			const { gallery } = setUpDrag();
			gallery.drag(0.06);
			gallery.release(3);
			expect(gallery.index).toBe(1);
			gallery.dispose();
		});

		it('moves at most one easter egg a swipe', () => {
			const { gallery } = setUpDrag();
			gallery.drag(3);
			gallery.release(10);
			expect(gallery.index).toBe(1);
			gallery.dispose();
		});

		it('stays put when pulled past the start of the row', () => {
			const { gallery, onSelect } = setUpDrag();
			gallery.drag(-0.6);
			expect(onSelect).not.toHaveBeenCalled();
			gallery.release(-5);
			expect(gallery.index).toBe(0);
			gallery.dispose();
		});

		it('ignores letting go without a drag', () => {
			const { gallery, onSelect } = setUpDrag();
			gallery.release(5);
			expect(gallery.index).toBe(0);
			expect(onSelect).not.toHaveBeenCalled();
			gallery.dispose();
		});
	});
});
