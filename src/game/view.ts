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
export const isBlockingChaseView = (
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

// How close to the chase camera something has to come to be in its way.
const cameraReach = 4;

/**
 * Whether something at `point` is in the chase camera's way: between it and
 * me, or right up close to it.
 * @param point - Where it is.
 * @param player - Where I am.
 * @param offset - Where the camera sits relative to me.
 * @returns True if it's in the way.
 */
export const isInChaseCameraWay = (
	point: Point,
	player: Point,
	offset: Point,
): boolean =>
	isBlockingChaseView(point, player, offset) ||
	Math.hypot(
		point.x - (player.x + offset.x),
		point.z - (player.z + offset.z),
	) < cameraReach;

export interface ScreenPin {
	// Where to show it, in normalised device coordinates (-1 to 1).
	x: number;
	y: number;
	// Whether it's out of view, so needs pinning to the edge.
	isOffScreen: boolean;
}

/**
 * Where to show something that may be out of view: where it is if it's on
 * screen, otherwise pinned just inside the edge in its direction.
 * @param x - Its x, in normalised device coordinates.
 * @param y - Its y, in normalised device coordinates.
 * @param isBehind - Whether it's behind the camera (which flips x and y).
 * @param inset - How far in from each edge to pin it, in the same units.
 * @param inset.x - From the left and right edges.
 * @param inset.y - From the top and bottom edges.
 * @returns Where to show it.
 */
export const pinToScreenEdge = (
	x: number,
	y: number,
	isBehind: boolean,
	inset: { x: number; y: number },
): ScreenPin => {
	const px = isBehind ? -x : x;
	const py = isBehind ? -y : y;
	if (!isBehind && Math.abs(px) <= 1 && Math.abs(py) <= 1) {
		return { x: px, y: py, isOffScreen: false };
	}
	const reach = Math.max(
		Math.abs(px) / (1 - inset.x),
		Math.abs(py) / (1 - inset.y),
	);
	// Dead behind: pin it to the bottom.
	return reach === 0
		? { x: 0, y: -(1 - inset.y), isOffScreen: true }
		: { x: px / reach, y: py / reach, isOffScreen: true };
};
