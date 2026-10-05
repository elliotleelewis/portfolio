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
import { Button } from './button';
import { Card } from './card';
import { useController } from './context';
import { LeaderboardTable } from './leaderboard-table';

// Only loaded when a run makes the board, with Turnstile's loader and the
// rules for initials, so none of it is in the page's first load.
const InitialsEntry = lazy(async () => {
	const module = await import('./initials-entry');
	return { default: module.InitialsEntry };
});

// While the run's waiting on my initials.
const enteringStatuses = new Set<EntryStatus>([
	'entering',
	'saving',
	'failed',
	'blocked',
]);

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
					<span className="text-xs text-muted">
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
					<span className="text-xs text-muted">
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
			className="pointer-events-none absolute inset-0 flex items-center justify-center bg-scrim/30 p-6 opacity-0 transition-opacity duration-500 data-show:pointer-events-auto data-show:opacity-100"
			role="dialog"
			aria-labelledby="hero-over-title"
		>
			<Card className="max-h-full w-full max-w-sm overflow-y-auto p-6 text-center">
				{isEntering ? (
					<>
						<h2
							id="hero-over-title"
							className="font-mono text-xs tracking-[0.25em] text-accent uppercase"
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
							className="mt-1 font-display text-2xl font-semibold"
						>
							{m.hero_caught()}
						</h2>
						<RunStats />
						<p
							id="hero-over-best"
							data-new={isNewBest ? '' : undefined}
							className="mt-3 text-sm text-muted data-new:inline-block data-new:rounded-full data-new:bg-accent data-new:px-3 data-new:py-0.5 data-new:font-semibold data-new:text-on-accent"
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
						<Button
							id="hero-again"
							ref={again}
							variant="primary"
							className="mt-5 rounded-full px-6 py-2.5"
							onClick={() => {
								controller.rollAgain();
							}}
						>
							{m.hero_roll_again()}
						</Button>
						<div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
							<Button
								id="hero-gallery-open"
								variant="link"
								onClick={() => {
									void controller.openGallery();
								}}
							>
								{m.hero_see_easter_eggs()}
							</Button>
							<Button
								id="hero-over-exit"
								variant="link"
								onClick={() => {
									controller.leave();
								}}
							>
								{controller.hasStartScreen
									? m.hero_back_to_start()
									: m.hero_back_to_trail()}
							</Button>
						</div>
					</>
				)}
			</Card>
		</div>
	);
};
