// The site's look: light, dark, or whichever the device is set to.
export type Theme = 'light' | 'dark' | 'system';

// What I'm browsing on, for the device's icon in the theme picker.
export type Device = 'laptop' | 'tablet' | 'phone';

export const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

/**
 * Reads a theme from storage, which could hold anything.
 * @param value - What was stored.
 * @returns The theme, or the device's if it isn't one.
 */
export const readTheme = (value: unknown): Theme =>
	THEMES.find((theme) => theme === value) ?? 'system';

/**
 * Puts the page in a theme. The inline script in src/layout/Layout.astro
 * does the same before the page draws, so keep the two in step.
 * @param theme - The theme.
 * @param root - The page's root element.
 */
export const applyTheme = (
	theme: Theme,
	root: HTMLElement = document.documentElement,
): void => {
	if (theme === 'system') {
		delete root.dataset.theme;
	} else {
		root.dataset.theme = theme;
	}
	// The browser's own colour, around the page, follows it too.
	for (const meta of root.querySelectorAll<HTMLMetaElement>(
		'meta[name="theme-color"]',
	)) {
		const { scheme } = meta.dataset;
		if (theme === 'system') {
			meta.media = `(prefers-color-scheme: ${scheme ?? 'light'})`;
		} else {
			meta.media = scheme === theme ? 'all' : 'not all';
		}
	}
};

/**
 * What I'm browsing on, from how I point and the screen's size.
 * @param isCoarse - Whether I point with a finger rather than a mouse.
 * @param shortSide - The screen's shorter side, in CSS pixels.
 * @returns A laptop (or any computer), a tablet or a phone.
 */
export const deviceFor = (isCoarse: boolean, shortSide: number): Device => {
	if (!isCoarse) {
		return 'laptop';
	}
	return shortSide < 600 ? 'phone' : 'tablet';
};
