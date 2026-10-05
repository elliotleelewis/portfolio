import { describe, expect, it } from 'vitest';

import { isBlocked, isInitials, readBlocked } from './initials';

describe('isInitials', () => {
	it('takes three capital letters or digits', () => {
		expect(isInitials('ELL')).toBe(true);
		expect(isInitials('R2D')).toBe(true);
		expect(isInitials('007')).toBe(true);
	});

	it('turns down anything else', () => {
		expect(isInitials('ell')).toBe(false);
		expect(isInitials('EL')).toBe(false);
		expect(isInitials('ELLI')).toBe(false);
		expect(isInitials('E L')).toBe(false);
		expect(isInitials('<b>')).toBe(false);
		expect(isInitials(123)).toBe(false);
		expect(isInitials(undefined)).toBe(false);
	});
});

describe('isBlocked', () => {
	// One example from obscenity's word list, to show it's wired up. The rest
	// stay out of the repo.
	it('blocks rude words from the word list', () => {
		expect(isBlocked('ASS')).toBe(true);
	});

	it('sees through digits that read as letters', () => {
		expect(isBlocked('A55')).toBe(true);
		expect(isBlocked('4SS')).toBe(true);
	});

	it('blocks the extra initials it’s given, however they’re spelled', () => {
		// A harmless stand-in for the secret list.
		const blocked = new Set(['BOO']);
		expect(isBlocked('BOO', blocked)).toBe(true);
		expect(isBlocked('B00', blocked)).toBe(true);
		expect(isBlocked('BOB', blocked)).toBe(false);
	});

	it('lets everyone else through', () => {
		expect(isBlocked('ELL')).toBe(false);
		expect(isBlocked('AAA')).toBe(false);
		expect(isBlocked('007')).toBe(false);
	});
});

describe('readBlocked', () => {
	it('reads initials separated by commas, in any case', () => {
		expect(readBlocked('boo, ZZZ,7up')).toEqual(
			new Set(['BOO', 'ZZZ', '7UP']),
		);
	});

	it('skips anything that isn’t initials', () => {
		expect(readBlocked('BOOK,,B O, ')).toEqual(new Set());
		expect(readBlocked()).toEqual(new Set());
	});
});
