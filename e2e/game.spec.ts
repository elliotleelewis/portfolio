import { expect, test } from './fixtures';
import {
	advance,
	crash,
	findUnbudgeted,
	readDrawn,
	readHud,
	readInput,
	smashEasterEgg,
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
	const { metres } = await readHud(page);
	expect(metres).toBeGreaterThan(0);
});

// What a frame can cost to draw, shadows included. The run is random, so
// this leaves room for an unlucky one: a run now peaks at about 90 calls
// (as a smashed easter egg's pieces fly) and 140k triangles. Each part's own
// budget is in src/game/draw-budget.test.ts.
const budget = { calls: 120, triangles: 175_000 };

// What a frame of the gallery can cost, from any easter egg along it.
const galleryBudget = { calls: 60, triangles: 150_000 };

test('draws a run within its budget, past the first easter egg', async ({
	page,
}) => {
	await startRun(page);
	// Every two seconds down the slope, past the first easter egg (about
	// 150m down) and before a bear's likely to have caught me.
	for (let i = 0; i < 7; i++) {
		await advance(page, 2);
		const drawn = await readDrawn(page);
		expect(drawn?.calls).toBeLessThanOrEqual(budget.calls);
		expect(drawn?.triangles).toBeLessThanOrEqual(budget.triangles);
	}
});

test("draws a smashed easter egg's pieces within its budget", async ({
	page,
}) => {
	await startRun(page);
	await smashEasterEgg(page);
	await expect
		.poll(async () =>
			page.evaluate(() => localStorage.getItem('hero-easter-egg-hits')),
		)
		.not.toBeNull();
	// While the pieces fly.
	for (let i = 0; i < 4; i++) {
		const drawn = await readDrawn(page);
		expect(drawn?.calls).toBeLessThanOrEqual(budget.calls);
		expect(drawn?.triangles).toBeLessThanOrEqual(budget.triangles);
		await advance(page, 0.25);
	}
});

test('draws nothing without a budget, in a run or a smash', async ({
	page,
}) => {
	await startRun(page);
	expect(await findUnbudgeted(page)).toEqual([]);
	// Past the first easter egg, with bears about.
	await advance(page, 10);
	expect(await findUnbudgeted(page)).toEqual([]);
	await smashEasterEgg(page);
	expect(await findUnbudgeted(page)).toEqual([]);
});

test('ends the run when a bear catches me', async ({ page }) => {
	await startRun(page);
	await crash(page);
	// Regression: the tree count and "trees" used to run together.
	await expect(page.locator('#hero-over')).toContainText(
		/You flattened \d+ trees? and rolled \d+m\./,
	);
});

