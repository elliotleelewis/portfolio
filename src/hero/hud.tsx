import { useAtomValue } from 'jotai';

import {
	CALLOUT_ATOM,
	HINT_ATOM,
	METRES_ATOM,
	SCORE_ATOM,
	WAITING_ATOM,
} from './atoms';
import { useController } from './context';
import { Stick } from './stick';

/**
 * The in-game overlay: score, distance, the way out, combo callouts, the
 * controls hint and (on touch screens) the stick.
 * @returns The HUD.
 */
export const Hud = () => {
	const controller = useController();
	const score = useAtomValue(SCORE_ATOM);
	const metres = useAtomValue(METRES_ATOM);
	const callout = useAtomValue(CALLOUT_ATOM);
	const isHintShown = useAtomValue(HINT_ATOM);
	// Out of the way of the start screen until the run begins.
	const isWaiting = useAtomValue(WAITING_ATOM);

	return (
		<div
			className={
				isWaiting
					? 'pointer-events-none invisible absolute inset-0 opacity-0'
					: 'pointer-events-none absolute inset-0 opacity-0 transition-opacity delay-700 duration-700 group-data-[state=playing]:opacity-100'
			}
			aria-live="polite"
		>
			<div className="absolute inset-s-4 top-4 flex gap-2 font-mono text-sm text-slate-900 group-data-[mode=gallery]:hidden sm:text-base">
				<div className="rounded-lg bg-white/70 px-3 py-1.5 backdrop-blur-sm">
					🌲 <span id="hero-score">{score}</span>
				</div>
				<div className="rounded-lg bg-white/70 px-3 py-1.5 backdrop-blur-sm">
					<span id="hero-distance">{metres}</span>m
				</div>
			</div>
			<button
				id="hero-exit"
				type="button"
				className="pointer-events-auto absolute inset-e-4 top-4 cursor-pointer rounded-lg bg-white/70 px-3 py-1.5 text-sm text-slate-900 backdrop-blur-sm group-data-[state=idle]:pointer-events-none hover:bg-white/90 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none sm:text-base"
				onClick={() => {
					controller.leave();
				}}
			>
				{controller.hasStartScreen
					? 'Back to the start ✕'
					: 'Back to the trail ✕'}
			</button>
			<div
				id="hero-combo"
				data-show={callout.isShown ? '' : undefined}
				className="absolute top-20 left-1/2 -translate-x-1/2 text-3xl font-black text-amber-400 opacity-0 drop-shadow-[0_2px_2px_rgb(0_0_0/0.5)] transition-all duration-300 data-show:top-16 data-show:opacity-100"
			>
				{callout.text}
			</div>
			<p
				id="hero-hint"
				data-show={isHintShown ? '' : undefined}
				className="absolute inset-x-0 bottom-6 text-center text-sm font-semibold text-slate-900 opacity-0 transition-opacity duration-500 group-data-[mode=gallery]:hidden data-show:opacity-100 sm:text-base any-pointer-coarse:bottom-38"
			>
				<span className="rounded-full bg-white/70 px-4 py-2 backdrop-blur-sm any-pointer-coarse:hidden">
					Use ← → to flatten trees · ↑ ↓ for speed · watch out for
					bears 🐻
				</span>
				<span className="mx-4 hidden rounded-2xl bg-white/70 px-4 py-2 backdrop-blur-sm any-pointer-coarse:inline-block">
					Steer and speed up with the stick · dodge the bears 🐻
				</span>
			</p>
			<Stick />
		</div>
	);
};
