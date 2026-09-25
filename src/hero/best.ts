const bestKey = 'hero-best-trees';

/**
 * The most trees flattened in one run on this device.
 * @returns The best, or 0 if there isn't one (or storage is unavailable).
 */
export const readBest = (): number => {
	try {
		return Number(localStorage.getItem(bestKey)) || 0;
	} catch {
		return 0;
	}
};

/**
 * Remembers a new best on this device.
 * @param trees - Trees flattened.
 */
export const saveBest = (trees: number): void => {
	try {
		localStorage.setItem(bestKey, String(trees));
	} catch {
		// Storage unavailable (e.g. private browsing); not worth failing over.
	}
};

/**
 * The line under the score on the game-over card.
 * @param trees - Trees flattened this run.
 * @param best - The best before this run.
 * @returns What to say about it.
 */
export const bestMessage = (trees: number, best: number): string => {
	if (trees > best) {
		return 'A new personal best! 🎉';
	}
	return best > 0
		? `Your best: ${String(best)} trees`
		: 'Flatten some trees before they get you!';
};
