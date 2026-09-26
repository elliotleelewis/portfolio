import { expect, test } from './fixtures';
import { advance, crash, readHud, startFromStartScreen } from './hero';

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
	// None of the home page around it, and no photo.
	for (const title of [
		'Elliot Lewis.',
		'Where I’ve worked',
		'What I carry',
	]) {
		await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
	}
	await expect(page.getByRole('main')).toHaveCount(0);
	await expect(page.getByRole('contentinfo')).toHaveCount(0);
	await expect(page.locator('#hero-play')).toHaveCount(0);
	await expect(page.locator('#hero img')).toHaveCount(0);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		'https://elliotleelewis.com/game',
	);
});

test('waits on its start screen, over the game, until I start', async ({
	page,
}) => {
	await expect(
		page.getByRole('heading', { name: 'The quick way down' }),
	).toBeVisible();
	await expect(page.locator('#hero-start')).toBeEnabled({ timeout: 60_000 });
	await expect(page.locator('#hero-stage canvas')).toBeVisible();
	await expect(page.locator('#hero-start')).toBeFocused();
	// However long it waits, the run doesn't start on its own.
	await advance(page, 20);
	const { metres } = await readHud(page);
	expect(metres).toBe(0);
	await expect(page.locator('#hero-exit')).toBeHidden();

	await startFromStartScreen(page);
	await expect(page.locator('#hero-exit')).toHaveText('Back to the start ✕');
	await advance(page, 3);
	const rolled = await readHud(page);
	expect(rolled.metres).toBeGreaterThan(0);
});

test('goes back to the start screen after a run', async ({ page }) => {
	await startFromStartScreen(page);
	await crash(page);
	const back = page.locator('#hero-over-exit');
	await expect(back).toHaveText('Back to the start');
	await back.click();
	await expect(page.locator('#hero-start-screen')).toHaveAttribute(
		'data-show',
		'',
	);
	await expect(page.locator('#hero-over')).not.toHaveAttribute('data-show');
	// A fresh run, ready to go again.
	await startFromStartScreen(page);
	await advance(page, 3);
	const rolled = await readHud(page);
	expect(rolled.metres).toBeGreaterThan(0);
});

test('goes back to the start screen from a run in progress', async ({
	page,
}) => {
	await startFromStartScreen(page);
	await page.locator('#hero-exit').click();
	await expect(page.locator('#hero-start')).toBeEnabled();
	await expect(page.locator('#hero-start-screen')).toHaveAttribute(
		'data-show',
		'',
	);
});

test('shows my best run on the start screen', async ({ page }) => {
	// Kept from an earlier visit. Regression: reading it straight away made
	// the page not match what the server rendered.
	await page.evaluate(() => {
		localStorage.setItem('hero-best-trees', '12');
	});
	await page.reload();
	await expect(page.locator('#hero-start-best')).toHaveText(
		'Your best: 12 trees',
	);
});

test('opens the easter eggs from the start screen', async ({ page }) => {
	await expect(page.locator('#hero-start-gallery')).toBeEnabled({
		timeout: 60_000,
	});
	await page.locator('#hero-start-gallery').click();
	await expect(page.locator('#hero')).toHaveAttribute('data-mode', 'gallery');
	await expect(page.locator('#hero-start-screen')).not.toHaveAttribute(
		'data-show',
	);
	await expect(page.locator('#hero-gallery-caption')).not.toBeEmpty();
});
