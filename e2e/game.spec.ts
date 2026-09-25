import { expect, test } from './fixtures';
import {
	advance,
	crash,
	readHud,
	readInput,
	startNewRun,
	startRun,
} from './hero';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
});

test('fades from the photo into a run down the mountain', async ({ page }) => {
	await startRun(page);
	await expect(page.locator('#hero-stage canvas')).toBeVisible();
	await expect(page.locator('#hero-hint')).toHaveAttribute('data-show', '');
	await advance(page, 3);
	expect((await readHud(page)).metres).toBeGreaterThan(0);
});

test('ends the run when a bear catches me', async ({ page }) => {
	await startRun(page);
	await crash(page);
	// Regression: the tree count and "trees" used to run together.
	await expect(page.locator('#hero-over')).toContainText(
		/You flattened \d+ trees? and rolled \d+m\./,
	);
});

test('rolls again from the game-over card', async ({ page }) => {
	await startRun(page);
	await crash(page);
	await startNewRun(page, async () => {
		await page.locator('#hero-again').click();
	});
	await expect(page.locator('#hero-over')).not.toHaveAttribute(
		'data-show',
		'',
	);
	await advance(page, 4);
	expect((await readHud(page)).metres).toBeGreaterThan(0);
});

test('goes back to the photo', async ({ page }) => {
	await startRun(page);
	await page.locator('#hero-exit').click();
	await expect(page.locator('#hero')).toHaveAttribute('data-state', 'idle');
	await expect(page.locator('#hero-play')).toBeFocused();
});

test.describe('gallery', () => {
	test.beforeEach(async ({ page }) => {
		await startRun(page);
		await crash(page);
		await page.getByRole('button', { name: 'See the easter eggs' }).click();
		// Opening the gallery loads and draws a whole new scene.
		await expect(page.locator('#hero')).toHaveAttribute(
			'data-mode',
			'gallery',
			{
				timeout: 60_000,
			},
		);
	});

	test('steps through every easter egg', async ({ page }) => {
		const caption = page.locator('#hero-gallery-caption');
		const dots = page.locator('#hero-gallery-dots > *');
		await expect(dots).toHaveCount(7);
		const first = await caption.textContent();
		expect(first?.trim()).toBeTruthy();
		await page.locator('#hero-gallery-next').click();
		await expect(caption).not.toHaveText(first ?? '');
		await page.locator('#hero-gallery-prev').click();
		await expect(caption).toHaveText(first ?? '');
	});

	test('hides the game HUD, even while leaving', async ({ page }) => {
		const score = page.locator('#hero-score');
		await expect(score).toBeHidden();
		await page.locator('#hero-exit').click();
		// Regression: the HUD used to flash back up during the fade out.
		for (let i = 0; i < 10; i++) {
			await expect(score).toBeHidden({ timeout: 0 });
			await page.waitForTimeout(150);
		}
	});
});

test.describe('on a desktop', () => {
	test.skip(({ isMobile }) => isMobile, 'Keyboard controls');

	test('steers and changes speed with the arrow keys', async ({ page }) => {
		await startRun(page);
		await page.keyboard.down('ArrowLeft');
		expect(await readInput(page, 'left')).toBe(true);
		await page.keyboard.up('ArrowLeft');
		expect(await readInput(page, 'left')).toBe(false);
		await page.keyboard.down('ArrowUp');
		expect(await readInput(page, 'faster')).toBe(true);
		await page.keyboard.up('ArrowUp');
	});

	test('has no on-screen stick', async ({ page }) => {
		await startRun(page);
		await expect(page.locator('#hero-stick')).toBeHidden();
	});
});

test.describe('on a phone', () => {
	test.skip(({ isMobile }) => !isMobile, 'Touch controls');

	test('steers and changes speed with the stick', async ({ page }) => {
		await startRun(page);
		const stick = page.locator('#hero-stick');
		await expect(stick).toBeVisible();
		const box = await stick.boundingBox();
		if (!box) {
			throw new Error('The stick has no size');
		}
		const x = box.x + box.width / 2;
		const y = box.y + box.height / 2;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + 200, y);
		expect(await readInput(page, 'steer')).toBeCloseTo(1);
		await page.mouse.move(x, y - 200);
		expect(await readInput(page, 'throttle')).toBeCloseTo(1);
		await page.mouse.up();
		expect(await readInput(page, 'steer')).toBe(0);
		expect(await readInput(page, 'throttle')).toBe(0);
	});

	test('does not zoom the page when tapping to steer', async ({ page }) => {
		await startRun(page);
		await page.evaluate(() => {
			const prevented: boolean[] = [];
			Object.assign(globalThis, { __prevented: prevented });
			document.addEventListener('touchend', (event) => {
				prevented.push(event.defaultPrevented);
			});
		});
		const box = await page.locator('#hero-stage').boundingBox();
		if (!box) {
			throw new Error('The stage has no size');
		}
		for (let i = 0; i < 2; i++) {
			await page.touchscreen.tap(box.x + 40, box.y + box.height / 2);
		}
		expect(
			await page.evaluate(
				() =>
					(globalThis as unknown as { __prevented: boolean[] })
						.__prevented,
			),
		).toEqual([true, true]);
		expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
	});
});
