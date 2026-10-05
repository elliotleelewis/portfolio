import { useAtomValue } from 'jotai';
import type { FC } from 'react';

import { m } from '../paraglide/messages';

import { BOARD_ATOM, BOARD_ENTRY_ATOM } from './atoms';

/**
 * The shared leaderboard, with my run picked out if I've just saved it.
 * @returns The board, or nothing if it couldn't be loaded.
 */
export const LeaderboardTable: FC = () => {
	const board = useAtomValue(BOARD_ATOM);
	const { status, place } = useAtomValue(BOARD_ENTRY_ATOM);
	if (!board) {
		return null;
	}
	const mine = status === 'saved' ? place : undefined;

	return (
		<table id="hero-board" className="mt-4 w-full font-mono text-sm/6">
			<caption className="mb-1 text-xs font-semibold tracking-widest text-slate-600 uppercase">
				{m.hero_board_title()}
			</caption>
			<thead className="sr-only">
				<tr>
					<th scope="col">{m.hero_board_place()}</th>
					<th scope="col">{m.hero_board_initials_column()}</th>
					<th scope="col">{m.hero_board_trees_column()}</th>
					<th scope="col">{m.hero_board_distance_column()}</th>
				</tr>
			</thead>
			<tbody>
				{board.length === 0 && (
					<tr>
						<td colSpan={4} className="text-slate-600">
							{m.hero_board_empty()}
						</td>
					</tr>
				)}
				{board.map((entry, index) => (
					<tr
						// Places are unique, and the board is replaced whole.
						key={index}
						data-mine={index + 1 === mine ? '' : undefined}
						className="data-mine:bg-amber-300/60 data-mine:font-bold"
					>
						<td className="w-8 ps-2 text-start text-slate-500">
							{index + 1}
						</td>
						<td className="text-start" dir="ltr">
							{entry.initials}
						</td>
						<td className="text-end">
							{m.hero_board_trees({ trees: entry.trees })}
						</td>
						<td className="pe-2 text-end">
							{m.hero_board_metres({ metres: entry.metres })}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
};
