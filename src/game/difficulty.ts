import { MathUtils } from 'three';

import { LANE_HALF_WIDTH } from './world';

// How far down the mountain the early ramp in bears ends, in metres.
const rampEnd = 660;
// The most likely a tree in the middle of the lane ever is to have a bear up
// it.
const maxBearChance = 0.2;
// Over the last stretch of the lane before each edge, trees are more likely to
// have a bear up them, up to this many times as likely at the edge itself. A
// bear only reaches me from a few metres across, so at the edge I'd otherwise
// face only the bears on one side of me, half as many as in the middle.
// `pnpm sim` measures it.
const edgeBoost = 2.5;
const edgeRampStart = LANE_HALF_WIDTH - 2;

/**
 * How likely a newly placed tree in the lane is to have a bear up it. It
 * climbs quickly over the first stretch, then keeps creeping up the further
 * down the mountain I get. Near the lane's edges it's more likely still, so
 * hugging an edge is no safer than the middle.
 * @param distance - How far I've rolled, in metres.
 * @param x - Where the tree is across the slope.
 * @returns The chance, from 0 to 1.
 */
export const bearChance = (distance: number, x: number): number => {
	const early = Math.min(distance, rampEnd);
	const late = Math.max(0, distance - rampEnd);
	const chance = Math.min(
		maxBearChance,
		0.025 + early / 12_000 + late / 36_000,
	);
	const nearEdge = MathUtils.clamp(
		MathUtils.inverseLerp(edgeRampStart, LANE_HALF_WIDTH, Math.abs(x)),
		0,
		1,
	);
	return chance * MathUtils.lerp(1, edgeBoost, nearEdge);
};
