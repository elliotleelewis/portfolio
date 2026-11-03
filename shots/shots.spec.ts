import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { type Page, expect, test } from '@playwright/test';
import type { Object3D } from 'three';

// What the site exposes on `globalThis.hero` that the screenshots use.
interface HeroHandle {
	hero: {
		game?: {
			advance: (seconds: number) => void;
			character: Object3D;
		};
		stage?: { step: (dt: number) => void; camera: Object3D };
	};
}

// Where the camera stands for each portrait of me: how far round from in
// front of me, how far away, and how high it looks (above my feet).
const portraits = [
	{ name: 'me', turn: 0, distance: 2.8, height: 1 },
	{ name: 'me-left', turn: 0.75, distance: 2.8, height: 1 },
	{ name: 'me-right', turn: -0.75, distance: 2.8, height: 1 },
	{ name: 'me-face', turn: 0, distance: 0.85, height: 1.7 },
] as const;

const out = path.join(import.meta.dirname, 'out');
const easterEggs = [
	'outhouse',
	'jailbreak',
	'tahoe-reader',
	'money-rain',
	'keepy-uppies',
	'battlestation',
	'wood-stove',
];
// Every easter egg found once.
const allFound = JSON.stringify(
	Object.fromEntries(easterEggs.map((id) => [id, 1])),
);

/**
 * Sorts names alphabetically.
 * @param a - One name.
 * @param b - Another.
 * @returns Which comes first.
 */
const byName = (a: string, b: string): number => a.localeCompare(b);

/**
 * A cell of the comparison page's table.
 * @param content - What's in it.
 * @returns The cell.
 */
const cell = (content: string): string => `<td>${content}</td>`;

test.beforeEach(async ({ page }) => {
	// The same "random" numbers every time, so the trees and bears stand in
	// the same places in every set of screenshots.
	await page.addInitScript(() => {
		let seed = 1;
		Math.random = () => {
			seed = (seed * 16_807) % 2_147_483_647;
			return (seed - 1) / 2_147_483_646;
		};
	});
	// Every easter egg unlocked, so the gallery shows them all.
	await page.addInitScript((hits) => {
		localStorage.setItem('hero-easter-egg-hits', hits);
	}, allFound);
	// While a screenshot's taken, only the scene shows.
	await page.addInitScript(() => {
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(`
			.shooting body * { visibility: hidden !important; }
			.shooting #hero-stage canvas { visibility: visible !important; }
		`);
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
	});
});

/**
 * Waits for the stage to draw what's in it now.
 * @param page - The page.
 */
const waitForFrames = async (page: Page): Promise<void> => {
	await page.evaluate(async () => {
		for (let i = 0; i < 3; i++) {
			await new Promise((resolve) => {
				requestAnimationFrame(resolve);
			});
		}
	});
};

/**
 * Takes a screenshot of the scene alone, without the page's controls over
 * it.
 * @param page - The page.
 * @param name - What to call it.
 * @param project - The browser and time of day it's in.
 */
const shoot = async (
	page: Page,
	name: string,
	project: string,
): Promise<void> => {
	await page.evaluate(() => {
		document.documentElement.classList.add('shooting');
	});
	await waitForFrames(page);
	const folder = path.join(out, process.env.SHOTS_NAME ?? 'shots');
	mkdirSync(folder, { recursive: true });
	await page.screenshot({
		path: path.join(folder, `${project}-${name}.png`),
	});
	await page.evaluate(() => {
		document.documentElement.classList.remove('shooting');
	});
};

test('the gallery', async ({ page }, { project }) => {
	await page.goto('/game');
	await page.locator('#hero-start-gallery').click();
	// Loading a whole new scene, drawn on the CPU, can take a while.
	await expect(page.locator('#hero')).toHaveAttribute(
		'data-mode',
		'gallery',
		{
			timeout: 60_000,
		},
	);
	const dots = page.locator('#hero-gallery-dots > *');
	await expect(dots).toHaveCount(easterEggs.length);
	for (const [i, id] of easterEggs.entries()) {
		await dots.nth(i).click();
		// Five seconds on, a step at a time, however slowly it draws: the
		// camera's there, and the easter egg's moment is under way.
		await page.evaluate(() => {
			const { stage } = (globalThis as unknown as HeroHandle).hero;
			for (let step = 0; step < 150; step++) {
				stage?.step(1 / 30);
			}
		});
		await shoot(page, id, project.name);
	}
});

test('a run', async ({ page }, { project }) => {
	await page.goto('/game');
	await page.locator('#hero-start').click();
	for (const [seconds, name] of [
		[4, 'run-start'],
		[20, 'run-later'],
	] as const) {
		await page.evaluate((s) => {
			(globalThis as unknown as HeroHandle).hero.game?.advance(s);
		}, seconds);
		await shoot(page, name, project.name);
	}
});

test('me, up close', async ({ page }, { project }) => {
	await page.goto('/game');
	await page.locator('#hero-start').click();
	// In my star pose, then everything held still, so the camera stays where
	// it's put. Where my feet are, and which way the camera was looking at me.
	const [feet, away] = await page.evaluate(() => {
		const { game, stage } = (globalThis as unknown as HeroHandle).hero;
		if (!game || !stage) {
			throw new Error('No run to take my portrait in');
		}
		game.advance(2.4);
		stage.step = () => {
			// Held still.
		};
		const at = game.character.getWorldPosition(
			stage.camera.position.clone(),
		);
		const towards = stage.camera.position
			.clone()
			.sub(at)
			.setY(0)
			.normalize();
		return [at.toArray(), towards.toArray()];
	});
	for (const { name, turn, distance, height } of portraits) {
		await page.evaluate(
			({ from, facing, ...portrait }) => {
				const { stage } = (globalThis as unknown as HeroHandle).hero;
				if (!stage) {
					throw new Error('No run to take my portrait in');
				}
				const { camera } = stage;
				const [x, , z] = facing;
				const { cos, sin } = Math;
				const target = camera.position.clone().fromArray(from);
				target.y += portrait.height;
				camera.position.set(
					target.x +
						(x * cos(portrait.turn) - z * sin(portrait.turn)) *
							portrait.distance,
					target.y + portrait.distance * 0.12,
					target.z +
						(x * sin(portrait.turn) + z * cos(portrait.turn)) *
							portrait.distance,
				);
				camera.lookAt(target);
			},
			{ from: feet, facing: away, turn, distance, height },
		);
		await shoot(page, name, project.name);
	}
});

test.afterAll(() => {
	// A page with every set of screenshots side by side.
	mkdirSync(out, { recursive: true });
	const sets = readdirSync(out, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.toSorted(byName);
	const images = [
		...new Set(sets.flatMap((set) => readdirSync(path.join(out, set)))),
	].toSorted(byName);
	const rows = images.map(
		(image) =>
			`<tr><th>${image}</th>${sets
				.map((set) =>
					cell(
						`<img src="${set}/${image}" alt="${set}: ${image}" loading="lazy">`,
					),
				)
				.join('')}</tr>`,
	);
	writeFileSync(
		path.join(out, 'compare.html'),
		`<!doctype html>
<meta charset="utf-8">
<title>Screenshots</title>
<style>
	body { font: 14px system-ui, sans-serif; margin: 16px; }
	table { border-collapse: collapse; }
	th, td { padding: 4px; vertical-align: top; text-align: start; }
	img { width: 100%; max-width: 640px; display: block; }
</style>
<table>
<tr><th></th>${sets.map((set) => `<th>${set}</th>`).join('')}</tr>
${rows.join('\n')}
</table>
`,
	);
});
