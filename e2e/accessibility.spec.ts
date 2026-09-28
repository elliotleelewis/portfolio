import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { crash, startFromStartScreen, startRun } from './hero';

/**
 * Checks the page as it is now against WCAG 2.2 AA, and best practice.
 * @param page - The page to check.
 */
const expectNoViolations = async (page: Page): Promise<void> => {
	// Colours are only fair to judge once things have finished fading in.
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.every(
				(animation) =>
					!(animation instanceof CSSTransition) ||
					animation.playState === 'finished',
			),
	);
	const { violations } = await new AxeBuilder({ page })
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

		test('the 404 page is accessible', async ({ page }) => {
			await page.goto('/no-such-page');
			await expectNoViolations(page);
		});

		test('the game page is accessible', async ({ page }) => {
			await page.goto('/game');
			await expect(page.locator('#hero-start')).toBeEnabled({
				timeout: 60_000,
			});
			await expectNoViolations(page);
			await startFromStartScreen(page);
			await expectNoViolations(page);
			await crash(page);
			await expectNoViolations(page);
		});

		test('the easter egg gallery is accessible', async ({ page }) => {
			await page.goto('/game');
			await expect(page.locator('#hero-start-gallery')).toBeEnabled({
				timeout: 60_000,
			});
			await page.locator('#hero-start-gallery').click();
			await expect(page.locator('#hero-gallery-caption')).not.toBeEmpty();
			await expectNoViolations(page);
		});

		test('the game in the hero is accessible', async ({ page }) => {
			await page.goto('/');
			await startRun(page);
			await expectNoViolations(page);
		});
	});
}
