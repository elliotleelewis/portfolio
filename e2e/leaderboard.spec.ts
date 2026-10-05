import { expect, test } from './fixtures';
import { advance, crash, startNewRun, startRun } from './hero';
import {
	expectInitials,
	fullBoard,
	mockLeaderboard,
	waitForInitials,
} from './leaderboard';

test('puts a run on the leaderboard with three initials', async ({ page }) => {
	// A run that went nowhere, which any run beats.
	const saved = await mockLeaderboard(page, {
		entries: [{ initials: 'LOW', trees: 0, metres: 0 }],
	});
	await page.goto('/');
	await startRun(page);
	await crash(page);
	await waitForInitials(page);

	await page.keyboard.type('ell');
	await expectInitials(page, 'ELL');
	await expect(page.locator('#hero-initials-save')).toBeEnabled();
	await page.keyboard.press('Enter');

	await expect(page.locator('#hero-board-message')).toHaveText(
		'#1 on the leaderboard 🏆',
	);
	await expect(page.locator('#hero-board tbody tr')).toHaveCount(2);
	const mine = page.locator('#hero-board tr[data-mine]');
	await expect(mine).toContainText('ELL');
	expect(saved).toHaveLength(1);
	expect(saved[0]).toMatchObject({ initials: 'ELL', token: 'test-token' });
	// Real time, rather than the game's.
	expect(saved[0]?.seconds).toBeGreaterThan(0);
	await expect(page.locator('#hero-again')).toBeFocused();
});

test('steps through the initials like an arcade cabinet', async ({ page }) => {
	await mockLeaderboard(page);
	await page.goto('/');
	await startRun(page);
	await crash(page);
	await waitForInitials(page);

	await expectInitials(page, 'AAA');
	// Back from A wraps round to 9, the last character.
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowUp');
	await page.keyboard.press('ArrowUp');
	await expectInitials(page, '9CA');
	// The arrows above and below each initial, for touch screens.
	await page.locator('#hero-initials button[aria-hidden]').nth(4).click();
	await expectInitials(page, '9CB');
});

test('takes initials from a phone’s on-screen keyboard', async ({ page }) => {
	await mockLeaderboard(page);
	await page.goto('/');
	await startRun(page);
	await crash(page);
	await waitForInitials(page);
	// On-screen keyboards change the input without saying which key was
	// pressed, and some type in lower case.
	for (const typed of ['e', 'l', 'L']) {
		await page.keyboard.insertText(typed);
	}
	await expectInitials(page, 'ELL');
	// Deleting goes back to the one before, rather than leave a gap.
	const slots = page.locator('#hero-initials').getByRole('textbox');
	await slots.nth(2).fill('');
	await expect(slots.nth(1)).toBeFocused();
	await expectInitials(page, 'ELL');
});

test('remembers my initials for next time', async ({ page }) => {
	await mockLeaderboard(page);
	await page.goto('/');
	await startRun(page);
	await crash(page);
	await waitForInitials(page);
	await page.keyboard.type('ell');
	await page.keyboard.press('Enter');
	await expect(page.locator('#hero-board-message')).not.toBeEmpty();

	await startNewRun(page, async () => {
		await page.locator('#hero-again').click();
	});
	await advance(page, 4);
	await crash(page);
	await waitForInitials(page);
	await expectInitials(page, 'ELL');
});

test('will not save rude initials', async ({ page }) => {
	await mockLeaderboard(page);
	await page.goto('/');
	await startRun(page);
	await crash(page);
	await waitForInitials(page);
	await page.keyboard.type('a55');
	await expect(page.locator('#hero-initials-status')).toHaveText(
		'Try some other initials',
	);
	await expect(page.locator('#hero-initials-save')).toBeDisabled();
});

