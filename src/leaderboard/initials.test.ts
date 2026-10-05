import { describe, expect, it } from 'vitest';

import { isBlocked, isInitials, readInitials, stepCharacter } from './initials';

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
	it('blocks rude initials', () => {
		expect(isBlocked('ASS')).toBe(true);
	});

	it('sees through digits that read as letters', () => {
		expect(isBlocked('A55')).toBe(true);
		expect(isBlocked('4SS')).toBe(true);
	});

	it('lets everyone else through', () => {
		expect(isBlocked('ELL')).toBe(false);
		expect(isBlocked('AAA')).toBe(false);
		expect(isBlocked('007')).toBe(false);
	});
});

describe('stepCharacter', () => {
	it('steps through the letters, then the digits', () => {
		expect(stepCharacter('A', 1)).toBe('B');
		expect(stepCharacter('Z', 1)).toBe('0');
		expect(stepCharacter('0', -1)).toBe('Z');
	});

	it('wraps round at either end', () => {
		expect(stepCharacter('9', 1)).toBe('A');
		expect(stepCharacter('A', -1)).toBe('9');
	});

	it('starts from A for anything unknown', () => {
		expect(stepCharacter('?', 1)).toBe('B');
	});
});

describe('readInitials', () => {
	it('keeps stored initials', () => {
		expect(readInitials('ELL')).toBe('ELL');
	});

	it('starts from AAA for anything else', () => {
		expect(readInitials('<script>')).toBe('AAA');
		expect(readInitials(42)).toBe('AAA');
		expect(readInitials(undefined)).toBe('AAA');
	});
});
