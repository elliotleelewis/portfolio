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
