import type { createStore } from 'jotai';

import type { Gallery } from '../game/gallery';
import type { Game, GameInput } from '../game/game';
import type { StageScene } from '../game/stage-scene';
import { m } from '../paraglide/messages';

import {
	BEST_ATOM,
	BOARD_ATOM,
	BOARD_ENTRY_ATOM,
	CALLOUT_ATOM,
	EASTER_EGG_HITS_ATOM,
	type EntryStatus,
	GALLERY_ATOM,
	GAME_OVER_ATOM,
	HINT_ATOM,
	INITIALS_ATOM,
	METRES_ATOM,
	MODE_ATOM,
	PHASE_ATOM,
	RESULT_ATOM,
	SCENE_ATOM,
	SCORE_ATOM,
	STAGE_SCENE_ATOM,
	type ShownScene,
	WAITING_ATOM,
} from './atoms';
import { readingDirection } from './direction';
import { addHit, readHits } from './easter-egg-hits';
import type { Score } from './leaderboard';

type LeaderboardModule = typeof import('./leaderboard');

type Store = ReturnType<typeof createStore>;

// Inputs held down by a key or a tap, rather than the analog stick.
export type HeldInput = Exclude<keyof GameInput, 'steer' | 'throttle'>;

// How long the photo takes to fade back in.
const sceneFadeOut = 1500;

export interface HeroOptions {
	// Whether the game has a start screen of its own (on the game's own
	// page), rather than starting from the photo. Leaving a run goes back to
	// the start screen, not the photo.
	hasStartScreen?: boolean;
}

/**
 * Runs the scenes in the hero's stage (the game and the easter egg gallery)
 * and mirrors what they report into the Jotai store for the UI to show.
 */
export class HeroController {
	private readonly _store: Store;
	private readonly _hasStartScreen: boolean;
	// Whichever scene is in the stage: the game or the gallery.
	private _scene: StageScene | undefined;
	// Scenes on their way out, torn down once the next has been drawn.
	private _retiring: StageScene[] = [];
	private _game: Game | undefined;
	private _gallery: Gallery | undefined;
	private _calloutTimeout: ReturnType<typeof setTimeout> | undefined;
	// When the run in play set off, in real time.
	private _setOffAt: number | undefined;
	// The last finished run, to save to the leaderboard.
	private _lastRun: Omit<Score, 'initials'> | undefined;
	// The leaderboard's code, loaded with the board.
	private _leaderboard: LeaderboardModule | undefined;
	private _boardLoad: Promise<void> | undefined;

	public constructor(store: Store, options: HeroOptions = {}) {
		this._store = store;
		this._hasStartScreen = options.hasStartScreen ?? false;
	}

	/**
	 * Creates a game in the stage. The previous scene (if any) is torn down
	 * once the new one has been drawn, so there's no flash between them.
	 * @param shouldSkipIntro - Jump straight to the roll, for restarts.
	 * @param isHeld - Hold me at the start until I press start.
	 */
	private async launch(
		shouldSkipIntro: boolean,
		isHeld = false,
	): Promise<void> {
		const gameModule = await import('../game/game');
		const store = this._store;
		const next = new gameModule.Game(
			{
				onRolling: () => {
					store.set(HINT_ATOM, true);
				},
				onScore: (score, combo) => {
					store.set(SCORE_ATOM, score);
					if (combo > 1) {
						this.callout(m.hero_combo({ combo }), 900);
					}
				},
				onEasterEgg: (id) => {
					store.set(EASTER_EGG_HITS_ATOM, (hits) => addHit(hits, id));
				},
				onBearBlast: (bears, points) => {
					this.callout(
						m.hero_bear_blast({
							bears: '🐻'.repeat(bears),
							count: bears,
							points,
						}),
						1600,
					);
				},
				onDistance: (metres) => {
					store.set(METRES_ATOM, Math.floor(metres));
				},
				onGameOver: (trees, metres) => {
					this.finish(trees, metres);
				},
			},
			{
				skipIntro: shouldSkipIntro,
				isHeld,
				direction: readingDirection(),
			},
		);
		this.show({ kind: 'game', scene: next });
		this._game = next;
		this._setOffAt = isHeld ? undefined : performance.now();
		this.loadBoard();
		this._gallery = undefined;
		this.expose();
		store.set(SCENE_ATOM, 'game');
		store.set(MODE_ATOM, 'game');
		store.set(WAITING_ATOM, isHeld);
		this.resetHud();
	}

