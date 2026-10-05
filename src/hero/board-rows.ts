// How many runs the compact board always shows from the top.
const top = 3;

// A row of the board to show (by index, best first), or a gap where rows are
// left out.
export type BoardRow = number | 'gap';

/**
 * The rows of a compact board: the top three, then my run with the runs
 * either side of it, if it's further down. Anything between is a gap.
 * @param length - How many runs are on the board.
 * @param mine - My run's index, if I've just saved it.
 * @returns The rows to show, in order.
 */
export const compactRows = (length: number, mine?: number): BoardRow[] => {
	const shown = new Set<number>();
	for (let i = 0; i < Math.min(top, length); i++) {
		shown.add(i);
	}
	if (mine !== undefined && mine >= 0 && mine < length) {
		for (let i = mine - 1; i <= mine + 1; i++) {
			if (i >= 0 && i < length) {
				shown.add(i);
			}
		}
	}
	const rows: BoardRow[] = [];
	const indices = [...shown].toSorted((a, b) => a - b);
	let previous = -1;
	for (const index of indices) {
		if (index > previous + 1) {
			rows.push('gap');
		}
		rows.push(index);
		previous = index;
	}
	return rows;
};
