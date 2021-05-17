import { shuffle } from './helpers';

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
});
