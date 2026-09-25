import { createContext, use, useLayoutEffect, useRef } from 'react';

import { type Game } from '../game';
import { type SystemUpdate } from '../systems';

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

/**
 * Runs something on every step of the game, in its place in the order (see
 * SYSTEM_ORDER), so it also runs when a test fast-forwards the game.
 * @param order - When to run.
 * @param update - What to run each step.
 */
export const useSystem = (order: number, update: SystemUpdate): void => {
	const game = useGame();
	const latest = useRef(update);
	useLayoutEffect(() => {
		latest.current = update;
	});
	// Layout effects run before the canvas draws its next frame.
	useLayoutEffect(
		() =>
			game.systems.add(order, (dt) => {
				latest.current(dt);
			}),
		[game, order],
	);
};
