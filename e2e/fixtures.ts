import { expect, test as base } from '@playwright/test';

export { expect } from '@playwright/test';

// Every test fails if the page throws an uncaught error.
export const test = base.extend<{ pageErrors: string[] }>({
	// Astro's dev toolbar sits at the bottom of the window, where it can cover
	// what a test clicks (the play button, on the game's own page). Tests
	// never use it, so take it away as soon as it's added.
	page: async ({ page, headless }, use) => {
		await page.addInitScript(() => {
			new MutationObserver(() => {
				document.querySelector('astro-dev-toolbar')?.remove();
			}).observe(document, { childList: true, subtree: true });
		});
		// Drawing the 3D scene is most of what the tests wait on: WebGL runs
		// on the CPU here, at a few frames a second, and every worker draws at
		// once. No test looks at the picture, so the scene is stepped and
		// rendered as usual, but WebGL's draws are dropped. A run in a window
		// still draws them, for whoever is watching.
		if (headless) {
			await page.addInitScript(() => {
				for (const name of [
					'clear',
					'drawArrays',
					'drawArraysInstanced',
					'drawElements',
					'drawElementsInstanced',
					'drawRangeElements',
				] as const) {
					Object.defineProperty(
						WebGL2RenderingContext.prototype,
						name,
						{
							value() {
								// Nothing drawn, and the canvas keeps its last picture.
							},
						},
					);
				}
			});
		}
		await use(page);
	},
	pageErrors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			page.on('pageerror', (error) => {
				errors.push(error.message);
			});
			await use(errors);
			expect(errors).toEqual([]);
		},
		{ auto: true },
	],
});
