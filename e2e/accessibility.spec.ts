import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, finishFades, test } from './fixtures';
import { crash, startFromStartScreen, startRun } from './hero';
import { mockLeaderboard } from './leaderboard';

/**
 * Checks the page as it is now against WCAG 2.2 AA, and best practice.
 * @param page - The page to check.
 * @param within - Only the part of the page to check, when the rest has a
 * test of its own.
 */
const expectNoViolations = async (
	page: Page,
	within?: string,
): Promise<void> => {
	// Colours are only fair to judge once things have finished fading in.
	await finishFades(page);
	const builder = new AxeBuilder({ page });
	if (within) {
		builder.include(within);
	}
	const { violations } = await builder
		.withTags([
			'wcag2a',
			'wcag2aa',
			'wcag21a',
			'wcag21aa',
			'wcag22aa',
			'best-practice',
		])
		.analyze();
	// Just what failed and where, so a failure reads at a glance.
	expect(
		violations.map(({ id, nodes }) => ({
			id,
			targets: nodes.map(({ target }) => target.join(' ')),
		})),
	).toEqual([]);
};

for (const colorScheme of ['light', 'dark'] as const) {
	test.describe(`in ${colorScheme} mode`, () => {
		test.use({ colorScheme });

		test('the home page is accessible', async ({ page }) => {
			await page.goto('/');
			// Every section, not only what has faded in so far.
			await page
				.locator('[data-reveal]')
				.evaluateAll((elements: HTMLElement[]) => {
					for (const element of elements) {
						element.dataset.visible = '';
					}
				});
			await expectNoViolations(page);
		});

		test('the privacy page is accessible', async ({ page }) => {
			await page.goto('/privacy');
			await expectNoViolations(page);
		});

		test('the cookies page is accessible', async ({ page }) => {
			await page.goto('/cookies');
			await expectNoViolations(page);
		});

		test('the 404 page is accessible', async ({ page }) => {
			await page.goto('/no-such-page');
			await expectNoViolations(page);
		});

		test("the game page's start screen is accessible", async ({ page }) => {
			await page.goto('/game');
			await expect(page.locator('#hero-start')).toBeEnabled();
			await expectNoViolations(page);
		});

		test('a run on the game page is accessible', async ({ page }) => {
			await page.goto('/game');
			await startFromStartScreen(page);
			await expectNoViolations(page);
		});

		test("the game page's game-over card is accessible", async ({
			page,
		}) => {
			await page.goto('/game');
			await startFromStartScreen(page);
			await crash(page);
			await expectNoViolations(page);
		});

		test('the easter egg gallery is accessible', async ({ page }) => {
			await page.goto('/game');
			await expect(page.locator('#hero-start-gallery')).toBeEnabled();
			await page.locator('#hero-start-gallery').click();
			await expect(page.locator('#hero-gallery-caption')).not.toBeEmpty();
			await expectNoViolations(page);
		});

		test('entering initials for the leaderboard is accessible', async ({
			page,
		}) => {
			await mockLeaderboard(page);
			await page.goto('/');
			await startRun(page);
			await crash(page);
			await expect(page.locator('#hero-initials-save')).toBeEnabled();
			// The rest of the page is the home page's test.
			await expectNoViolations(page, '#hero');
		});

		test('the leaderboard is accessible', async ({ page }) => {
			await mockLeaderboard(page);
			await page.goto('/');
			await startRun(page);
			await crash(page);
			await page.locator('#hero-initials-save').click();
			await expect(
				page.locator('#hero-board tr[data-mine]'),
			).toBeVisible();
			await expectNoViolations(page, '#hero');
		});

		test('the game in the hero is accessible', async ({ page }) => {
			await page.goto('/');
			await startRun(page);
			// The rest of the page is the home page's test.
			await expectNoViolations(page, '#hero');
		});
	});
}
