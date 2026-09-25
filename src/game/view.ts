interface Point {
	x: number;
	z: number;
}

/**
 * Whether something at `point` sits between the chase camera and me, in the
 * slope plane. Only things I've already passed count, never ones I'm level
 * with or about to hit, so trees don't vanish just as I reach them.
 * @param point - Where it stands.
 * @param player - Where I am.
 * @param offset - Where the camera sits relative to me.
 * @returns True if it would block the view.
 */
export const blocksChaseView = (
	point: Point,
	player: Point,
	offset: Point,
): boolean => {
	const lengthSq = offset.x * offset.x + offset.z * offset.z;
	// How far along the player→camera segment it is: 0 at me, 1 at the camera.
	const t =
		((point.x - player.x) * offset.x + (point.z - player.z) * offset.z) /
		lengthSq;
	// Leave anything within 1.5m of me (or ahead of me) alone.
	if (t < 1.5 / Math.sqrt(lengthSq) || t > 1.2) {
		return false;
	}
	const dx = point.x - (player.x + offset.x * t);
	const dz = point.z - (player.z + offset.z * t);
	return dx * dx + dz * dz < 2.5 * 2.5;
};
