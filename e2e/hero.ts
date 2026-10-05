import { type Page, expect } from '@playwright/test';

// What the site exposes on `globalThis.hero`: the game in play.
interface HeroHandle {
	hero: {
		previousGame?: unknown;
		game: {
			input: Record<string, boolean | number>;
			advance: (seconds: number) => void;
			catchPlayer: () => void;
		};
	};
}

/**
 * Starts a run from the photo and skips the intro.
 * @param page - The page, already on the home page.
 */
export const startRun = async (page: Page): Promise<void> => {
	const hero = page.locator('#hero');
	await page.locator('#hero-play').click();
	await expect(hero).toHaveAttribute('data-state', 'playing', {
		timeout: 60_000,
	});
	await advance(page, 8);
};

/**
 * Starts a run from the game page's start screen, and gets it rolling.
 * @param page - The page, already on the game page.
 */
export const startFromStartScreen = async (page: Page): Promise<void> => {
	const start = page.locator('#hero-start');
	await expect(start).toBeEnabled({ timeout: 60_000 });
	await start.click();
	await expect(page.locator('#hero-start-screen')).not.toHaveAttribute(
		'data-show',
	);
	await advance(page, 4);
};

/**
 * Runs the game forward, faster than real time.
 * @param page - The page with a run in progress.
 * @param seconds - Game time to simulate.
 */
export const advance = async (page: Page, seconds: number): Promise<void> => {
	await page.evaluate((s) => {
		(globalThis as unknown as HeroHandle).hero.game.advance(s);
	}, seconds);
};

/**
 * Ends the run as though a bear got me, and waits for the game-over card.
 * @param page - The page with a run in progress.
 */
export const crash = async (page: Page): Promise<void> => {
	await page.evaluate(() => {
		(globalThis as unknown as HeroHandle).hero.game.catchPlayer();
	});
	await advance(page, 3);
	await expect(page.locator('#hero-over')).toHaveAttribute('data-show', '');
};

/**
 * Reads one of the game's inputs.
 * @param page - The page with a run in progress.
 * @param name - The input, e.g. `left` or `steer`.
 * @returns Its current value.
 */
export const readInput = async (
	page: Page,
	name: string,
): Promise<boolean | number | undefined> =>
	page.evaluate(
		(key) => (globalThis as unknown as HeroHandle).hero.game.input[key],
		name,
	);

/**
 * Reads the numbers on the HUD.
 * @param page - The page with a run in progress.
 * @returns Trees flattened and metres rolled.
 */
export const readHud = async (
	page: Page,
): Promise<{ trees: number; metres: number }> => ({
	trees: Number(await page.locator('#hero-score').textContent()),
	metres: Number(await page.locator('#hero-distance').textContent()),
});

/**
 * Does something that starts a fresh run (like "Roll again"), and waits for
 * the new game to replace the old one.
 * @param page - The page with a run in progress.
 * @param action - What starts the new run.
 */
export const startNewRun = async (
	page: Page,
	action: () => Promise<void>,
): Promise<void> => {
	await page.evaluate(() => {
		const handle = globalThis as unknown as HeroHandle;
		handle.hero.previousGame = handle.hero.game;
	});
	await action();
	await page.waitForFunction(
		() => {
			const handle = globalThis as unknown as HeroHandle;
			return handle.hero.game !== handle.hero.previousGame;
		},
		undefined,
		{ timeout: 60_000 },
	);
};

/**
 * Makes every random roll come up high, from when the page loads: the trees
 * all grow beside my lane, and no bear ever climbs one. A long fast-forward
 * can't then end early with a bear catching me.
 * @param page - The page, before it loads.
 */
export const keepBearsAway = async (page: Page): Promise<void> => {
	await page.addInitScript(() => {
		Math.random = () => 0.99;
	});
};