test('lets me try again when saving fails', async ({ page }) => {
	let tries = 0;
	const saved = await mockLeaderboard(page, {
		onSave: (sent) => {
			tries++;
			return tries === 1
				? { status: 500, body: { error: 'busy' } }
				: {
						status: 200,
						body: {
							entries: [
								{
									initials: sent.initials,
									trees: 1,
									metres: 1,
								},
							],
							place: 1,
						},
					};
		},
	});
	await page.goto('/');
	await startRun(page);
	await crash(page);
	await waitForInitials(page);
	await page.keyboard.type('ell');
	await page.keyboard.press('Enter');
	await expect(page.locator('#hero-initials-status')).toHaveText(
		'Couldn’t save your score. Try again?',
	);
	await expectInitials(page, 'ELL');
	await page.locator('#hero-initials-save').click();
	await expect(page.locator('#hero-board-message')).toHaveText(
		'#1 on the leaderboard 🏆',
	);
	expect(saved).toHaveLength(2);
});

test('shows the top of the board when a run misses out', async ({ page }) => {
	const saved = await mockLeaderboard(page, { entries: fullBoard() });
	await page.goto('/');
	await startRun(page);
	await crash(page);
	const rows = page.locator('#hero-board tbody tr');
	await expect(rows).toHaveCount(3);
	await expect(page.locator('#hero-initials')).toHaveCount(0);
	await expect(page.locator('#hero-again')).toBeFocused();
	const toggle = page.locator('#hero-board-toggle');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await toggle.click();
	await expect(rows).toHaveCount(10);
	await expect(toggle).toHaveText('Show fewer');
	expect(saved).toEqual([]);
});

test('shows my run with its neighbours, below the top three', async ({
	page,
}) => {
	// Six better runs, then three that went nowhere, which any run beats.
	const better = fullBoard().slice(0, 6);
	const nowhere = Array.from({ length: 3 }, () => ({
		initials: 'LOW',
		trees: 0,
		metres: 0,
	}));
	await mockLeaderboard(page, {
		entries: [...better, ...nowhere],
		onSave: (sent) => ({
			status: 200,
			body: {
				entries: [
					...better,
					{
						initials: sent.initials,
						trees: sent.trees,
						metres: sent.metres,
					},
					...nowhere,
				],
				place: 7,
			},
		}),
	});
	await page.goto('/');
	await startRun(page);
	await crash(page);
	await waitForInitials(page);
	await page.keyboard.type('ell');
	await page.keyboard.press('Enter');

	// The top three, a gap, then sixth, mine and eighth.
	const rows = page.locator('#hero-board tbody tr');
	await expect(rows).toHaveCount(7);
	await expect(rows.nth(3)).toHaveText('⋯');
	await expect(rows.nth(5)).toHaveAttribute('data-mine', '');
	await expect(rows.nth(5)).toContainText('7ELL');
});

test('skips the initials, straight to how the run went', async ({ page }) => {
	const saved = await mockLeaderboard(page);
	await page.goto('/');
	await startRun(page);
	await crash(page);
	await waitForInitials(page);
	// Only the initials, until I'm done with them.
	await expect(page.locator('#hero-again')).toHaveCount(0);
	await page.locator('#hero-initials-skip').click();
	await expect(page.locator('#hero-initials')).toHaveCount(0);
	await expect(page.locator('#hero-again')).toBeFocused();
	await expect(page.locator('#hero-over-title')).toHaveText(
		'Caught by a bear!',
	);
	expect(saved).toEqual([]);
});

test('keeps fast-forwarded runs off the board', async ({ page }) => {
	await mockLeaderboard(page);
	await page.goto('/');
	await startRun(page);
	// Much further than real time allows.
	await advance(page, 200);
	await crash(page);
	await expect(page.locator('#hero-board-message')).toHaveText(
		'Fast-forwarded runs don’t go on the leaderboard.',
	);
	await expect(page.locator('#hero-initials')).toHaveCount(0);
});

test('plays on without a board when it cannot be reached', async ({ page }) => {
	await page.route('**/api/scores', (route) =>
		route.fulfill({ status: 503, json: { error: 'unavailable' } }),
	);
	await page.goto('/');
	await startRun(page);
	await crash(page);
	await expect(page.locator('#hero-over')).toContainText('Caught by a bear!');
	await expect(page.locator('#hero-board')).toHaveCount(0);
	await expect(page.locator('#hero-initials')).toHaveCount(0);
});
