import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';

import { SCENE_ATOM } from './atoms';
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
export const PlayOverlay = ({ onPlay }: Props) => {
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
		<div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-linear-to-t from-slate-950/70 to-transparent px-6 pt-24 pb-8 text-center text-white transition-opacity duration-500 group-data-[state=playing]:opacity-0">
			<p className="text-sm tracking-widest text-white/80 uppercase">
				Hi, I’m Elliot 👋
			</p>
			<button
				id="hero-play"
				ref={button}
				type="button"
				// Until the page hydrates, a tap would go nowhere.
				disabled={!isHydrated}
				className="pointer-events-auto cursor-pointer rounded-full border border-white/40 bg-white/15 px-6 py-3 font-semibold whitespace-nowrap backdrop-blur-md transition group-data-[state=playing]:pointer-events-none hover:bg-white/25 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70 sm:text-lg"
				onClick={onPlay}
			>
				<span className="group-data-[state=loading]:hidden">
					Take the quick way down ⛰️
				</span>
				<span className="hidden group-data-[state=loading]:inline">
					Getting ready…
				</span>
			</button>
		</div>
	);
};
