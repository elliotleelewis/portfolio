import { useAtomValue } from 'jotai';
import { type PointerEvent, Suspense, lazy, useRef } from 'react';

import { SCENE_ATOM, STAGE_SCENE_ATOM } from './atoms';
import { useController } from './context';
import { readingDirection } from './direction';

// How far back to look when working out how fast the finger was moving.
const velocityWindow = 100;

interface Drag {
	pointer: number;
	startX: number;
	// The stage's width in pixels, negative on a left-to-right page (where
	// dragging left moves on to the next easter egg).
	scale: number;
	// Recent finger positions, for how fast it's moving as it lets go.
	samples: { x: number; time: number }[];
}

// Loaded with the game, not with the page.
const SceneCanvas = lazy(async () => {
	const { SceneCanvas: component } = await import('./scene-canvas');
	return { default: component };
});

/**
 * Where the game and gallery draw. Dragging pulls the gallery along; the
 * game is steered with the keyboard or the on-screen stick.
 * @returns The stage.
 */
export const Stage = () => {
	const controller = useController();
	const scene = useAtomValue(SCENE_ATOM);
	const stageScene = useAtomValue(STAGE_SCENE_ATOM);
	const drag = useRef<Drag | undefined>(undefined);

	// Pulls the gallery along with the finger, then lets it snap to the
	// nearest easter egg (or the next, after a flick) when it lets go.
	const onPointer = (event: PointerEvent<HTMLDivElement>): void => {
		const current = drag.current;
		if (event.type === 'pointerdown') {
			if (scene !== 'gallery' || current || !event.isPrimary) {
				return;
			}
			event.currentTarget.setPointerCapture(event.pointerId);
			const width = event.currentTarget.getBoundingClientRect().width;
			drag.current = {
				pointer: event.pointerId,
				startX: event.clientX,
				// Dragging against the way the page reads moves on to the next.
				scale: width * (readingDirection() === 'rtl' ? 1 : -1),
				samples: [{ x: event.clientX, time: event.timeStamp }],
			};
			return;
		}
		if (current?.pointer !== event.pointerId) {
			return;
		}
		const { samples } = current;
		samples.push({ x: event.clientX, time: event.timeStamp });
		while (
			samples.length > 2 &&
			event.timeStamp - samples[0].time > velocityWindow
		) {
			samples.shift();
		}
		if (event.type === 'pointermove') {
			controller.dragEgg(
				(event.clientX - current.startX) / current.scale,
			);
			return;
		}
		// Let go (or the browser took the pointer back).
		drag.current = undefined;
		const [first] = samples;
		const seconds = (event.timeStamp - first.time) / 1000;
		const velocity =
			event.type === 'pointerup' && seconds > 0
				? (event.clientX - first.x) / current.scale / seconds
				: 0;
		controller.releaseEgg(velocity);
	};

	return (
		<div
			id="hero-stage"
			className="absolute inset-0 opacity-0 transition-opacity duration-1500 ease-in-out group-data-[state=playing]:touch-none group-data-[state=playing]:opacity-100"
			onPointerDown={onPointer}
			onPointerMove={onPointer}
			onPointerUp={onPointer}
			onPointerCancel={onPointer}
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
