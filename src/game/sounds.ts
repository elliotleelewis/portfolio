// The game's sounds, as ZzFX parameters: volume, randomness, frequency,
// attack, sustain, release, shape, shape curve, slide, delta slide, pitch
// jump, pitch jump time, repeat time, noise, modulation, bit crush, delay,
// sustain volume, decay, tremolo, filter. Paste one into ZzFX's designer
// (https://killedbyapixel.github.io/ZzFX/) to hear it and tweak it.
// Phones' speakers barely play anything under 100Hz, so each has something
// higher in it too.
export const SOUNDS = {
	// A tree snapping as I flatten it: a short crack of noise.
	crunch: [
		0.8, 0.1, 300, 0, 0.02, 0.15, 4, 1, -4, 0, 0, 0, 0, 0.5, 0, 0.1, 0, 0.7,
		0.02, 0, -2500,
	],
	// A combo going up: a bell, played higher the bigger the combo.
	chime: [
		0.5, 0, 880, 0, 0.04, 0.3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.5,
		0.05,
	],
	// Setting off down the mountain.
	whoosh: [
		0.5, 0.05, 150, 0.15, 0.1, 0.35, 4, 1, 1, 0, 0, 0, 0, 0.3, 0, 0, 0, 0.6,
		0, 0, -1200,
	],
	// An easter egg blown apart: ZzFX's own explosion, a bit louder.
	boom: [1.2, 0.05, 333, 0.01, 0, 0.9, 4, 1.9, 0, 0, 0, 0, 0, 0.5, 0, 0.6],
	// Finding an easter egg: a rising shimmer.
	sparkle: [
		0.4, 0, 784, 0, 0.25, 0.4, 0, 1, 0, 0, 392, 0.06, 0.12, 0, 0, 0, 0.08,
		0.6, 0.02,
	],
	// A bear sent flying.
	yelp: [
		0.5, 0.1, 400, 0.01, 0.06, 0.15, 0, 1, 12, -1, 0, 0, 0, 0, 0, 0, 0, 0.8,
	],
	// A bear up a tree spots me: a low, rattling growl.
	growl: [
		0.7, 0.1, 65, 0.06, 0.35, 0.25, 2, 1.2, -0.3, 0, 0, 0, 0.04, 0.4, 0, 0,
		0, 0.8, 0, 0.7, -900,
	],
	// A bear gets me: a longer, louder growl...
	roar: [
		1, 0.05, 55, 0.04, 0.6, 0.5, 2, 1.2, -0.5, 0, 0, 0, 0.035, 0.6, 0, 0, 0,
		0.9, 0, 0.7, -800,
	],
	// ...and me hitting the ground.
	thud: [
		1, 0.05, 150, 0, 0.03, 0.3, 0, 1, -0.6, 0, 0, 0, 0, 0.4, 0, 0, 0, 0.6,
		0.03, 0, -800,
	],
	// Rolling down the slope: a second of low noise, played on a loop. With
	// no fade in or out, so the loop has no seam.
	rumble: [
		1, 0, 60, 0, 1, 0, 4, 1, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 1, 0, 0, -350,
	],
} satisfies Record<string, readonly number[]>;

export type SoundName = keyof typeof SOUNDS;
