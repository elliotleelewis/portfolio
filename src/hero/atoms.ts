import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

import type { Gallery } from '../game/gallery';
import type { Game } from '../game/game';

import type { EasterEggHits } from './easter-egg-hits';
import type { Board } from './leaderboard';

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

// Where the last run stands with the leaderboard.
export type EntryStatus =
	// Not on the board (or there's no board to be on).
	| 'none'
	// It made the board: waiting for my initials.
	| 'entering'
	| 'saving'
	| 'saved'
	// Others' scores pushed it off before it was saved.
	| 'missed'
	| 'rejected'
	// The board's taken all the scores it will today.
	| 'closed'
	// Saving it went wrong, so I can try again.
	| 'failed'
	// The initials would put something rude on the board: try others.
	| 'blocked'
	// It went further than real time allows, so it can't go on the board.
	| 'fastForwarded';

export interface BoardEntry {
	status: EntryStatus;
	// Its place on the board, once saved.
	place?: number;
	// Goes up with each try at saving, for a fresh check for a person.
	attempt: number;
}

export interface GalleryView {
	index: number;
	caption: string;
	count: number;
	// How many times I've smashed each easter egg, in gallery order. Those
	// on 0 are still hidden.
	hits: readonly number[];
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

// Whether the game is waiting on its start screen (on the game's own page)
// for me to press start.
export const WAITING_ATOM = atom(false);

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

// How many times each easter egg has been smashed on this device. The
// gallery only shows the ones smashed at least once. Read from storage as
// soon as it's first used, like the best score.
export const EASTER_EGG_HITS_ATOM = atomWithStorage<EasterEggHits>(
	'hero-easter-egg-hits',
	{},
	undefined,
	{ getOnInit: true },
);

// The shared leaderboard, best first, and the score to beat. Undefined until
// it's loaded, and if it can't be reached.
export const BOARD_ATOM = atom<Board | undefined>(undefined);
export const BOARD_ENTRY_ATOM = atom<BoardEntry>({
	status: 'none',
	attempt: 0,
});

// The initials I last put on the leaderboard, to start from next time.
// Storage could hold anything, so read it with `readInitials`.
export const INITIALS_ATOM = atomWithStorage<unknown>(
	'hero-initials',
	'AAA',
	undefined,
	{ getOnInit: true },
);

export const GALLERY_ATOM = atom<GalleryView>({
	index: 0,
	caption: '',
	count: 0,
	hits: [],
});
