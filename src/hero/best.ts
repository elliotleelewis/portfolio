import { m } from '../paraglide/messages.js';

/**
 * The line under the score on the game-over card.
 * @param trees - Trees flattened this run.
 * @param best - The best before this run.
 * @returns What to say about it.
 */
export const bestMessage = (trees: number, best: number): string => {
	if (trees > best) {
		return m.hero_best_new();
	}
	return best > 0 ? m.hero_best({ best }) : m.hero_best_none();
};
