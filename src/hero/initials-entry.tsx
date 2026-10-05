import { useAtomValue } from 'jotai';
import {
	type FC,
	type KeyboardEvent,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from 'react';

import { TURNSTILE_ACTION } from '../leaderboard/board';
import {
	INITIALS_LENGTH,
	INITIAL_CHARACTERS,
	isBlocked,
	readInitials,
	stepCharacter,
} from '../leaderboard/initials';
import { m } from '../paraglide/messages';

import { BOARD_ENTRY_ATOM, INITIALS_ATOM } from './atoms';
import { useController } from './context';
import { loadTurnstile, siteKey } from './turnstile';

const typeable = /^[\dA-Za-z]$/;

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
					action: TURNSTILE_ACTION,
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
	const slots = useRef<(HTMLDivElement | null)[]>([]);
	const widget = useRef<HTMLDivElement>(null);
	const { token, hasFailed } = useTurnstile(widget);
	const isSaving = status === 'saving';
	const value = initials.join('');
	const isRude = isBlocked(value);

	useEffect(() => {
		slots.current[0]?.focus();
	}, []);

	const moveTo = (index: number): void => {
		const next = Math.min(Math.max(index, 0), initials.length - 1);
		setActive(next);
		slots.current[next]?.focus();
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
		if (token && !isSaving && !isRude) {
			void controller.saveScore(value, token);
		}
	};

	const onKeyDown = (event: KeyboardEvent, index: number): void => {
		const { key } = event;
		if (typeable.test(key)) {
			setAt(index, key.toUpperCase());
			moveTo(index + 1);
		} else
			switch (key) {
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
		<div id="hero-initials" className="mt-4">
			<p className="font-semibold">{m.hero_board_high_score()}</p>
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
						<div
							ref={(element) => {
								slots.current[index] = element;
							}}
							role="spinbutton"
							tabIndex={0}
							aria-label={m.hero_board_initial({
								number: index + 1,
							})}
							aria-valuemin={0}
							aria-valuemax={INITIAL_CHARACTERS.length - 1}
							aria-valuenow={INITIAL_CHARACTERS.indexOf(
								character,
							)}
							aria-valuetext={character}
							data-active={index === active ? '' : undefined}
							className="flex h-14 w-12 cursor-pointer items-center justify-center rounded-lg bg-slate-900 font-mono text-3xl text-amber-300 ring-amber-400 outline-none data-active:ring-4"
							onFocus={() => {
								setActive(index);
							}}
							onClick={() => {
								moveTo(index);
							}}
							onKeyDown={(event) => {
								onKeyDown(event, index);
							}}
						>
							<span className="border-b-2 border-transparent in-data-active:border-amber-300 in-data-active:motion-safe:animate-pulse">
								{character}
							</span>
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
				disabled={!token || isSaving || isRude}
				className="mt-2 cursor-pointer rounded-full bg-amber-400 px-6 py-2.5 font-semibold text-slate-900 hover:bg-amber-300 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
				onClick={save}
			>
				{isSaving ? m.hero_board_saving() : m.hero_board_save()}
			</button>
		</div>
	);
};
