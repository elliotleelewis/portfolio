import { test as base, expect } from '@playwright/test';

export { expect } from '@playwright/test';

// Every test fails if the page throws an uncaught error.
export const test = base.extend<{ pageErrors: string[] }>({
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
