import { useAtomValue } from 'jotai';
import { type PointerEvent, Suspense, lazy, useRef } from 'react';

import { SCENE_ATOM, STAGE_SCENE_ATOM } from './atoms';
import { useController } from './context';

// How far a swipe must go, in pixels, to change easter egg.
const swipeDistance = 40;

// Loaded with the game, not with the page.
const SceneCanvas = lazy(async () => {
	const { SceneCanvas: component } = await import('./scene-canvas');
	return { default: component };
});

/**
 * Where the game and gallery draw. Pressing either half steers the game; a
 * swipe moves the gallery along.
 * @returns The stage.
 */
export const Stage = () => {
	const controller = useController();
	const scene = useAtomValue(SCENE_ATOM);
	const stageScene = useAtomValue(STAGE_SCENE_ATOM);
	const swipeStart = useRef<number | undefined>(undefined);

	const onPointer = (event: PointerEvent<HTMLDivElement>): void => {
		if (scene === 'gallery') {
			if (event.type === 'pointerdown') {
				swipeStart.current = event.clientX;
			} else if (
				event.type === 'pointerup' &&
				swipeStart.current !== undefined
			) {
				const swipe = event.clientX - swipeStart.current;
				swipeStart.current = undefined;
				if (swipe < -swipeDistance) {
					controller.nextEgg();
				} else if (swipe > swipeDistance) {
					controller.previousEgg();
				}
			} else if (event.type !== 'pointermove') {
				swipeStart.current = undefined;
			}
			return;
		}
		const isDown = event.type === 'pointerdown' || event.buttons > 0;
		const { left, width } = event.currentTarget.getBoundingClientRect();
		controller.steerByTap(isDown, event.clientX - left < width / 2);
	};

	return (
		<div
			id="hero-stage"
			className="absolute inset-0 touch-none opacity-0 transition-opacity duration-1500 ease-in-out group-data-[state=playing]:opacity-100"
			onPointerDown={onPointer}
			onPointerMove={onPointer}
			onPointerUp={onPointer}
			onPointerCancel={onPointer}
			onPointerLeave={onPointer}
		>
			{stageScene && (
				<Suspense>
					<SceneCanvas
						shown={stageScene}
						onFirstFrame={(drawn) => {
							controller.sceneReady(drawn);
						}}
					/>
				</Suspense>
			)}
		</div>
	);
};
