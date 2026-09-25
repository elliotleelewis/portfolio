// How far down the mountain the early ramp in bears ends, in metres.
const rampEnd = 660;
// The most likely a tree ever is to have a bear up it.
const maxBearChance = 0.2;

/**
 * How likely a newly placed tree in the lane is to have a bear up it. It
 * climbs quickly over the first stretch, then keeps creeping up the further
 * down the mountain I get.
 * @param distance - How far I've rolled, in metres.
 * @returns The chance, from 0 to 1.
 */
export const bearChance = (distance: number): number => {
	const early = Math.min(distance, rampEnd);
	const late = Math.max(0, distance - rampEnd);
	return Math.min(maxBearChance, 0.025 + early / 12_000 + late / 36_000);
};
