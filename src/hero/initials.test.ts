import { describe, expect, it } from 'vitest';

import { readInitials, stepCharacter } from './initials';

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