	/**
	 * Fetches the leaderboard, once a page (or again, if it couldn't be
	 * reached), so the game-over card knows whether a run makes it. It
	 * isn't fetched again after each run, to keep well inside the free
	 * plan's requests: saving a score answers with the board as it is now.
	 */
	private loadBoard(): void {
		this._boardLoad ??= (async () => {
			try {
				const leaderboard = await import('./leaderboard');
				this._store.set(BOARD_ATOM, await leaderboard.fetchBoard());
				this._leaderboard = leaderboard;
				// Ready for when a run makes the board.
				void import('./initials-entry');
			} catch {
				// The game plays on without a board. Try again next run.
				this._boardLoad = undefined;
			}
		})();
	}

	/**
	 * Puts the game in play on `globalThis.hero`, for anyone who wants to
	 * play with it from the console, and for the end-to-end tests, which
	 * fast-forward it. It's read when it's asked for, so it never keeps a
	 * finished game from being freed.
	 */
	private expose(): void {
		const current = (): Game | undefined => this._game;
		Object.defineProperty(globalThis, 'hero', {
			configurable: true,
			value: {
				get game() {
					return current();
				},
			},
		});
	}

	/**
	 * Puts a scene in the stage, retiring whatever was there.
	 * @param shown - The new scene.
	 */
	private show(shown: ShownScene): void {
		if (this._scene) {
			this._retiring.push(this._scene);
		}
		this._scene = shown.scene;
		this._store.set(STAGE_SCENE_ATOM, shown);
	}

	private disposeRetired(): void {
		for (const scene of this._retiring) {
			scene.dispose();
		}
		this._retiring = [];
	}

	private finish(trees: number, metres: number): void {
		const best = this._store.get(BEST_ATOM);
		const run = {
			trees,
			metres: Math.floor(metres),
			seconds:
				this._setOffAt === undefined
					? 0
					: (performance.now() - this._setOffAt) / 1000,
		};
		this._lastRun = run;
		this._store.set(RESULT_ATOM, { trees, metres: run.metres, best });
		this._store.set(BOARD_ENTRY_ATOM, ({ attempt }) => ({
			status: this.boardStatusFor(run),
			attempt,
		}));
		this._store.set(HINT_ATOM, false);
		this._store.set(GAME_OVER_ATOM, true);
		// Last, so the card is up even if storage fails.
		if (trees > best) {
			this._store.set(BEST_ATOM, trees);
		}
	}

	/**
	 * Whether a run makes the leaderboard.
	 * @param run - The run.
	 * @returns 'entering' if it does, to ask for my initials.
	 */
	private boardStatusFor(run: Omit<Score, 'initials'>): EntryStatus {
		const board = this._store.get(BOARD_ATOM);
		const leaderboard = this._leaderboard;
		if (!board || leaderboard?.placeFor(board, run) === undefined) {
			return 'none';
		}
		return leaderboard.isPlausible(run) ? 'entering' : 'fastForwarded';
	}

	private resetHud(): void {
		this._lastRun = undefined;
		this._store.set(BOARD_ENTRY_ATOM, ({ attempt }) => ({
			status: 'none',
			attempt,
		}));
		this._store.set(GAME_OVER_ATOM, false);
		this._store.set(SCORE_ATOM, 0);
		this._store.set(METRES_ATOM, 0);
	}

