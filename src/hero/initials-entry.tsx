import { useAtomValue } from 'jotai';
import {
	type ChangeEvent,
	type FC,
	type KeyboardEvent,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from 'react';

import type { TurnstileAction } from '../../functions/_lib/turnstile';
import { m } from '../paraglide/messages';

import { BOARD_ENTRY_ATOM, INITIALS_ATOM } from './atoms';
import { useController } from './context';
import { INITIALS_LENGTH, readInitials, stepCharacter } from './initials';
import { loadTurnstile, siteKey } from './turnstile';

// What can go in an initial, as typed (in either case).
const typeable = /[\dA-Za-z]/g;

// Matches the Function's, so a token made here counts there.
const turnstileAction: TurnstileAction = 'score';

const stepButton =
	'flex h-6 w-12 cursor-pointer items-center justify-center rounded-md text-xs text-slate-500 hover:bg-slate-900/10 hover:text-slate-900';

interface TurnstileState {
	token: string | undefined;
	hasFailed: boolean;
}

/**
 * Asks Turnstile whether a person is saving the score. It only shows itself
 * if it can't tell without asking.
 * @param container - Where Turnstile puts its widget.
 * @returns Turnstile's token once it's sure, and whether it failed.
 */
const useTurnstile = (
	container: RefObject<HTMLDivElement | null>,
): TurnstileState => {
	const [state, setState] = useState<TurnstileState>({
		token: undefined,
		hasFailed: false,
	});

	useEffect(() => {
		const target = container.current;
		if (!target) {
			return;
		}
		const cancel = new AbortController();
		let remove: (() => void) | undefined;
		const fail = (): void => {
			if (!cancel.signal.aborted) {
				setState({ token: undefined, hasFailed: true });
			}
		};
		void (async () => {
			try {
				const turnstile = await loadTurnstile();
				if (cancel.signal.aborted) {
					return;
				}
				const id = turnstile.render(target, {
					sitekey: siteKey(),
					action: turnstileAction,
					appearance: 'interaction-only',
					callback: (token) => {
						setState({ token, hasFailed: false });
					},
					// eslint-disable-next-line @typescript-eslint/naming-convention -- Turnstile's name for it.
					'expired-callback': () => {
						setState({ token: undefined, hasFailed: false });
					},
					'error-callback': fail,
				});
				remove = () => {
					turnstile.remove(id);
				};
			} catch {
				fail();
			}
		})();
		return () => {
			cancel.abort();
			remove?.();
		};
	}, [container]);

	return state;
};

/**
 * Three initials for the leaderboard, picked like on an arcade cabinet:
 * ↑ and ↓ (or ▲ and ▼) step each one through the letters and digits, ← and
 * → move between them, or I can just type them.
 * @returns The initials and the button that saves them.
 */
export const InitialsEntry: FC = () => {
	const controller = useController();
	const { status } = useAtomValue(BOARD_ENTRY_ATOM);
	const stored = useAtomValue(INITIALS_ATOM);
	const [initials, setInitials] = useState(() => {
		const start = readInitials(stored);
		return Array.from({ length: INITIALS_LENGTH }, (_, i) =>
			start.charAt(i),
		);
	});
	const [active, setActive] = useState(0);
	const slots = useRef<(HTMLInputElement | null)[]>([]);
	const widget = useRef<HTMLDivElement>(null);
	const { token, hasFailed } = useTurnstile(widget);
	const isSaving = status === 'saving';
	const value = initials.join('');
	// The Function turned down the last initials: they'd put something rude
	// on the board.
	const isRude = status === 'blocked';

	useEffect(() => {
		slots.current[0]?.focus();
	}, []);

	const moveTo = (index: number): void => {
		const next = Math.min(Math.max(index, 0), initials.length - 1);
		setActive(next);
		// Selected, so whatever's typed next replaces it.
		slots.current[next]?.focus();
		slots.current[next]?.select();
	};

	const setAt = (index: number, character: string): void => {
		setInitials((current) =>
			current.map((existing, i) => (i === index ? character : existing)),
		);
	};

	const step = (index: number, delta: number): void => {
		setAt(index, stepCharacter(initials[index] ?? 'A', delta));
		moveTo(index);
	};

	const save = (): void => {
		if (token && !isSaving) {
			void controller.saveScore(value, token);
		}
	};

	// Typing comes in as the input changing, rather than as key presses:
	// phones' on-screen keyboards don't say which key was pressed.
	const onChange = (
		event: ChangeEvent<HTMLInputElement>,
		index: number,
	): void => {
		const { nativeEvent, currentTarget } = event;
		const typed =
			nativeEvent instanceof InputEvent && nativeEvent.data !== null
				? nativeEvent.data
				: currentTarget.value;
		const character = typed.match(typeable)?.at(-1);
		if (character !== undefined) {
			setAt(index, character.toUpperCase());
			moveTo(index + 1);
		} else if (currentTarget.value === '') {
			// Deleted: back to the one before, like an arcade cabinet, which
			// never leaves a gap.
			moveTo(index - 1);
		}
	};

	const onKeyDown = (event: KeyboardEvent, index: number): void => {
		switch (event.key) {
			case 'ArrowUp': {
				step(index, 1);
				break;
			}
			case 'ArrowDown': {
				step(index, -1);
				break;
			}
			case 'ArrowLeft':
			case 'Backspace': {
				moveTo(index - 1);
				break;
			}
			case 'ArrowRight': {
				moveTo(index + 1);
				break;
			}
			case 'Enter': {
				save();
				break;
			}
			default: {
				return;
			}
		}
		event.preventDefault();
	};

	return (
		<div id="hero-initials" className="mt-5">
			<p className="text-sm font-semibold">
				{m.hero_board_enter_initials()}
			</p>
			{/* Initials read left to right, whichever way the page does. */}
			<div
				dir="ltr"
				role="group"
				aria-label={m.hero_board_initials()}
				className="mt-2 flex justify-center gap-2"
			>
				{initials.map((character, index) => (
					<div
						// There are always three, and they never move.
						key={index}
						className="flex flex-col items-center"
					>
						<button
							type="button"
							tabIndex={-1}
							aria-hidden="true"
							className={stepButton}
							onClick={() => {
								step(index, 1);
							}}
						>
							▲
						</button>
						<div className="relative">
							<input
								ref={(element) => {
									slots.current[index] = element;
								}}
								type="text"
								value={character}
								aria-label={m.hero_board_initial({
									number: index + 1,
								})}
								autoCapitalize="characters"
								autoComplete="off"
								autoCorrect="off"
								spellCheck={false}
								enterKeyHint={
									index === initials.length - 1
										? 'done'
										: 'next'
								}
								data-active={index === active ? '' : undefined}
								className="peer h-14 w-12 cursor-pointer rounded-lg bg-slate-900 text-center font-mono text-3xl text-amber-300 caret-transparent ring-amber-400 outline-none selection:bg-transparent selection:text-amber-300 data-active:ring-4"
								onFocus={(event) => {
									setActive(index);
									event.currentTarget.select();
								}}
								onChange={(event) => {
									onChange(event, index);
								}}
								onKeyDown={(event) => {
									onKeyDown(event, index);
								}}
							/>
							{/* The cursor, blinking under the initial being picked. */}
							<span
								aria-hidden="true"
								className="pointer-events-none absolute inset-x-3.5 bottom-2.5 h-0.5 bg-amber-300 opacity-0 peer-data-active:opacity-100 peer-data-active:motion-safe:animate-pulse"
							/>
						</div>
						<button
							type="button"
							tabIndex={-1}
							aria-hidden="true"
							className={stepButton}
							onClick={() => {
								step(index, -1);
							}}
						>
							▼
						</button>
					</div>
				))}
			</div>
			<p className="mt-1 text-xs text-slate-600 any-pointer-coarse:hidden">
				{m.hero_board_initials_help()}
			</p>
			<div ref={widget} className="flex justify-center" />
			<p
				id="hero-initials-status"
				className="text-sm text-red-700 not-empty:mt-1"
				aria-live="polite"
			>
				{isRude && m.hero_board_blocked()}
				{!isRude &&
					(hasFailed || status === 'failed') &&
					m.hero_board_failed()}
			</p>
			<button
				id="hero-initials-save"
				type="button"
				disabled={!token || isSaving}
				className="mt-3 cursor-pointer rounded-full bg-slate-900 px-6 py-2.5 font-semibold text-white hover:bg-slate-700 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
				onClick={save}
			>
				{isSaving ? m.hero_board_saving() : m.hero_board_save()}
			</button>
			<p className="mt-3">
				<button
					id="hero-initials-skip"
					type="button"
					disabled={isSaving}
					className="cursor-pointer rounded-sm text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
					onClick={() => {
						controller.skipBoard();
					}}
				>
					{m.hero_board_skip()}
				</button>
			</p>
		</div>
	);
};
