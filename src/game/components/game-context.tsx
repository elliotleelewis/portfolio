import { createContext, use } from 'react';

import { type Game } from '../game';

export const GameContext = createContext<Game | undefined>(undefined);

/**
 * The game the surrounding world belongs to.
 * @returns The game from the nearest `<GameWorld>`.
 */
export const useGame = (): Game => {
	const game = use(GameContext);
	if (!game) {
		throw new Error('useGame must be used inside <GameWorld>');
	}
	return game;
};
