import { type createStore } from 'jotai';

import { type Gallery } from '../game/gallery';
import { type Game, type GameInput } from '../game/game';
import { type StageScene } from '../game/stage-scene';

import {
	BEST_ATOM,
	CALLOUT_ATOM,
	FOUND_EASTER_EGGS_ATOM,
	GALLERY_ATOM,
	GAME_OVER_ATOM,
	HINT_ATOM,
	METRES_ATOM,
	MODE_ATOM,
	PHASE_ATOM,
	RESULT_ATOM,
	SCENE_ATOM,
	SCORE_ATOM,
	STAGE_SCENE_ATOM,
	type ShownScene,
} from './atoms';

type Store = ReturnType<typeof createStore>;

// Inputs held down by a key or a tap, rather than the analog stick.
export type HeldInput = Exclude<keyof GameInput, 'steer' | 'throttle'>;

// How long the photo takes to fade back in.
const sceneFadeOut = 1500;

/**
 * Runs the scenes in the hero's stage (the game and the easter egg gallery)
 * and mirrors what they report into the Jotai store for the UI to show.
 */
export class HeroController {
	private readonly _store: Store;
	// Whichever scene is in the stage: the game or the gallery.
	private _scene: StageScene | undefined;
	// Scenes on their way out, torn down once the next has been drawn.
	private _retiring: StageScene[] = [];
	private _game: Game | undefined;
	private _gallery: Gallery | undefined;
	private _calloutTimeout: ReturnType<typeof setTimeout> | undefined;

	public constructor(store: Store) {
		this._store = store;
	}

	/**
	 * Creates a game in the stage. The previous scene (if any) is torn down
	 * once the new one has been drawn, so there's no flash between them.
	 * @param shouldSkipIntro - Jump straight to the roll, for restarts.
	 */
	private async launch(shouldSkipIntro: boolean): Promise<void> {
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
						this.callout(`${String(combo)}× combo!`, 900);
					}
				},
				onEasterEgg: (id) => {
					store.set(FOUND_EASTER_EGGS_ATOM, (found) =>
						found.includes(id) ? found : [...found, id],
					);
				},
				onBearBlast: (bears, points) => {
					this.callout(
						`${'🐻'.repeat(bears)} ×${String(bears)} +${String(points)}!`,
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
			{ skipIntro: shouldSkipIntro },
		);
		this.show({ kind: 'game', scene: next });
		this._game = next;
		this._gallery = undefined;
		// A handle for the end-to-end tests, in development only.
		if (import.meta.env.DEV) {
			Object.assign(globalThis, { heroTest: { game: next } });
		}
		store.set(SCENE_ATOM, 'game');
		store.set(MODE_ATOM, 'game');
		this.resetHud();
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
		this._store.set(RESULT_ATOM, {
			trees,
			metres: Math.floor(metres),
			best,
		});
		this._store.set(HINT_ATOM, false);
		this._store.set(GAME_OVER_ATOM, true);
		// Last, so the card is up even if storage fails.
		if (trees > best) {
			this._store.set(BEST_ATOM, trees);
		}
	}

	private resetHud(): void {
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
	 * Whether a scene is in the stage.
	 * @returns True while the game or the gallery is up.
	 */
	public get hasScene(): boolean {
		return this._scene !== undefined;
	}

	/**
	 * Whether the game is taking steering input (not over, not the gallery).
	 * @returns True while a run is in play.
	 */
	public get isSteerable(): boolean {
		return this._game !== undefined && !this._store.get(GAME_OVER_ATOM);
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
		const found = this._store.get(FOUND_EASTER_EGGS_ATOM);
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
			Array.isArray(found) ? found : [],
		);
		this.show({ kind: 'gallery', scene: next });
		this._gallery = next;
		this._game = undefined;
		this._store.set(GAME_OVER_ATOM, false);
		this._store.set(GALLERY_ATOM, (view) => ({
			...view,
			count: next.count,
			locked: next.locked,
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

	public nextEgg(): void {
		this._gallery?.next();
	}

	public previousEgg(): void {
		this._gallery?.previous();
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
