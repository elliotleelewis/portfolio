import { expect, test } from './fixtures';

test('shows the intro and every section', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Elliot Lewis.',
	);
	for (const title of [
		'Where I’ve worked',
		'What I carry',
		'Where it started',
	]) {
		await expect(page.getByRole('heading', { name: title })).toBeVisible();
	}
});

test('opens social links in a new tab', async ({ page }) => {
	await page.goto('/');
	const links = page
		.getByRole('list', { name: 'Find me elsewhere' })
		.getByRole('link');
	await expect(links).not.toHaveCount(0);
	const all = await links.all();
	for (const link of all) {
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', /noopener/);
	}
});

test('has icons for tabs and home screens', async ({ page, request }) => {
	await page.goto('/');
	for (const selector of [
		'link[rel="icon"]',
		'link[rel="apple-touch-icon"]',
	]) {
		const href = await page.locator(selector).getAttribute('href');
		expect(href).toBeTruthy();
		const response = await request.get(href ?? '');
		expect(response.ok()).toBe(true);
	}
});

test('loads without errors', async ({ page }) => {
	// The fixture fails the test on any uncaught error.
	await page.goto('/');
	await page.waitForLoadState('networkidle');
});
