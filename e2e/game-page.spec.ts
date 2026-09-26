import { expect, test } from './fixtures';
import { advance, crash, readHud, startRun } from './hero';

test.beforeEach(async ({ page }) => {
	await page.goto('/game');
});

test('shows just the game, filling the window', async ({ page }) => {
	const hero = page.locator('#hero');
	const box = await hero.boundingBox();
	const viewport = page.viewportSize();
	expect(box).toEqual({
		x: 0,
		y: 0,
		width: viewport?.width,
		height: viewport?.height,
	});
	// None of the home page around it.
	for (const title of [
		'Elliot Lewis.',
		'Where I’ve worked',
		'What I carry',
	]) {
		await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
	}
	await expect(page.getByRole('main')).toHaveCount(0);
	await expect(page.getByRole('contentinfo')).toHaveCount(0);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		'https://elliotleelewis.com/game',
	);
});

test('plays a run from start to game over', async ({ page }) => {
	await startRun(page);
	await expect(page.locator('#hero-stage canvas')).toBeVisible();
	await advance(page, 3);
	const { metres } = await readHud(page);
	expect(metres).toBeGreaterThan(0);
	await crash(page);
});
