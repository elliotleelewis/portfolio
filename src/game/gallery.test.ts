// Some easter eggs paint their textures on a canvas, so these need a DOM.
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { ALL_EASTER_EGGS } from './easter-eggs';
import { GALLERY_SPACING, Gallery } from './gallery';
import { MYSTERY_CAPTION } from './mystery';

// Every easter egg, found.
const all = ALL_EASTER_EGGS.map(({ id }) => id);

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
		const gallery = new Gallery({ onSelect }, [second.id]);
		expect(gallery.locked).toEqual(
			ALL_EASTER_EGGS.map(({ id }) => id !== second.id),
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
		const gallery = new Gallery({ onSelect }, []);
		expect(gallery.locked.every(Boolean)).toBe(true);
		expect(gallery.index).toBe(0);
		expect(onSelect).toHaveBeenCalledWith(0, MYSTERY_CAPTION, true);
		run(gallery, 1);
		gallery.dispose();
	});
});
