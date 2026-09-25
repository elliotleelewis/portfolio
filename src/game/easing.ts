import { MathUtils } from 'three';

/**
 * Eases from 0 to 1 as `x` goes from `edge0` to `edge1`.
 * @param edge0 - Where the ease starts.
 * @param edge1 - Where it ends.
 * @param x - Where we are.
 * @returns 0 to 1, smoothly.
 */
export const smooth = (edge0: number, edge1: number, x: number): number =>
	MathUtils.smootherstep(x, edge0, edge1);

/**
 * How far to move towards a target this step, for a frame-rate-independent
 * exponential ease.
 * @param rate - How quickly to close the gap (higher is faster).
 * @param dt - Seconds since the last step.
 * @returns The fraction of the gap to close.
 */
export const damp = (rate: number, dt: number): number =>
	1 - Math.exp(-rate * dt);