	private callout(text: string, duration: number): void {
		this._store.set(CALLOUT_ATOM, { text, isShown: true });
		clearTimeout(this._calloutTimeout);
		this._calloutTimeout = setTimeout(() => {
			this._store.set(CALLOUT_ATOM, { text, isShown: false });
		}, duration);
	}

	/**
	 * Whether the game has a start screen of its own, which leaving a run goes
	 * back to (rather than the photo).
	 * @returns True on the game's own page.
	 */
	public get hasStartScreen(): boolean {
		return this._hasStartScreen;
	}

	/**
	 * Whether a scene is in the stage.
	 * @returns True while the game or the gallery is up.
	 */
	public get hasScene(): boolean {
		return this._scene !== undefined;
	}

	/**
	 * Whether the game is taking steering input (started, not over, not the
	 * gallery).
	 * @returns True while a run is in play.
	 */
	public get isSteerable(): boolean {
		return (
			this._game !== undefined &&
			!this._game.isHeld &&
			!this._store.get(GAME_OVER_ATOM)
		);
	}

	/**
	 * The stage has drawn a scene for the first time: show it, and tear down
	 * the scenes it replaced.
	 * @param scene - The scene that was drawn.
	 */
	public sceneReady(scene: StageScene): void {
		if (scene !== this._scene) {
			return;
		}
		this._store.set(PHASE_ATOM, 'playing');
		this.disposeRetired();
	}

	/**
	 * Starts a run from the photo.
	 */
	public async start(): Promise<void> {
		if (this._game || this._store.get(PHASE_ATOM) === 'loading') {
			return;
		}
		this._store.set(PHASE_ATOM, 'loading');
		this.resetHud();
		try {
			await this.launch(false);
		} catch (error) {
			console.error(error);
			this._store.set(PHASE_ATOM, 'idle');
		}
	}

	/**
	 * Puts the game in the stage, waiting on its start screen. For the game's
	 * own page, which has no photo to start from.
	 */
	public async ready(): Promise<void> {
		if (
			this._game?.isHeld ||
			(!this._scene && this._store.get(PHASE_ATOM) === 'loading')
		) {
			return;
		}
		if (!this._scene) {
			this._store.set(PHASE_ATOM, 'loading');
		}
		try {
			await this.launch(false, true);
		} catch (error) {
			console.error(error);
			this._store.set(PHASE_ATOM, 'idle');
		}
	}

	/**
	 * Starts the run waiting on the start screen.
	 */
	public begin(): void {
		if (!this._game?.isHeld) {
			return;
		}
		this._game.release();
		this._setOffAt = performance.now();
		this._store.set(WAITING_ATOM, false);
	}

	/**
	 * Leaves the game or the gallery: back to the start screen on the game's
	 * own page, or back to the photo.
	 */
	public leave(): void {
		if (this._hasStartScreen) {
			void this.ready();
		} else {
			this.stop();
		}
	}

	/**
	 * Starts a fresh run, straight into the roll.
	 */
	public rollAgain(): void {
		if (this._scene) {
			void this.launch(true);
		}
	}

	/**
	 * Swaps the game for the easter egg gallery.
	 */
	public async openGallery(): Promise<void> {
		if (!this._scene) {
			return;
		}
		const galleryModule = await import('../game/gallery');
		const next = new galleryModule.Gallery(
			{
				onSelect: (index, caption) => {
					this._store.set(GALLERY_ATOM, (view) => ({
						...view,
						index,
						caption,
					}));
				},
			},
			// Storage could hold anything.
			readHits(this._store.get(EASTER_EGG_HITS_ATOM)),
			readingDirection(),
		);
		this.show({ kind: 'gallery', scene: next });
		this._gallery = next;
		this._game = undefined;
		this._store.set(WAITING_ATOM, false);
		this._store.set(GAME_OVER_ATOM, false);
		this._store.set(GALLERY_ATOM, (view) => ({
			...view,
			count: next.count,
			hits: next.hits,
		}));
		this._store.set(SCENE_ATOM, 'gallery');
		this._store.set(MODE_ATOM, 'gallery');
	}

