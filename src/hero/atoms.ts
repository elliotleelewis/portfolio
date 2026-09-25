import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

import { type Gallery } from '../game/gallery';
import { type Game } from '../game/game';

export type Phase = 'idle' | 'loading' | 'playing';
export type SceneKind = 'game' | 'gallery';

// A scene on the stage, and which kind it is.
export type ShownScene =
	{ kind: 'game'; scene: Game } | { kind: 'gallery'; scene: Gallery };

export interface Callout {
	text: string;
	isShown: boolean;
}

export interface RunResult {
	trees: number;
	metres: number;
	// The best score before this run.
	best: number;
}

export interface GalleryView {
	index: number;
	caption: string;
	count: number;
}

// The photo, the game loading, or a scene on screen.
export const PHASE_ATOM = atom<Phase>('idle');

// The scene the stage is drawing. It outlives SCENE_ATOM by the fade back to
// the photo, then clears so the canvas can go.
export const STAGE_SCENE_ATOM = atom<ShownScene | undefined>(undefined);

// Which scene is live in the stage, if any.
export const SCENE_ATOM = atom<SceneKind | undefined>(undefined);

// Which scene's controls to lay out: the last scene shown. It stays after
// leaving, so the game's HUD doesn't flash up over the gallery as it all
// fades out.
export const MODE_ATOM = atom<SceneKind | undefined>(undefined);

export const SCORE_ATOM = atom(0);
export const METRES_ATOM = atom(0);
export const HINT_ATOM = atom(false);

// The combo or bear-blast message, which pops up briefly.
export const CALLOUT_ATOM = atom<Callout>({ text: '', isShown: false });

// The last run, and whether its game-over card is up.
export const RESULT_ATOM = atom<RunResult>({ trees: 0, metres: 0, best: 0 });
export const GAME_OVER_ATOM = atom(false);

// The most trees flattened in one run on this device. Read from storage as
// soon as it's first used, since the controller reads it outside React.
export const BEST_ATOM = atomWithStorage('hero-best-trees', 0, undefined, {
	getOnInit: true,
});

export const GALLERY_ATOM = atom<GalleryView>({
	index: 0,
	caption: '',
	count: 0,
});
