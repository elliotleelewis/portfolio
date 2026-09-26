import { Provider, createStore, useAtomValue } from 'jotai';
import { type ReactNode, useRef, useState } from 'react';

import { MODE_ATOM, PHASE_ATOM } from './atoms';
import { ControllerContext, useController } from './context';
import { HeroController } from './controller';
import { GalleryPanel } from './gallery-panel';
import { GameOver } from './game-over';
import { useKeyboardControls, usePreventTouchZoom } from './hooks';
import { Hud } from './hud';
import { PlayOverlay } from './play-overlay';
import { Stage } from './stage';

interface Props {
	// The photo, which the game fades in over.
	children?: ReactNode;
	// Whether the hero fills the whole window (the game's own page), rather
	// than sitting at the top of the home page as a card.
	isFullscreen?: boolean;
}

const HeroSection = ({ children, isFullscreen = false }: Props) => {
	const controller = useController();
	const phase = useAtomValue(PHASE_ATOM);
	const mode = useAtomValue(MODE_ATOM);
	const section = useRef<HTMLElement>(null);
	useKeyboardControls();
	usePreventTouchZoom(section);

	return (
		<section
			id="hero"
			ref={section}
			data-state={phase}
			data-mode={mode}
			className={
				isFullscreen
					? 'group fixed inset-0 overflow-hidden bg-[#dde3e5] select-none'
					: 'group relative h-[85svh] min-h-120 overflow-hidden rounded-3xl bg-[#dde3e5] shadow-2xl ring-1 shadow-pine/20 ring-line select-none'
			}
			aria-label="Elliot on a mountain"
		>
			{children}
			<Stage />
			<PlayOverlay
				onPlay={() => {
					// On the home page, bring all of the game into view first.
					if (!isFullscreen) {
						section.current?.scrollIntoView({
							behavior: 'smooth',
							block: 'center',
						});
					}
					void controller.start();
				}}
			/>
			<Hud />
			<GameOver />
			<GalleryPanel />
		</section>
	);
};

/**
 * The hero: a photo of me that fades into a game of cartwheeling down the
 * mountain, with a gallery of the easter eggs hidden along the way.
 * @param props - Component props.
 * @param props.children - The photo.
 * @param props.isFullscreen - Whether it fills the whole window.
 * @returns The hero.
 */
export const Hero = ({ children, isFullscreen }: Props) => {
	const [store] = useState(() => createStore());
	const [controller] = useState(() => new HeroController(store));

	return (
		<Provider store={store}>
			<ControllerContext value={controller}>
				<HeroSection isFullscreen={isFullscreen}>
					{children}
				</HeroSection>
			</ControllerContext>
		</Provider>
	);
};
