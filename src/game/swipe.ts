// How far past the last easter egg (or past the next one) a drag can pull,
// in easter eggs, before it stops giving.
const stretch = 0.25;
// How much of a drag goes into pulling past the end at first: half, and
// less as it goes on.
const give = 0.5;
// How fast a flick has to be, in easter eggs a second, to move on even if
// it hasn't gone halfway.
const flickSpeed = 1;

/**
 * How far along the row a drag has pulled the gallery, in easter eggs. It
 * can go at most one easter egg either way, and gives less and less past
 * that (or past either end of the row), like pulling on elastic.
 * @param raw - How far the finger has moved, in easter eggs, towards the
 * next one.
 * @param hasPrevious - Whether there's an easter egg before this one.
 * @param hasNext - Whether there's an easter egg after this one.
 * @returns How far along to show the gallery.
 */
export const dragOffset = (
	raw: number,
	hasPrevious: boolean,
	hasNext: boolean,
): number => {
	const limit = Number(raw < 0 ? hasPrevious : hasNext);
	const reach = Math.abs(raw);
	if (reach <= limit) {
		return raw;
	}
	const pulled = reach - limit;
	return (
		Math.sign(raw) *
		(limit + stretch * (1 - 1 / (1 + (pulled * give) / stretch)))
	);
};

/**
 * Which way along the row something goes.
 * @param value - How far or fast, towards the next easter egg.
 * @returns 1 towards the next easter egg, -1 towards the previous one.
 */
const along = (value: number): -1 | 1 => (value < 0 ? -1 : 1);

/**
 * Where a swipe lands once the finger lets go: on to the next easter egg,
 * back to the previous one, or back where it started. A quick enough flick
 * moves on even if it hasn't gone halfway.
 * @param offset - How far along the drag had pulled, in easter eggs.
 * @param velocity - How fast the finger was moving as it let go, in easter
 * eggs a second, towards the next one.
 * @returns 1 for the next easter egg, -1 for the previous one, or 0 to stay.
 */
export const swipeStep = (offset: number, velocity: number): -1 | 0 | 1 => {
	if (Math.abs(velocity) >= flickSpeed) {
		// A flick back against the drag cancels it.
		return offset !== 0 && along(velocity) !== along(offset)
			? 0
			: along(velocity);
	}
	return Math.abs(offset) >= 0.5 ? along(offset) : 0;
};