test('remembers the best score from earlier visits', async ({ page }) => {
	await page.evaluate(() => {
		localStorage.setItem('hero-best-trees', '5');
	});
	await page.reload();
	await startRun(page);
	await crash(page);
	await expect(page.locator('#hero-over-best')).toHaveText(
		'Your best: 5 trees',
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
	const { metres } = await readHud(page);
	expect(metres).toBeGreaterThan(0);
});

test('goes back to the photo', async ({ page }) => {
	await startRun(page);
	await page.locator('#hero-exit').click();
	await expect(page.locator('#hero')).toHaveAttribute('data-state', 'idle');
	await expect(page.locator('#hero-play')).toBeFocused();
});

test.describe('gallery', () => {
	test.beforeEach(async ({ page }) => {
		// I've found the first two easter eggs, but not the rest.
		await page.evaluate(() => {
			localStorage.setItem(
				'hero-easter-egg-hits',
				JSON.stringify({ outhouse: 1234, jailbreak: 1 }),
			);
		});
		// Straight in from the game page's start screen, without a run first.
		// Opening it after a run has a test of its own, below.
		await page.goto('/game');
		await page.locator('#hero-start-gallery').click();
		// Opening the gallery loads and draws a whole new scene.
		await expect(page.locator('#hero')).toHaveAttribute(
			'data-mode',
			'gallery',
		);
	});

	test('draws nothing without a budget', async ({ page }) => {
		expect(await findUnbudgeted(page)).toEqual([]);
	});

	test('draws each easter egg within its budget', async ({ page }) => {
		const dots = page.locator('#hero-gallery-dots > *');
		await expect(dots).toHaveCount(7);
		for (let i = 0; i < 7; i++) {
			await dots.nth(i).click();
			// Once the camera has glided over.
			await page.waitForTimeout(300);
			const drawn = await readDrawn(page);
			expect(drawn?.calls).toBeLessThanOrEqual(galleryBudget.calls);
			expect(drawn?.triangles).toBeLessThanOrEqual(
				galleryBudget.triangles,
			);
		}
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

	test('follows a drag, then snaps to the next easter egg', async ({
		page,
	}) => {
		const caption = page.locator('#hero-gallery-caption');
		const first = await caption.textContent();
		const box = await page.locator('#hero-stage').boundingBox();
		if (!box) {
			throw new Error('The stage has no size');
		}
		const y = box.y + box.height / 3;
		await page.mouse.move(box.x + box.width * 0.8, y);
		await page.mouse.down();
		// Past halfway to the next one, so its caption shows before letting go.
		await page.mouse.move(box.x + box.width * 0.4, y, { steps: 10 });
		await expect(caption).not.toHaveText(first ?? '');
		const second = await caption.textContent();
		await page.mouse.up();
		await expect(caption).toHaveText(second ?? '');
		await expect(
			page.getByRole('button', { name: /^Easter egg 2/ }),
		).toHaveAttribute('aria-current', 'true');
	});

	test('counts my smashes, and hides the easter eggs I have not found yet', async ({
		page,
	}) => {
		const caption = page.locator('#hero-gallery-caption');
		const hint = page.locator('#hero-gallery-hint');
		await expect(caption).not.toHaveText('?????');
		await expect(hint).toHaveText('Smashed 1,234 times');

		const third = page.getByRole('button', {
			name: 'Easter egg 3, not found yet',
		});
		await third.click();
		await expect(caption).toHaveText('?????');
		await expect(hint).toHaveText(
			'Barrel into it on the trail to find out',
		);
	});
});

test.describe('while animations play', () => {
	// The HUD's regression was in a fade, so this one has to watch it play.
	test.use({ animations: 'play' });

	test('opens the gallery after a run, and hides the game HUD, even while leaving', async ({
		page,
	}) => {
		await startRun(page);
		await crash(page);
		await page.getByRole('button', { name: 'See the easter eggs' }).click();
		await expect(page.locator('#hero')).toHaveAttribute(
			'data-mode',
			'gallery',
		);
		const score = page.locator('#hero-score');
		await expect(score).toBeHidden();
		await page.locator('#hero-exit').click();
		// Regression: the HUD used to flash back up during the fade out. Watch
		// it until the fade has finished, counting anything with an opacity of
		// 0 (on it or around it) as unseen.
		const wasSeen = await page.evaluate(async () => {
			const element = document.querySelector('#hero-score');
			const start = performance.now();
			let isSeen = false;
			while (performance.now() - start < 2500) {
				isSeen ||=
					element?.checkVisibility({ opacityProperty: true }) ??
					false;
				const isFading = document
					.getAnimations()
					.some(
						(animation) =>
							animation instanceof CSSTransition &&
							animation.playState === 'running',
					);
				// A moment for the fades to begin, then done once they're over.
				if (!isFading && performance.now() - start > 100) {
					break;
				}
				await new Promise((resolve) => requestAnimationFrame(resolve));
			}
			return isSeen;
		});
		expect(wasSeen).toBe(false);
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

	test('does not zoom the page when tapping the game', async ({ page }) => {
		await startRun(page);
		await page.evaluate(() => {
			const prevented: boolean[] = [];
			Object.assign(globalThis, { touchendsPrevented: prevented });
			document.addEventListener(
				'touchend',
				(event) => {
					prevented.push(event.defaultPrevented);
				},
				{ passive: true },
			);
		});
		const box = await page.locator('#hero-stage').boundingBox();
		if (!box) {
			throw new Error('The stage has no size');
		}
		for (let i = 0; i < 2; i++) {
			await page.touchscreen.tap(box.x + 40, box.y + box.height / 2);
		}
		const prevented = await page.evaluate(
			() =>
				(globalThis as unknown as { touchendsPrevented: boolean[] })
					.touchendsPrevented,
		);
		expect(prevented).toEqual([true, true]);
		const scale = await page.evaluate(
			() => globalThis.visualViewport?.scale,
		);
		expect(scale).toBe(1);
	});

	test('lets the page scroll when dragging on the hero before playing', async ({
		page,
	}) => {
		// Whether anything under a spot in the hero stops a drag there from
		// scrolling the page.
		const blocksScrolling = async (): Promise<boolean[]> =>
			page.evaluate(() => {
				const hero = document.querySelector('#hero');
				if (!hero) {
					throw new Error('No hero');
				}
				const { left, top, width, height } =
					hero.getBoundingClientRect();
				const blocked: boolean[] = [];
				for (const fx of [0.1, 0.5, 0.9]) {
					for (const fy of [0.1, 0.5, 0.9]) {
						let element = document.elementFromPoint(
							left + width * fx,
							top + height * fy,
						);
						let isBlocked = false;
						while (element) {
							isBlocked ||=
								getComputedStyle(element).touchAction ===
								'none';
							element = element.parentElement;
						}
						blocked.push(isBlocked);
					}
				}
				return blocked;
			});

		expect(await blocksScrolling()).not.toContain(true);
		await startRun(page);
		// The game itself doesn't scroll away while I'm playing.
		expect(await blocksScrolling()).toContain(true);
		await page.locator('#hero-exit').click();
		await expect(page.locator('#hero')).toHaveAttribute(
			'data-state',
			'idle',
		);
		expect(await blocksScrolling()).not.toContain(true);
	});
});
