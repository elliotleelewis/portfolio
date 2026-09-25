// Small nudges of the stick do nothing.
export const STICK_DEAD_ZONE = 0.15;

export interface StickReading {
	// Where the knob sits, in pixels from the centre of the ring.
	knobX: number;
	knobY: number;
	// -1 (left) to 1 (right).
	steer: number;
	// -1 (slower) to 1 (faster).
	throttle: number;
}

/**
 * Reads the on-screen stick from where the finger is.
 * @param dx - Finger distance right of the ring's centre, in pixels.
 * @param dy - Finger distance below the ring's centre, in pixels.
 * @param reach - How far the knob can travel from the centre, in pixels.
 * @returns The knob position (kept inside the ring) and the input it gives.
 */
export const readStick = (
	dx: number,
	dy: number,
	reach: number,
): StickReading => {
	const scale = Math.min(1, reach / (Math.hypot(dx, dy) || 1));
	const knobX = dx * scale;
	const knobY = dy * scale;
	const shape = (value: number): number =>
		Math.abs(value) < STICK_DEAD_ZONE ? 0 : value;
	return {
		knobX,
		knobY,
		steer: shape(knobX / reach),
		throttle: shape(-knobY / reach),
	};
};
