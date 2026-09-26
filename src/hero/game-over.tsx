import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';

import { GAME_OVER_ATOM, RESULT_ATOM } from './atoms';
import { bestMessage } from './best';
import { useController } from './context';

/**
 * The card when a bear catches me: how the run went, and what next.
 * @returns The card.
 */
export const GameOver = () => {
	const controller = useController();
	const isShown = useAtomValue(GAME_OVER_ATOM);
	const { trees, metres, best } = useAtomValue(RESULT_ATOM);
	const again = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (isShown) {
			again.current?.focus();
		}
	}, [isShown]);

	return (
		<div
			id="hero-over"
			data-show={isShown ? '' : undefined}
			className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/30 p-6 opacity-0 transition-opacity duration-500 data-show:pointer-events-auto data-show:opacity-100"
			role="dialog"
			aria-labelledby="hero-over-title"
		>
			<div className="w-full max-w-sm rounded-2xl bg-white/85 p-6 text-center text-slate-900 shadow-2xl backdrop-blur-md">
				<p className="text-5xl" aria-hidden="true">
					🐻
				</p>
				<h3 id="hero-over-title" className="mt-2 text-2xl font-black">
					Caught by a bear!
				</h3>
				<p className="mt-2">
					You flattened <strong id="hero-over-score">{trees}</strong>{' '}
					{trees === 1 ? 'tree' : 'trees'} and rolled{' '}
					<strong id="hero-over-distance">{metres}</strong>m.
				</p>
				<p id="hero-over-best" className="mt-1 text-sm text-slate-600">
					{bestMessage(trees, best)}
				</p>
				<div className="mt-5 flex flex-wrap justify-center gap-2">
					<button
						id="hero-again"
						ref={again}
						type="button"
						className="cursor-pointer rounded-full bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none"
						onClick={() => {
							controller.rollAgain();
						}}
					>
						Roll again
					</button>
					<button
						id="hero-gallery-open"
						type="button"
						className="cursor-pointer rounded-full border border-slate-900/20 px-5 py-2.5 font-semibold hover:bg-slate-900/5 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none"
						onClick={() => {
							void controller.openGallery();
						}}
					>
						See the easter eggs
					</button>
					<button
						id="hero-over-exit"
						type="button"
						className="cursor-pointer rounded-full border border-slate-900/20 px-5 py-2.5 font-semibold hover:bg-slate-900/5 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none"
						onClick={() => {
							controller.leave();
						}}
					>
						{controller.hasStartScreen
							? 'Back to the start'
							: 'Back to the trail'}
					</button>
				</div>
			</div>
		</div>
	);
};
