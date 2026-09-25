import { describe, expect, it } from 'vitest';

import { bestMessage } from './best';

describe('bestMessage', () => {
	it('celebrates a new best', () => {
		expect(bestMessage(12, 8)).toBe('A new personal best! 🎉');
		expect(bestMessage(1, 0)).toBe('A new personal best! 🎉');
	});

	it('shows the best to beat', () => {
		expect(bestMessage(3, 8)).toBe('Your best: 8 trees');
	});

	it('encourages a first-timer who flattened nothing', () => {
		expect(bestMessage(0, 0)).toBe(
			'Flatten some trees before they get you!',
		);
	});
});
