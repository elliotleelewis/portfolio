import { Provider, createStore, useAtomValue } from 'jotai';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { MODE_ATOM, PHASE_ATOM } from './atoms';
import { ControllerContext, useController } from './context';
import { HeroController } from './controller';
import { GalleryPanel } from './gallery-panel';
import { GameOver } from './game-over';
import { useKeyboardControls, usePreventTouchZoom } from './hooks';
import { Hud } from './hud';
import { PlayOverlay } from './play-overlay';
import { Stage } from './stage';
import { StartScreen } from './start-screen';

interface Props {
	// The photo, which the game fades in over.
	children?: ReactNode;
	// Whether this is the game's own page: the hero fills the window, and the
	// game has a start screen of its own rather than a photo to start from.
	isGamePage?: boolean;
}

const HeroSection = ({ children, isGamePage = false }: Props) => {
	const controller = useController();
	const phase = useAtomValue(PHASE_ATOM);
	const mode = useAtomValue(MODE_ATOM);
	const section = useRef<HTMLElement>(null);
	useKeyboardControls();
	usePreventTouchZoom(section);

	// On the game's own page, the game loads straight away, to wait on its
	// start screen.
	useEffect(() => {
		if (isGamePage) {
			void controller.ready();
		}
	}, [controller, isGamePage]);

	return (
		<section
			id="hero"
			ref={section}
			data-state={phase}
			data-mode={mode}
			className={
				isGamePage
					? 'group fixed inset-0 overflow-hidden bg-[#dde3e5] select-none'
					: 'group relative h-[85svh] min-h-120 overflow-hidden rounded-3xl bg-[#dde3e5] shadow-2xl ring-1 shadow-pine/20 ring-line select-none'
			}
			aria-label="Elliot on a mountain"
		>
			{children}
			<Stage />
			{isGamePage ? (
				<StartScreen />
			) : (
				<PlayOverlay
					onPlay={() => {
						// Bring all of the game into view first.
						section.current?.scrollIntoView({
							behavior: 'smooth',
							block: 'center',
						});
						void controller.start();
					}}
				/>
			)}
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
 * @param props.isGamePage - Whether this is the game's own page.
 * @returns The hero.
 */
export const Hero = ({ children, isGamePage = false }: Props) => {
	const [store] = useState(() => createStore());
	const [controller] = useState(
		() => new HeroController(store, { hasStartScreen: isGamePage }),
	);

	return (
		<Provider store={store}>
			<ControllerContext value={controller}>
				<HeroSection isGamePage={isGamePage}>{children}</HeroSection>
			</ControllerContext>
		</Provider>
	);
};
