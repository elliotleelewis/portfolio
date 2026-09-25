import { describe, expect, it } from 'vitest';

import { readStick } from './stick';

describe('readStick', () => {
	it('reads nothing at rest', () => {
		expect(readStick(0, 0, 40)).toEqual({
			knobX: 0,
			knobY: 0,
			steer: 0,
			throttle: 0,
		});
	});

	it('steers in proportion to how far it is pushed', () => {
		expect(readStick(20, 0, 40).steer).toBeCloseTo(0.5);
		expect(readStick(-40, 0, 40).steer).toBeCloseTo(-1);
	});

	it('speeds up when pushed up and slows down when pulled down', () => {
		expect(readStick(0, -40, 40).throttle).toBeCloseTo(1);
		expect(readStick(0, 40, 40).throttle).toBeCloseTo(-1);
	});

	it('keeps the knob inside the ring', () => {
		const { knobX, knobY, steer } = readStick(-200, 0, 40);
		expect(Math.hypot(knobX, knobY)).toBeCloseTo(40);
		expect(steer).toBeCloseTo(-1);
	});

	it('ignores small nudges', () => {
		const { steer, throttle } = readStick(4, -4, 40);
		expect(steer).toBe(0);
		expect(throttle).toBe(0);
	});
});
