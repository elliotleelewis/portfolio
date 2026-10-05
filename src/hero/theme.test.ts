// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { applyTheme, deviceFor, readTheme } from './theme';

describe('readTheme', () => {
	it('reads a theme', () => {
		expect(readTheme('dark')).toBe('dark');
		expect(readTheme('light')).toBe('light');
		expect(readTheme('system')).toBe('system');
	});

	it("falls back to the device's for anything else", () => {
		expect(readTheme('purple')).toBe('system');
		expect(readTheme(3)).toBe('system');
		expect(readTheme(undefined)).toBe('system');
	});
});

/**
 * A page's head, with the browser colour for each mode.
 * @returns Its root element.
 */
const page = (): HTMLElement => {
	const root = document.createElement('html');
	root.innerHTML = `
		<head>
			<meta name="theme-color" data-scheme="light" media="(prefers-color-scheme: light)" />
			<meta name="theme-color" data-scheme="dark" media="(prefers-color-scheme: dark)" />
		</head>`;
	return root;
};
/**
 * When each browser colour shows.
 * @param root - The page's root element.
 * @returns Each one's media query.
 */
const media = (root: HTMLElement): string[] =>
	[...root.querySelectorAll<HTMLMetaElement>('meta')].map(
		(meta) => meta.media,
	);

describe('applyTheme', () => {
	it('picks a theme, and the browser colour to go with it', () => {
		const root = page();
		applyTheme('dark', root);
		expect(root.dataset.theme).toBe('dark');
		expect(media(root)).toEqual(['not all', 'all']);
	});

	it("goes back to the device's", () => {
		const root = page();
		applyTheme('light', root);
		applyTheme('system', root);
		expect(root.dataset.theme).toBeUndefined();
		expect(media(root)).toEqual([
			'(prefers-color-scheme: light)',
			'(prefers-color-scheme: dark)',
		]);
	});
});

describe('deviceFor', () => {
	it('is a laptop with a mouse or trackpad, whatever the size', () => {
		expect(deviceFor(false, 390)).toBe('laptop');
		expect(deviceFor(false, 1080)).toBe('laptop');
	});

	it('is a phone or a tablet by touch, by size', () => {
		expect(deviceFor(true, 390)).toBe('phone');
		expect(deviceFor(true, 820)).toBe('tablet');
	});
});
