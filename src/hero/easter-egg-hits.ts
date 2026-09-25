// How many times each easter egg (by id) has been smashed on this device.
export type EasterEggHits = Readonly<Record<string, number>>;

/**
 * Reads hit counts from storage, which could hold anything, keeping only
 * sensible counts.
 * @param value - What was stored.
 * @returns The hit counts.
 */
export const readHits = (value: unknown): EasterEggHits =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? Object.fromEntries(
				Object.entries(value).filter(
					(entry): entry is [string, number] =>
						Number.isSafeInteger(entry[1]) &&
						(entry[1] as number) > 0,
				),
			)
		: {};

/**
 * One more smash of an easter egg.
 * @param hits - The hit counts so far.
 * @param id - The easter egg that was smashed.
 * @returns The new hit counts.
 */
export const addHit = (hits: unknown, id: string): EasterEggHits => {
	const counts = readHits(hits);
	return { ...counts, [id]: (counts[id] ?? 0) + 1 };
};

// The most smashes the gallery counts out; past this it's just "many".
export const MAX_COUNTED_HITS = 9999;

// English number formatting, with commas between the thousands.
const numberFormat = new Intl.NumberFormat('en');

/**
 * The line under a found easter egg's caption in the gallery.
 * @param hits - How many times it's been smashed.
 * @returns What to say about it.
 */
export const hitsMessage = (hits: number): string => {
	if (hits === 1) {
		return 'Smashed once';
	}
	return hits > MAX_COUNTED_HITS
		? 'Smashed many times'
		: `Smashed ${numberFormat.format(hits)} times`;
};
