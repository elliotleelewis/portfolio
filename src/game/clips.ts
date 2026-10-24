import explosion0 from './sounds/explosion-0.mp3';
import explosion1 from './sounds/explosion-1.mp3';
import found from './sounds/found.mp3';
import growl from './sounds/growl.mp3';
import pluck from './sounds/pluck.mp3';
import roar from './sounds/roar.mp3';
import thud0 from './sounds/thud-0.mp3';
import thud1 from './sounds/thud-1.mp3';
import thump from './sounds/thump.mp3';
import tree0 from './sounds/tree-0.mp3';
import tree1 from './sounds/tree-1.mp3';
import tree2 from './sounds/tree-2.mp3';

// The game's recordings, by what they're for. Where there's more than one,
// one is picked at random each time, so the same sound over and over
// doesn't grate. They're CC0 (see licenses/sounds.txt): trimmed, levelled
// and made mono MP3s, which every browser plays.
export const CLIPS = {
	// A tree knocked down: a knock of wood.
	tree: [tree0, tree1, tree2],
	// A pizzicato C, played up the scale as a combo grows.
	pluck: [pluck],
	// Finding an easter egg: a rising pizzicato jingle, in the same key.
	found: [found],
	// An easter egg blown apart: a crunching explosion...
	explosion: [explosion0, explosion1],
	// ...with a low thump under it.
	thump: [thump],
	// A bear spotting me. Played faster, a bear sent flying.
	growl: [growl],
	// A bear getting me, and me hitting the ground.
	roar: [roar],
	thud: [thud0, thud1],
} satisfies Record<string, readonly string[]>;

export type ClipName = keyof typeof CLIPS;
