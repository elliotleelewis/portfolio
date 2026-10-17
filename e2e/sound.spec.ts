import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { advance, startFromStartScreen, startRun } from './hero';

// The audio contexts the page has made, kept by the stand-in below.
interface AudioHandle {
	audioContexts: AudioContext[];
}

test.beforeEach(async ({ page }) => {
	// Keep each audio context the page makes, to see whether it's playing.
	await page.addInitScript(() => {
		const contexts: AudioContext[] = [];
		Object.defineProperties(globalThis, {
			audioContexts: { value: contexts },
			// eslint-disable-next-line @typescript-eslint/naming-convention -- The browser's name for it.
			AudioContext: {
				value: class extends AudioContext {
					public constructor(options?: AudioContextOptions) {
						super(options);
						contexts.push(this);
					}
				},
			},
		});
	});
});

/**
 * Whether the page's sound is playing.
 * @param page - The page.
 * @returns Its audio context's state, or 'none' before it has one.
 */
const soundState = async (page: Page): Promise<string> =>
	page.evaluate(() => {
		const { audioContexts } = globalThis as unknown as AudioHandle;
		return audioContexts.length === 1 ? audioContexts[0].state : 'none';
	});

test('starts the sound with a run, and mutes it for next time', async ({
	page,
}) => {
	await page.goto('/');
	expect(await soundState(page)).toBe('none');
	await startRun(page);
	const mute = page.locator('#hero-mute');
	await expect(mute).toHaveAttribute('aria-pressed', 'false');
	await expect.poll(() => soundState(page)).toBe('running');
	await mute.click();
	await expect(mute).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => soundState(page)).toBe('suspended');

	// Muted from the start, it doesn't load at all.
	await page.reload();
	await startRun(page);
	await expect(mute).toHaveAttribute('aria-pressed', 'true');
	await advance(page, 1);
	expect(await soundState(page)).toBe('none');
	// Until it's unmuted.
	await mute.click();
	await expect(mute).toHaveAttribute('aria-pressed', 'false');
	await expect.poll(() => soundState(page)).toBe('running');
});

test('mutes and unmutes with M', async ({ page }) => {
	await page.goto('/');
	await startRun(page);
	const mute = page.locator('#hero-mute');
	await page.keyboard.press('m');
	await expect(mute).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('m');
	await expect(mute).toHaveAttribute('aria-pressed', 'false');
});

test("waits for the start button on the game's own page", async ({ page }) => {
	await page.goto('/game');
	await expect(page.locator('#hero-start')).toBeEnabled();
	expect(await soundState(page)).toBe('none');
	await startFromStartScreen(page);
	await expect.poll(() => soundState(page)).toBe('running');
});
