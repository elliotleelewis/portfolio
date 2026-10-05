import { useAtomValue } from 'jotai';
import { type FC, useState } from 'react';

import { m } from '../paraglide/messages';

import { BOARD_ATOM, BOARD_ENTRY_ATOM } from './atoms';
import { type BoardRow, compactRows } from './board-rows';
import { Button } from './button';

/**
 * The shared leaderboard, kept short: the top three, and my run if I've
 * just saved it further down. The rest are a tap away.
 * @returns The board, or nothing if it couldn't be loaded.
 */
export const LeaderboardTable: FC = () => {
	const entries = useAtomValue(BOARD_ATOM)?.entries;
	const { status, place } = useAtomValue(BOARD_ENTRY_ATOM);
	const [isExpanded, setIsExpanded] = useState(false);
	if (!entries) {
		return null;
	}
	const mine = status === 'saved' && place !== undefined ? place - 1 : -1;
	const compact = compactRows(entries.length, mine);
	const isFull = compact.length >= entries.length;
	const rows: BoardRow[] =
		isExpanded || isFull ? entries.map((_, index) => index) : compact;

	return (
		<div className="mt-4">
			<table id="hero-board" className="w-full font-mono text-sm/6">
				<caption className="mb-1 text-xs tracking-[0.25em] text-muted uppercase">
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
					{entries.length === 0 && (
						<tr>
							<td colSpan={4} className="text-muted">
								{m.hero_board_empty()}
							</td>
						</tr>
					)}
					{rows.map((row, i) => {
						if (row === 'gap') {
							return (
								// Gaps are never next to each other, so the row
								// before names this one.
								<tr
									key={`gap-${String(rows[i - 1])}`}
									aria-hidden="true"
								>
									<td colSpan={4} className="text-muted">
										⋯
									</td>
								</tr>
							);
						}
						const entry = entries[row];
						return (
							<tr
								key={row}
								data-mine={row === mine ? '' : undefined}
								className="data-mine:bg-accent/25 data-mine:font-bold"
							>
								<td className="w-8 ps-2 text-start text-muted">
									{row + 1}
								</td>
								<td className="text-start" dir="ltr">
									{entry.initials}
								</td>
								<td className="text-end">
									{m.hero_board_trees({ trees: entry.trees })}
								</td>
								<td className="pe-2 text-end">
									{m.hero_board_metres({
										metres: entry.metres,
									})}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			{!isFull && (
				<Button
					id="hero-board-toggle"
					variant="link"
					aria-expanded={isExpanded}
					aria-controls="hero-board"
					className="mt-1 text-xs"
					onClick={() => {
						setIsExpanded((expanded) => !expanded);
					}}
				>
					{isExpanded
						? m.hero_board_show_fewer()
						: m.hero_board_show_all()}
				</Button>
			)}
		</div>
	);
};
