import { describe, expect, it } from 'vitest';

import {
	MAX_COUNTED_HITS,
	addHit,
	hitsMessage,
	readHits,
} from './easter-egg-hits';

describe('readHits', () => {
	it('keeps sensible counts', () => {
		expect(readHits({ outhouse: 3, jailbreak: 1 })).toEqual({
			outhouse: 3,
			jailbreak: 1,
		});
	});

	it('drops anything that is not a positive whole count', () => {
		expect(readHits({ a: 0, b: -2, c: 1.5, d: '4', e: NaN, f: 2 })).toEqual(
			{ f: 2 },
		);
	});

	it('starts afresh from anything that is not a set of counts', () => {
		expect(readHits(undefined)).toEqual({});
		expect(readHits(null)).toEqual({});
		expect(readHits(['outhouse'])).toEqual({});
		expect(readHits('outhouse')).toEqual({});
	});
});

describe('addHit', () => {
	it('counts the first smash', () => {
		expect(addHit({}, 'outhouse')).toEqual({ outhouse: 1 });
	});

	it('adds to the count, leaving the others alone', () => {
		expect(addHit({ outhouse: 2, jailbreak: 1 }, 'outhouse')).toEqual({
			outhouse: 3,
			jailbreak: 1,
		});
	});

	it('recovers from junk in storage', () => {
		expect(addHit('junk', 'outhouse')).toEqual({ outhouse: 1 });
	});
});

describe('hitsMessage', () => {
	it('says how many times', () => {
		expect(hitsMessage(1)).toBe('Smashed once');
		expect(hitsMessage(4)).toBe('Smashed 4 times');
	});

	it('separates the thousands with commas', () => {
		expect(hitsMessage(1234)).toBe('Smashed 1,234 times');
		expect(hitsMessage(MAX_COUNTED_HITS)).toBe('Smashed 9,999 times');
	});

	it('stops counting past the limit', () => {
		expect(hitsMessage(MAX_COUNTED_HITS + 1)).toBe('Smashed many times');
		expect(hitsMessage(1_000_000)).toBe('Smashed many times');
	});
});
