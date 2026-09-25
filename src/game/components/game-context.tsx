import { createContext, use, useLayoutEffect, useRef } from 'react';
import { type Camera } from 'three';

import { type Game } from '../game';
import { type SystemUpdate, type Systems } from '../systems';

/**
 * A scene whose world is built from components: the game or the gallery.
 */
export interface StageWorld {
	readonly camera: Camera;
	// Everything that moves on each step, in order.
	readonly systems: Systems;
}

export const StageContext = createContext<StageWorld | undefined>(undefined);

export const GameContext = createContext<Game | undefined>(undefined);

/**
 * The scene the surrounding world belongs to.
 * @returns The scene from the nearest `<GameWorld>` or `<GalleryWorld>`.
 */
export const useStage = (): StageWorld => {
	const stage = use(StageContext);
	if (!stage) {
		throw new Error('useStage must be used inside a world');
	}
	return stage;
};

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
 * Runs something on every step of the scene, in its place in the order (see
 * SYSTEM_ORDER), so it also runs when a test fast-forwards the game.
 * @param order - When to run.
 * @param update - What to run each step.
 */
export const useSystem = (order: number, update: SystemUpdate): void => {
	const stage = useStage();
	const latest = useRef(update);
	useLayoutEffect(() => {
		latest.current = update;
	});
	// Layout effects run before the canvas draws its next frame.
	useLayoutEffect(
		() =>
			stage.systems.add(order, (dt) => {
				latest.current(dt);
			}),
		[stage, order],
	);
};