	/**
	 * Goes back to the photo, tearing the scene down once it has faded out.
	 */
	public stop(): void {
		const scene = this._scene;
		if (!scene) {
			return;
		}
		this._scene = undefined;
		this._game = undefined;
		this._gallery = undefined;
		this._store.set(PHASE_ATOM, 'idle');
		this._store.set(SCENE_ATOM, undefined);
		this._store.set(WAITING_ATOM, false);
		this._store.set(HINT_ATOM, false);
		this._store.set(GAME_OVER_ATOM, false);
		this._retiring.push(scene);
		// Keep drawing the scene while the photo fades back in, then let the
		// canvas go (unless a new scene has already taken its place). The mode
		// stays as it is, so the game's HUD doesn't flash up over the gallery
		// as everything fades out, until the next scene sets its own.
		setTimeout(() => {
			if (this._scene) {
				return;
			}
			this._store.set(STAGE_SCENE_ATOM, undefined);
			this.disposeRetired();
		}, sceneFadeOut);
	}

	/**
	 * Saves the last run to the leaderboard.
	 * @param initials - The initials to put by it.
	 * @param token - Turnstile's token, to show a person is saving it.
	 */
	public async saveScore(initials: string, token: string): Promise<void> {
		const run = this._lastRun;
		const leaderboard = this._leaderboard;
		const { status, attempt } = this._store.get(BOARD_ENTRY_ATOM);
		if (
			!run ||
			!leaderboard ||
			(status !== 'entering' && status !== 'failed')
		) {
			return;
		}
		this._store.set(INITIALS_ATOM, initials);
		this._store.set(BOARD_ENTRY_ATOM, { status: 'saving', attempt });
		const result = await leaderboard.saveScore({ ...run, initials }, token);
		// Moved on to another run while it saved.
		if (this._lastRun !== run) {
			return;
		}
		if (result.kind === 'saved' || result.kind === 'missed') {
			this._store.set(BOARD_ATOM, result.entries);
		}
		this._store.set(BOARD_ENTRY_ATOM, {
			status: result.kind,
			place: result.kind === 'saved' ? result.place : undefined,
			// A fresh check for a person, for another try.
			attempt: attempt + 1,
		});
	}

	public nextEgg(): void {
		this._gallery?.next();
	}

	public previousEgg(): void {
		this._gallery?.previous();
	}

	/**
	 * Pulls the gallery along with a finger.
	 * @param across - How far the finger has moved towards the next easter
	 * egg, as a share of the stage's width.
	 */
	public dragEgg(across: number): void {
		this._gallery?.drag(across);
	}

	/**
	 * Lets go of the gallery after a drag.
	 * @param velocity - How fast the finger was moving towards the next
	 * easter egg, in stage widths a second.
	 */
	public releaseEgg(velocity: number): void {
		this._gallery?.release(velocity);
	}

	/**
	 * Moves the gallery to one easter egg.
	 * @param index - Which one.
	 */
	public selectEgg(index: number): void {
		this._gallery?.select(index);
	}

	/**
	 * Holds or lets go of a key-style input.
	 * @param input - Which input.
	 * @param isHeld - Whether it's now held down.
	 */
	public hold(input: HeldInput, isHeld: boolean): void {
		if (!this._game || !this.isSteerable) {
			return;
		}
		this._game.input[input] = isHeld;
		if (input === 'left' || input === 'right') {
			this.hideHint();
		}
	}

	/**
	 * Sets the analog stick's input.
	 * @param steer - -1 (left) to 1 (right).
	 * @param throttle - -1 (slower) to 1 (faster).
	 */
	public setStick(steer: number, throttle: number): void {
		if (!this._game) {
			return;
		}
		this._game.input.steer = steer;
		this._game.input.throttle = throttle;
	}

	public hideHint(): void {
		this._store.set(HINT_ATOM, false);
	}
}
