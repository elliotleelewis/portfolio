import { createContext, use } from 'react';

import { type HeroController } from './controller';

export const ControllerContext = createContext<HeroController | undefined>(
	undefined,
);

/**
 * The controller running the hero's scenes.
 * @returns The controller from the nearest `<Hero>`.
 */
export const useController = (): HeroController => {
	const controller = use(ControllerContext);
	if (!controller) {
		throw new Error('useController must be used inside <Hero>');
	}
	return controller;
};
