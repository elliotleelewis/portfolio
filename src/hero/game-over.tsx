import { ParaglideMessage } from '@inlang/paraglide-js-react';
import { useAtomValue } from 'jotai';
import { type FC, Suspense, lazy, useEffect, useRef } from 'react';

import { m } from '../paraglide/messages';

import {
	BOARD_ENTRY_ATOM,
	type EntryStatus,
	GAME_OVER_ATOM,
	RESULT_ATOM,
} from './atoms';
import { bestMessage } from './best';
import { useController } from './context';
import { LeaderboardTable } from './leaderboard-table';

// Only loaded when a run makes the board, with Turnstile's loader and the
// rules for initials, so none of it is in the page's first load.
const InitialsEntry = lazy(async () => {
	const module = await import('./initials-entry');
	return { default: module.InitialsEntry };
});

// While the run's waiting on my initials.
const enteringStatuses = new Set<EntryStatus>(['entering', 'saving', 'failed']);

/**
 * What to say about how saving the run to the leaderboard went.
 * @param status - Where the run stands with the leaderboard.
 * @param place - Its place, once saved.
 * @returns What to say, if anything.
 */
const boardMessage = (
	status: EntryStatus,
	place: number | undefined,
): string | undefined => {
	switch (status) {
		case 'saved': {
			return place === undefined
				? undefined
				: m.hero_board_saved({ place });
		}
		case 'missed': {
			return m.hero_board_missed();
		}
		case 'rejected': {
			return m.hero_board_rejected();
		}
		case 'closed': {
			return m.hero_board_closed();
		}
		case 'fastForwarded': {
			return m.hero_board_fast_forward();
		}
		default: {
			return undefined;
		}
	}
};

/**
 * The card when a bear catches me: how the run went, and what next.
 * @returns The card.
 */
export const GameOver: FC = () => {
	const controller = useController();
	const isShown = useAtomValue(GAME_OVER_ATOM);
	const { trees, metres, best } = useAtomValue(RESULT_ATOM);
	const { status, place, attempt } = useAtomValue(BOARD_ENTRY_ATOM);
	const again = useRef<HTMLButtonElement>(null);
	const isEntering = enteringStatuses.has(status);
	const message = boardMessage(status, place);

	useEffect(() => {
		// The initials take focus themselves.
		if (isShown && !isEntering) {
			again.current?.focus();
		}
	}, [isShown, isEntering]);

	return (
		<div
			id="hero-over"
			data-show={isShown ? '' : undefined}
			className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/30 p-6 opacity-0 transition-opacity duration-500 data-show:pointer-events-auto data-show:opacity-100"
			role="dialog"
			aria-labelledby="hero-over-title"
		>
			<div className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-white/85 p-6 text-center text-slate-900 shadow-2xl backdrop-blur-md">
				<p className="text-5xl" aria-hidden="true">
					🐻
				</p>
				<h2 id="hero-over-title" className="mt-2 text-2xl font-black">
					{m.hero_caught()}
				</h2>
				<p className="mt-2">
					<ParaglideMessage
						message={m.hero_result}
						inputs={{ trees, metres }}
						markup={{
							score: ({ children }) => (
								<strong id="hero-over-score">{children}</strong>
							),
							distance: ({ children }) => (
								<strong id="hero-over-distance">
									{children}
								</strong>
							),
						}}
					/>
				</p>
				<p id="hero-over-best" className="mt-1 text-sm text-slate-600">
					{bestMessage(trees, best)}
				</p>
				{isShown && isEntering && (
					// A fresh one for each try, for a fresh check for a person.
					<Suspense>
						<InitialsEntry key={attempt} />
					</Suspense>
				)}
				{message !== undefined && (
					<p id="hero-board-message" className="mt-3 font-semibold">
						{message}
					</p>
				)}
				{!isEntering && <LeaderboardTable />}
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
						{m.hero_roll_again()}
					</button>
					<button
						id="hero-gallery-open"
						type="button"
						className="cursor-pointer rounded-full border border-slate-900/20 px-5 py-2.5 font-semibold hover:bg-slate-900/5 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none"
						onClick={() => {
							void controller.openGallery();
						}}
					>
						{m.hero_see_easter_eggs()}
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
							? m.hero_back_to_start()
							: m.hero_back_to_trail()}
					</button>
				</div>
			</div>
		</div>
	);
};
