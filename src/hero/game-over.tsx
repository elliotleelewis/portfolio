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

const link =
	'cursor-pointer rounded-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none';

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
 * How the run went, at a glance: trees and distance, big. Screen readers
 * get it as a sentence.
 * @returns The run's numbers.
 */
const RunStats: FC = () => {
	const { trees, metres } = useAtomValue(RESULT_ATOM);

	return (
		<>
			<div
				className="mt-3 flex justify-center gap-8 font-mono"
				aria-hidden="true"
			>
				<p className="flex flex-col">
					<span id="hero-over-score" className="text-4xl font-bold">
						{m.hero_over_trees_count({ trees })}
					</span>
					<span className="text-xs text-slate-600">
						{m.hero_over_trees_label({ trees })}
					</span>
				</p>
				<p className="flex flex-col">
					<span
						id="hero-over-distance"
						className="text-4xl font-bold"
					>
						{m.hero_board_metres({ metres })}
					</span>
					<span className="text-xs text-slate-600">
						{m.hero_over_rolled()}
					</span>
				</p>
			</div>
			<p className="sr-only">
				<ParaglideMessage
					message={m.hero_result}
					inputs={{ trees, metres }}
					markup={{
						score: ({ children }) => children,
						distance: ({ children }) => children,
					}}
				/>
			</p>
		</>
	);
};

/**
 * The card when a bear catches me. If the run makes the leaderboard, it
 * first asks for my initials, and nothing else. Then it's how the run went,
 * where it stands, and what next.
 * @returns The card.
 */
export const GameOver: FC = () => {
	const controller = useController();
	const isShown = useAtomValue(GAME_OVER_ATOM);
	const { trees, best } = useAtomValue(RESULT_ATOM);
	const { status, place, attempt } = useAtomValue(BOARD_ENTRY_ATOM);
	const again = useRef<HTMLButtonElement>(null);
	const isEntering = enteringStatuses.has(status);
	const message = boardMessage(status, place);
	const isNewBest = trees > best;

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
				{isEntering ? (
					<>
						<h2
							id="hero-over-title"
							className="font-mono text-sm font-bold tracking-widest text-amber-700 uppercase"
						>
							{m.hero_board_new_high_score()}
						</h2>
						<RunStats />
						{isShown && (
							// A fresh one for each try, for a fresh check for a
							// person.
							<Suspense>
								<InitialsEntry key={attempt} />
							</Suspense>
						)}
					</>
				) : (
					<>
						<p className="text-4xl" aria-hidden="true">
							🐻
						</p>
						<h2
							id="hero-over-title"
							className="mt-1 text-2xl font-black"
						>
							{m.hero_caught()}
						</h2>
						<RunStats />
						<p
							id="hero-over-best"
							data-new={isNewBest ? '' : undefined}
							className="mt-3 text-sm text-slate-600 data-new:inline-block data-new:rounded-full data-new:bg-amber-300/70 data-new:px-3 data-new:py-0.5 data-new:font-semibold data-new:text-slate-900"
						>
							{bestMessage(trees, best)}
						</p>
						{message !== undefined && (
							<p
								id="hero-board-message"
								className="mt-4 text-sm font-semibold"
							>
								{message}
							</p>
						)}
						<LeaderboardTable />
						<button
							id="hero-again"
							ref={again}
							type="button"
							className="mt-5 cursor-pointer rounded-full bg-slate-900 px-6 py-2.5 font-semibold text-white hover:bg-slate-700 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none"
							onClick={() => {
								controller.rollAgain();
							}}
						>
							{m.hero_roll_again()}
						</button>
						<div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
							<button
								id="hero-gallery-open"
								type="button"
								className={link}
								onClick={() => {
									void controller.openGallery();
								}}
							>
								{m.hero_see_easter_eggs()}
							</button>
							<button
								id="hero-over-exit"
								type="button"
								className={link}
								onClick={() => {
									controller.leave();
								}}
							>
								{controller.hasStartScreen
									? m.hero_back_to_start()
									: m.hero_back_to_trail()}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
};
