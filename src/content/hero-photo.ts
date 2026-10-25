import type { ImageMetadata } from 'astro';

// Phones are narrower than the hero is tall, so the photo is cropped to a
// strip down its middle. They get that strip on its own, a third narrower.
// It's wider than any phone's hero (about 0.55 wide for each 1 tall), so it
// still covers it.
const phoneShape = 0.6;

// The breakpoint between them: Tailwind's `sm`, where the hero's padding
// changes too.
export const PHONE_MEDIA = '(max-width: 639px)';
export const WIDE_MEDIA = '(min-width: 640px)';

interface PhotoOptions {
	src: ImageMetadata;
	format: 'avif' | 'webp';
	widths: number[];
	width?: number;
	height?: number;
	fit?: 'cover';
	position?: 'center';
}

interface HeroPhoto {
	phone: PhotoOptions;
	wide: PhotoOptions;
	fallback: PhotoOptions;
	phoneSizes: string;
	wideSizes: string;
}

/**
 * The hero photo's `getImage` options at each size, for the hero and for
 * the page's preload, so both ask for the same files.
 *
 * The photo covers the hero, so it's drawn at whichever is wider: the
 * hero's width, or its height (85svh, at least 30rem) times the photo's
 * shape. The width is the page's (at most 72rem, less its padding of 1rem,
 * or 2rem from 640px up). Update them if the hero's layout changes.
 * @param photo - The photo.
 * @returns The options for each image, and their sizes.
 */
export const heroPhoto = (photo: ImageMetadata): HeroPhoto => {
	const phoneWidth = Math.round(photo.height * phoneShape);
	const shape = photo.width / photo.height;
	return {
		phone: {
			src: photo,
			format: 'avif',
			width: phoneWidth,
			height: photo.height,
			widths: [480, 640, 800, 960, phoneWidth],
			fit: 'cover',
			position: 'center',
		},
		wide: {
			src: photo,
			format: 'avif',
			widths: [960, 1280, photo.width],
		},
		fallback: {
			src: photo,
			format: 'webp',
			widths: [640, 960, 1280, photo.width],
		},
		phoneSizes: `max(100vw - 32px, ${String(85 * phoneShape)}vh, ${String(480 * phoneShape)}px)`,
		wideSizes: `max(min(100vw, 1152px) - 64px, ${String(Math.ceil(85 * shape * 10) / 10)}vh, ${String(Math.ceil(480 * shape))}px)`,
	};
};
