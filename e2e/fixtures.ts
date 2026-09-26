import { test as base, expect } from '@playwright/test';

export { expect } from '@playwright/test';

// Every test fails if the page throws an uncaught error.
export const test = base.extend<{ pageErrors: string[] }>({
	// Astro's dev toolbar sits at the bottom of the window, where it can cover
	// what a test clicks (the play button, on the game's own page). Tests
	// never use it, so take it away as soon as it's added.
	page: async ({ page }, use) => {
		await page.addInitScript(() => {
			new MutationObserver(() => {
				document.querySelector('astro-dev-toolbar')?.remove();
			}).observe(document, { childList: true, subtree: true });
		});
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
