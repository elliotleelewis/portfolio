import { type Page, expect } from '@playwright/test';

// What the stage drew in its last frame, shadows included.
interface Drawn {
	calls: number;
	triangles: number;
}

// What the end-to-end tests read of the stage's scene.
interface Drawable {
	name: string;
	type: string;
	geometry?: { type: string };
	material?: { type: string };
	visible: boolean;
	userData: { drawBudget?: unknown };
	children: Drawable[];
}

// What the site exposes on `globalThis.hero`: the game in play, and what
// drawing it costs.
interface HeroHandle {
	hero: {
		previousGame?: unknown;
		drawn?: Drawn;
		scene?: Drawable;
		game: {
			input: Record<string, boolean | number>;
			advance: (seconds: number) => void;
			catchPlayer: () => void;
			rollIntoEasterEgg: () => void;
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
	await expect(hero).toHaveAttribute('data-state', 'playing');
	await advance(page, 8);
};

/**
 * Starts a run from the game page's start screen, and gets it rolling.
 * @param page - The page, already on the game page.
 */
export const startFromStartScreen = async (page: Page): Promise<void> => {
	const start = page.locator('#hero-start');
	await expect(start).toBeEnabled();
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
 * Waits for the stage to draw a frame, then reads what drawing it cost.
 * @param page - The page with a scene in the stage.
 * @returns The frame's draw calls and triangles.
 */
export const readDrawn = async (page: Page): Promise<Drawn | undefined> =>
	page.evaluate(async () => {
		// Two frames: the first may already have been drawn before the
		// game last moved on.
		for (let i = 0; i < 2; i++) {
			await new Promise((resolve) => {
				requestAnimationFrame(resolve);
			});
		}
		return (globalThis as unknown as HeroHandle).hero.drawn;
	});

/**
 * Waits for the stage to draw a frame, then finds anything it drew that
 * isn't part of something with a drawing budget.
 * @param page - The page with a scene in the stage.
 * @returns Where each such thing is, as the types of everything above it.
 */
export const findUnbudgeted = async (page: Page): Promise<string[]> =>
	page.evaluate(async () => {
		await new Promise((resolve) => {
			requestAnimationFrame(resolve);
		});
		const drawn = new Set([
			'Mesh',
			'SkinnedMesh',
			'InstancedMesh',
			'Points',
			'Sprite',
			'Line',
			'LineSegments',
		]);
		const found: string[] = [];
		const visit = (object: Drawable, path: string[]): void => {
			if (!object.visible || object.userData.drawBudget !== undefined) {
				return;
			}
			const here = [...path, object.name || object.type];
			if (drawn.has(object.type)) {
				// What it is, so it's easy to find.
				const { geometry, material } = object;
				const what = [geometry?.type, material?.type].filter(Boolean);
				found.push(`${here.join(' > ')} (${what.join(', ')})`);
			}
			for (const child of object.children) {
				visit(child, here);
			}
		};
		const { scene } = (globalThis as unknown as HeroHandle).hero;
		if (!scene) {
			throw new Error('Nothing in the stage to check');
		}
		visit(scene, []);
		return found;
	});

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
 * Rolls me straight into the next easter egg, smashing it.
 * @param page - The page with a run in progress.
 */
export const smashEasterEgg = async (page: Page): Promise<void> => {
	await page.evaluate(() => {
		(globalThis as unknown as HeroHandle).hero.game.rollIntoEasterEgg();
	});
	await advance(page, 1 / 30);
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
	await page.waitForFunction(() => {
		const handle = globalThis as unknown as HeroHandle;
		return handle.hero.game !== handle.hero.previousGame;
	});
};
