import { createPortal } from '@react-three/fiber';
import type { Object3D } from 'three';

import { useGame } from './game-context';

interface Props {
	object: Object3D;
}

/**
 * Puts one of the game's objects on the slope. The game moves it (and frees
 * it); this just puts it in the scene.
 * @param props - Component props.
 * @param props.object - What to put there.
 * @returns The object, on the slope.
 */
export const OnSlope = ({ object }: Props) => {
	const game = useGame();
	return createPortal(<primitive object={object} />, game.slope);
};
