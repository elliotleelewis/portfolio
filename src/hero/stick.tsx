import { type PointerEvent, useRef, useState } from 'react';

import { readStick } from '../game/stick';

import { useController } from './context';

interface Knob {
	x: number;
	y: number;
}

/**
 * A thumbstick for touch screens: left/right steers, up/down sets the pace.
 * @returns The stick.
 */
export const Stick = () => {
	const controller = useController();
	const pointer = useRef<number | undefined>(undefined);
	// Where the knob is while it's held, or undefined at rest.
	const [knob, setKnob] = useState<Knob | undefined>(undefined);

	const follow = (event: PointerEvent<HTMLDivElement>): void => {
		const ring = event.currentTarget;
		const { left, top, width, height } = ring.getBoundingClientRect();
		const { knobX, knobY, steer, throttle } = readStick(
			event.clientX - (left + width / 2),
			event.clientY - (top + height / 2),
			ring.clientWidth / 2 - 12,
		);
		setKnob({ x: knobX, y: knobY });
		controller.setStick(steer, throttle);
	};

	const release = (event: PointerEvent<HTMLDivElement>): void => {
		if (event.pointerId !== pointer.current) {
			return;
		}
		pointer.current = undefined;
		setKnob(undefined);
		controller.setStick(0, 0);
	};

	const isMoved = knob !== undefined && (knob.x !== 0 || knob.y !== 0);

	return (
		<div className="hidden any-pointer-coarse:block">
			<div
				id="hero-stick"
				className="absolute bottom-6 left-1/2 size-28 -translate-x-1/2 touch-none rounded-full border-2 border-white/60 bg-white/25 shadow-lg backdrop-blur-sm group-data-[mode=gallery]:hidden group-data-[state=playing]:pointer-events-auto"
				aria-hidden="true"
				onPointerDown={(event) => {
					pointer.current = event.pointerId;
					event.currentTarget.setPointerCapture(event.pointerId);
					controller.hideHint();
					follow(event);
				}}
				onPointerMove={(event) => {
					if (event.pointerId === pointer.current) {
						follow(event);
					}
				}}
				onPointerUp={release}
				onPointerCancel={release}
			>
				<div
					id="hero-stick-knob"
					data-active={knob === undefined ? undefined : ''}
					className="absolute top-1/2 left-1/2 size-12 -translate-1/2 rounded-full bg-white/90 shadow-md transition-transform duration-150 data-active:transition-none"
					style={
						isMoved
							? {
									transform: `translate(${String(knob.x)}px, ${String(knob.y)}px)`,
								}
							: undefined
					}
				/>
			</div>
		</div>
	);
};
