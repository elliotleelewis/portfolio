import type { Page } from '@playwright/test';

import { expect, finishAnimations, test } from './fixtures';
import { crash, startRun } from './hero';

/**
 * Tabs through the whole page, once round, and lists each stop that can't
 * be seen: faded out, hidden, or inside something that is. Panels in the
 * hero fade rather than leave the page, so a keyboard could otherwise land
 * on buttons nobody can see.
 * @param page - The page, in the state to check.
 * @returns The stops that can't be seen, by id or label.
 */
const unseenTabStops = async (page: Page): Promise<string[]> => {
	// The page's sections fade in as they scroll into view, as Tab would
	// scroll them. Show them all first, as that's not what this is about.
	await page
		.locator('[data-reveal]')
		.evaluateAll((elements: HTMLElement[]) => {
			for (const element of elements) {
				element.dataset.visible = '';
			}
		});
	// Fades still running would catch a panel on its way in.
	await finishAnimations(page);
	await page.evaluate(() => {
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	});
	const unseen: string[] = [];
	for (let stop = 0; stop < 100; stop += 1) {
		await page.keyboard.press('Tab');
		const focused = await page.evaluate(() => {
			const element = document.activeElement;
			if (
				!(element instanceof HTMLElement) ||
				element === document.body
			) {
				return 'none';
			}
			// Back where Tab started: it's been all the way round.
			if (element.dataset.tabbed !== undefined) {
				return 'round';
			}
			element.dataset.tabbed = '';
			let opacity = 1;
			for (
				let node: HTMLElement | null = element;
				node;
				node = node.parentElement
			) {
				opacity *= Number(getComputedStyle(node).opacity);
			}
			const isSeen =
				opacity > 0 &&
				element.checkVisibility({ visibilityProperty: true });
			if (isSeen) {
				return 'seen';
			}
			return element.id === ''
				? element.textContent.trim().slice(0, 40)
				: element.id;
		});
		if (focused === 'round') {
			break;
		}
		if (focused !== 'none' && focused !== 'seen') {
			unseen.push(focused);
		}
	}
	await page.evaluate(() => {
		for (const element of document.querySelectorAll<HTMLElement>(
			'[data-tabbed]',
		)) {
			delete element.dataset.tabbed;
		}
	});
	return unseen;
};

test('only tabs to what can be seen on the photo', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('#hero-play')).toBeEnabled();
	expect(await unseenTabStops(page)).toEqual([]);
});

test('only tabs to what can be seen during a run', async ({ page }) => {
	await page.goto('/');
	await startRun(page);
	expect(await unseenTabStops(page)).toEqual([]);
});

test('only tabs to what can be seen when a bear catches me', async ({
	page,
}) => {
	await page.goto('/');
	await startRun(page);
	await crash(page);
	expect(await unseenTabStops(page)).toEqual([]);
});

test('only tabs to what can be seen on the start screen and in the gallery', async ({
	page,
}) => {
	await page.goto('/game');
	await expect(page.locator('#hero-start')).toBeEnabled();
	expect(await unseenTabStops(page)).toEqual([]);
	await page.locator('#hero-start-gallery').click();
	await expect(page.locator('#hero-gallery-caption')).not.toBeEmpty();
	expect(await unseenTabStops(page)).toEqual([]);
});
