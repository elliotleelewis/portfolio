/**
 * How far to move towards a target this step, for a frame-rate-independent
 * exponential ease.
 * @param rate - How quickly to close the gap (higher is faster).
 * @param dt - Seconds since the last step.
 * @returns The fraction of the gap to close.
 */
export const damp = (rate: number, dt: number): number =>
	1 - Math.exp(-rate * dt);
