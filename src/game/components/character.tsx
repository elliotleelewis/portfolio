import { createPortal } from '@react-three/fiber';

import { useGame } from './game-context';

/**
 * Me, on the slope. The game moves me; this puts me in the scene.
 * @returns My rig.
 */
export const Character = () => {
	const game = useGame();
	return createPortal(<primitive object={game.character} />, game.slope);
};
