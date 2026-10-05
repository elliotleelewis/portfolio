import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { startRun } from './hero';

test.use({ colorScheme: 'light' });

/**
 * The page's background colour.
 * @param page - The page.
 * @returns Its colour, as the browser computes it.
 */
const background = (page: Page): Promise<string> =>
	page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('picks a theme for the whole site, and keeps it', async ({ page }) => {
	await page.goto('/');
	const picker = page.getByRole('group', { name: 'Theme' });
	await expect(
		picker.getByRole('radio', { name: 'Match my device' }),
	).toBeChecked();
	const light = await background(page);

	await picker.getByTitle('Dark').click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect.poll(() => background(page)).not.toBe(light);
	const dark = await background(page);

	// Still dark on the next page, from the first frame.
	await page.goto('/game');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect(await background(page)).toBe(dark);
	await expect(
		page
			.getByRole('group', { name: 'Theme' })
			.getByRole('radio', { name: 'Dark' }),
	).toBeChecked();

	await page
		.getByRole('group', { name: 'Theme' })
		.getByTitle('Match my device')
		.click();
	await expect(page.locator('html')).not.toHaveAttribute('data-theme');
	await expect.poll(() => background(page)).toBe(light);
});

test("shows the device's theme as the device I'm on", async ({
	page,
	isMobile,
}) => {
	await page.goto('/');
	await expect(page.locator('#hero-theme')).toHaveAttribute(
		'data-device',
		isMobile ? 'phone' : 'laptop',
	);
});

test('gets out of the way during a run', async ({ page }) => {
	await page.goto('/');
	const picker = page.locator('#hero-theme');
	await expect(picker).toBeVisible();
	await startRun(page);
	await expect(picker).toBeHidden();
});

test("is there on the game page's start screen", async ({ page }) => {
	await page.goto('/game');
	await expect(page.locator('#hero-start')).toBeEnabled();
	await expect(page.locator('#hero-theme')).toBeVisible();
});
