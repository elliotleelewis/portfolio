import { type Page, type Route, expect } from '@playwright/test';

export interface Entry {
	initials: string;
	trees: number;
	metres: number;
}

// What a page sent to save a score.
export interface Saved extends Entry {
	seconds: number;
	token: string;
}

// The board holds this many runs.
const boardSize = 10;

/**
 * The score a run has to beat, as the API gives it: the last run on a full
 * board, or null while it has room.
 * @param entries - The board.
 * @returns The score to beat.
 */
const cutoffFor = (entries: Entry[]): Omit<Entry, 'initials'> | null => {
	const last = entries.at(boardSize - 1);
	return last ? { trees: last.trees, metres: last.metres } : null;
};

/**
 * Adds the score to beat to an answer with a board, if a test left it out.
 * @param body - The answer's body.
 * @returns The body, with its cutoff.
 */
const withCutoff = (body: unknown): unknown =>
	typeof body === 'object' &&
	body !== null &&
	'entries' in body &&
	Array.isArray(body.entries) &&
	!('cutoff' in body)
		? { ...body, cutoff: cutoffFor(body.entries as Entry[]) }
		: body;

interface LeaderboardOptions {
	// The board, as the API has it.
	entries?: Entry[];
	// How the API answers a score, given what was sent.
	onSave?: (saved: Saved) => { status: number; body: unknown };
}

/**
 * Stands in for the leaderboard's API, which `astro preview` doesn't run,
 * and for Turnstile, which always passes.
 * @param page - The page, before it loads.
 * @param options - The board, and how to answer a score.
 * @returns What the page has sent to save.
 */
export const mockLeaderboard = async (
	page: Page,
	options: LeaderboardOptions = {},
): Promise<Saved[]> => {
	const saved: Saved[] = [];
	const { entries = [], onSave } = options;
	await page.route('**/api/scores', async (route: Route) => {
		const request = route.request();
		if (request.method() === 'GET') {
			await route.fulfill({
				json: { entries, cutoff: cutoffFor(entries) },
			});
			return;
		}
		const sent = request.postDataJSON() as Saved;
		saved.push(sent);
		const answer = onSave?.(sent) ?? {
			status: 200,
			body: {
				entries: [
					{
						initials: sent.initials,
						trees: sent.trees,
						metres: sent.metres,
					},
					...entries,
				].slice(0, boardSize),
				place: 1,
			},
		};
		await route.fulfill({
			status: answer.status,
			json: withCutoff(answer.body),
		});
	});
	await page.route(
		'https://challenges.cloudflare.com/turnstile/**',
		(route) =>
			route.fulfill({
				contentType: 'text/javascript',
				body: `globalThis.turnstile = {
				render: (element, options) => {
					setTimeout(() => options.callback('test-token'), 0);
					return 'widget';
				},
				remove: () => {},
			};`,
			}),
	);
	return saved;
};

/**
 * A full board, every run better than any the tests make.
 * @returns Ten runs.
 */
export const fullBoard = (): Entry[] =>
	Array.from({ length: 10 }, (_, i) => ({
		initials: 'TOP',
		trees: 1000 - i,
		metres: 5000,
	}));

/**
 * Waits for the game-over card to ask for initials, ready to type them and
 * save them (once Turnstile has passed).
 * @param page - The page, with the game-over card up.
 */
export const waitForInitials = async (page: Page): Promise<void> => {
	await expect(
		page.locator('#hero-initials').getByRole('textbox').first(),
	).toBeFocused();
	await expect(page.locator('#hero-initials-save')).toBeEnabled();
};

/**
 * Checks the initials on the game-over card.
 * @param page - The page, with the initials up.
 * @param initials - What they should be, like "ELL".
 */
export const expectInitials = async (
	page: Page,
	initials: string,
): Promise<void> => {
	const slots = page.locator('#hero-initials').getByRole('textbox');
	await expect(slots).toHaveCount(initials.length);
	for (let index = 0; index < initials.length; index++) {
		await expect(slots.nth(index)).toHaveValue(initials.charAt(index));
	}
};
