import { easeInOut, shuffle } from './helpers';

describe('helpers', () => {
	describe('#shuffle', () => {
		it('should exist', () => {
			expect(shuffle).toBeTruthy();
		});

		it('should shuffle values', () => {
			expect(shuffle([1, 2, 3])).toBeTruthy();
		});

		it('should accept a custom random function', () => {
			expect(shuffle([1, 2, 3], () => 1)).toEqual([1, 3, 2]);
			expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
		});

		it('should avoid shuffling undefined values', () => {
			expect(shuffle([1, 2, undefined], () => 0)).toEqual([
				2,
				1,
				undefined,
			]);
		});
	});

	describe('#easeInOut', () => {
		it('should exist', () => {
			expect(easeInOut).toBeTruthy();
		});

		it('should calculate ease in value', () => {
			expect(easeInOut(75, 0, 100, 100)).toEqual(87.5);
		});

		it('should calculate ease out value', () => {
			expect(easeInOut(25, 0, 100, 100)).toEqual(12.5);
		});
	});
});
