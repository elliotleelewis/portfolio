import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';

import { BEST_ATOM, PHASE_ATOM, WAITING_ATOM } from './atoms';
import { useController } from './context';
import { useIsHydrated } from './hooks';

/**
 * The game's own start screen, on the game's own page: what to do, the best
 * run so far, and the button that sets me off. Up while the game loads, and
 * over the game as I stand waiting at the top of the mountain.
 * @returns The start screen.
 */
export const StartScreen = () => {
	const controller = useController();
	const phase = useAtomValue(PHASE_ATOM);
	const isWaiting = useAtomValue(WAITING_ATOM);
	const best = useAtomValue(BEST_ATOM);
	// The best score is read from storage, which the server doesn't have.
	const isHydrated = useIsHydrated();
	const start = useRef<HTMLButtonElement>(null);
	const isShown = isWaiting || phase !== 'playing';
	// Only once the game has been drawn, and is waiting for me.
	const isReady = isWaiting && phase === 'playing';

	useEffect(() => {
		if (isReady) {
			start.current?.focus();
		}
	}, [isReady]);

	return (
		<div
			id="hero-start-screen"
			data-show={isShown ? '' : undefined}
			className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center bg-linear-to-t from-slate-950/70 to-transparent px-6 pt-24 pb-8 text-center text-white opacity-0 transition-opacity duration-500 data-show:pointer-events-auto data-show:opacity-100"
		>
			<h1 className="font-display text-4xl font-bold sm:text-5xl">
				The quick way down
			</h1>
			<p className="mt-3 max-w-md text-white/85 sm:text-lg">
				Cartwheel down the mountain, flatten every tree you can, and
				don’t get caught by a bear 🐻
			</p>
			<p className="mt-2 text-sm text-white/70 any-pointer-coarse:hidden">
				← → to steer · ↑ ↓ for speed
			</p>
			<p className="mt-2 hidden text-sm text-white/70 any-pointer-coarse:block">
				Steer and speed up with the stick
			</p>
			{isHydrated && best > 0 && (
				<p id="hero-start-best" className="mt-1 text-sm text-white/70">
					Your best: {best} {best === 1 ? 'tree' : 'trees'}
				</p>
			)}
			<div className="mt-5 flex flex-wrap justify-center gap-2">
				<button
					id="hero-start"
					ref={start}
					type="button"
					disabled={!isReady}
					className="cursor-pointer rounded-full bg-white px-6 py-3 font-semibold whitespace-nowrap text-slate-900 hover:bg-white/85 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70 sm:text-lg"
					onClick={() => {
						controller.begin();
					}}
				>
					{/* Only while the game loads, not as it all fades away. */}
					{phase === 'playing'
						? 'Start rolling ⛰️'
						: 'Getting ready…'}
				</button>
				<button
					id="hero-start-gallery"
					type="button"
					disabled={!isReady}
					className="cursor-pointer rounded-full border border-white/40 bg-white/15 px-6 py-3 font-semibold whitespace-nowrap backdrop-blur-md hover:bg-white/25 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70 sm:text-lg"
					onClick={() => {
						void controller.openGallery();
					}}
				>
					See the easter eggs
				</button>
			</div>
		</div>
	);
};
