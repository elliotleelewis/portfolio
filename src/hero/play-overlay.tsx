import { useAtomValue } from 'jotai';
import { type FC, useEffect, useRef } from 'react';

import { m } from '../paraglide/messages';

import { SCENE_ATOM } from './atoms';
import { Button } from './button';
import { useIsHydrated } from './hooks';

interface Props {
	onPlay: () => void;
}

/**
 * The greeting and the button that starts the game, over the photo.
 * @param props - Component props.
 * @param props.onPlay - Starts a run.
 * @returns The overlay.
 */
export const PlayOverlay: FC<Props> = ({ onPlay }) => {
	const scene = useAtomValue(SCENE_ATOM);
	const isHydrated = useIsHydrated();
	const button = useRef<HTMLButtonElement>(null);
	const previousScene = useRef(scene);

	// Back on the photo: put focus back where it started.
	useEffect(() => {
		if (!scene && previousScene.current) {
			button.current?.focus();
		}
		previousScene.current = scene;
	}, [scene]);

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-linear-to-t from-scrim/70 to-transparent px-6 pt-24 pb-8 text-center text-snow transition-opacity duration-500 group-data-[state=playing]:opacity-0">
			<p className="text-sm tracking-widest text-snow/80 uppercase">
				{m.hero_greeting()}
			</p>
			<Button
				id="hero-play"
				ref={button}
				variant="glassOnScrim"
				// Until the page hydrates, a tap would go nowhere.
				disabled={!isHydrated}
				className="pointer-events-auto rounded-full px-6 py-3 whitespace-nowrap transition group-data-[state=playing]:pointer-events-none disabled:cursor-wait disabled:opacity-70 sm:text-lg"
				onClick={onPlay}
			>
				<span className="group-data-[state=loading]:hidden">
					{m.hero_play()}
				</span>
				<span className="hidden group-data-[state=loading]:inline">
					{m.hero_getting_ready()}
				</span>
			</Button>
		</div>
	);
};
