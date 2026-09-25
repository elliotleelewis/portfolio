import { useAtomValue } from 'jotai';
import { type RefObject, useEffect } from 'react';

import { SCENE_ATOM } from './atoms';
import { useController } from './context';
import { type HeldInput } from './controller';
import { readingDirection } from './direction';

// Which key (by `KeyboardEvent.code`) holds which input.
const keys = new Map<string, HeldInput>([
	['ArrowLeft', 'left'],
	['KeyA', 'left'],
	['ArrowRight', 'right'],
	['KeyD', 'right'],
	['ArrowUp', 'faster'],
	['KeyW', 'faster'],
	['ArrowDown', 'slower'],
	['KeyS', 'slower'],
]);

/**
 * Keyboard controls while a scene is up: arrows (or WASD) steer the game or
 * move through the gallery, and Escape goes back to the photo.
 */
export const useKeyboardControls = (): void => {
	const controller = useController();
	const scene = useAtomValue(SCENE_ATOM);

	useEffect(() => {
		if (!scene) {
			return;
		}
		const onKey = (event: KeyboardEvent): void => {
			if (event.code === 'Escape') {
				controller.stop();
				return;
			}
			if (scene === 'gallery') {
				const isLeft =
					event.code === 'ArrowLeft' || event.code === 'KeyA';
				const isRight =
					event.code === 'ArrowRight' || event.code === 'KeyD';
				if (!isLeft && !isRight) {
					return;
				}
				event.preventDefault();
				if (event.type !== 'keydown') {
					return;
				}
				// The row runs the way the page reads, so on a right-to-left
				// page the next easter egg is to the left.
				if (isRight === (readingDirection() === 'ltr')) {
					controller.nextEgg();
				} else {
					controller.previousEgg();
				}
				return;
			}
			const input = keys.get(event.code);
			if (!input || !controller.isSteerable) {
				return;
			}
			event.preventDefault();
			controller.hold(input, event.type === 'keydown');
		};
		globalThis.addEventListener('keydown', onKey);
		globalThis.addEventListener('keyup', onKey);
		return () => {
			globalThis.removeEventListener('keydown', onKey);
			globalThis.removeEventListener('keyup', onKey);
		};
	}, [controller, scene]);
};

/**
 * Stops taps and pinches on a scene zooming the page. Buttons and links
 * still get their taps.
 * @param element - The element to guard.
 */
export const usePreventTouchZoom = (
	element: RefObject<HTMLElement | null>,
): void => {
	const controller = useController();

	useEffect(() => {
		const target = element.current;
		if (!target) {
			return;
		}
		const onTouchStart = (event: TouchEvent): void => {
			if (controller.hasScene && event.touches.length > 1) {
				event.preventDefault();
			}
		};
		const onTouchEnd = (event: TouchEvent): void => {
			const isOnButton =
				event.target instanceof Element &&
				event.target.closest('button, a') !== null;
			if (!isOnButton && controller.hasScene) {
				event.preventDefault();
			}
		};
		target.addEventListener('touchstart', onTouchStart, { passive: false });
		target.addEventListener('touchend', onTouchEnd, { passive: false });
		return () => {
			target.removeEventListener('touchstart', onTouchStart);
			target.removeEventListener('touchend', onTouchEnd);
		};
	}, [controller, element]);
};
