import { createPortal } from '@react-three/fiber';

import { useGame } from './game-context';

/**
 * The bears, on the slope. The game moves them; this puts them in the scene.
 * @returns The bears.
 */
export const Bears = () => {
	const game = useGame();
	return createPortal(<primitive object={game.bears} />, game.slope);
};
