import {
	Audio,
	type Camera,
	MathUtils,
	type Object3D,
	PositionalAudio,
} from 'three';

import type { ClipName } from './clips';
import type { Sound } from './sound';

// The fastest I go, flat out: the rumble's at its loudest and brightest.
const topSpeed = 38;
// How loud the rumble gets, flat out.
const loudest = 0.38;
// Where the rumble's filter cuts off at a middling speed, in Hz: low, so it's
// a rush of air rather than a hiss.
const cutoff = 350;
// How much the filter rings at its cutoff, in decibels, which gives the rush
// a hollow, wind-like note.
const resonance = 6;
// How quickly the rumble follows my speed, in seconds.
const smoothing = 0.1;
// How long the rumble takes to fade out once the run's over, in seconds.
const fadeOut = 0.3;
// The recordings are levelled to the same peak: this sets them under the
// rumble's level, so they stand out without blaring.
const effectsVolume = 0.5;
// How much a recording's pitch varies from one play to the next.
const defaultVariation = 0.05;
// Within this distance, a sound from the slope is as loud as it gets.
const hearingDistance = 15;
// A major pentatonic scale, in semitones: a combo climbs it, a note a tree.
const scale = [0, 2, 4, 7, 9];
// The highest note a combo reaches, in steps up the scale: an octave up.
// Any higher and the pizzicato, played that much faster, turns squeaky.
const highestStep = scale.length;

interface PlayOptions {
	// 1 as recorded, 0.5 half as loud.
	volume?: number;
	// How fast to play it, which sets its pitch: 2 is an octave up.
	rate?: number;
	// How much its pitch may vary, as a share of `rate`.
	variation?: number;
	// Seconds to wait before it plays.
	delay?: number;
	// Where on the slope it comes from, if it's somewhere in particular.
	from?: Object3D;
}

/**
 * How fast to play the combo's note, so a bigger combo rings higher.
 * @param combo - The combo, from 2 (the first tree that builds one).
 * @returns The rate: 1 for the first, 2 an octave up.
 */
export const comboRate = (combo: number): number => {
	const step = MathUtils.clamp(combo - 2, 0, highestStep);
	const semitones =
		Math.floor(step / scale.length) * 12 + scale[step % scale.length];
	return 2 ** (semitones / 12);
};

/**
 * A second of white noise, to loop. Noise has no seam to hear where the loop
 * starts again.
 * @param context - The audio context it's for.
 * @returns The noise.
 */
const whiteNoise = (context: BaseAudioContext): AudioBuffer => {
	const buffer = context.createBuffer(
		1,
		context.sampleRate,
		context.sampleRate,
	);
	const samples = buffer.getChannelData(0);
	for (let i = 0; i < samples.length; i++) {
		samples[i] = Math.random() * 2 - 1;
	}
	return buffer;
};

/**
 * What a run sounds like: the rush of me rolling down the mountain, louder
 * and brighter the faster I go, and recordings of trees going down, easter
 * eggs going up and bears. I hear it all from the camera, so a bear sounds
 * from where it is.
 */
export class GameAudio {
	private readonly _sound: Sound;
	private readonly _rumble: Audio;
	private readonly _filter: BiquadFilterNode;

	/**
	 * @param sound - The page's sound.
	 * @param camera - The camera I'm seen through, which I hear from too.
	 */
	public constructor(sound: Sound, camera: Camera) {
		this._sound = sound;
		const { listener } = sound;
		camera.add(listener);
		const { context } = listener;
		this._filter = context.createBiquadFilter();
		this._filter.type = 'lowpass';
		this._filter.frequency.value = cutoff;
		this._filter.Q.value = resonance;
		this._rumble = new Audio(listener)
			.setBuffer(whiteNoise(context))
			.setFilter(this._filter);
		this._rumble.setLoop(true);
		// Silent until I'm moving. Not with setVolume, which eases there from
		// full volume.
		this._rumble.gain.gain.value = 0;
		this._rumble.play();
	}

	/**
	 * Plays one of a sound's recordings, once, then lets it go.
	 * @param name - Which sound.
	 * @param options - How loud, how high, when and where.
	 */
	private play(name: ClipName, options: PlayOptions = {}): void {
		const clips = this._sound.clips(name);
		if (!this._sound.isAudible || clips.length === 0) {
			return;
		}
		const {
			volume = 1,
			rate = 1,
			variation = defaultVariation,
			delay = 0,
			from,
		} = options;
		const { listener } = this._sound;
		let audio: Audio<AudioNode>;
		if (from) {
			const positional = new PositionalAudio(listener);
			positional.setRefDistance(hearingDistance);
			from.add(positional);
			audio = positional;
		} else {
			audio = new Audio(listener);
		}
		audio.setBuffer(clips[Math.floor(Math.random() * clips.length)]);
		audio.gain.gain.value = volume * effectsVolume;
		audio.setPlaybackRate(rate * (1 + (Math.random() * 2 - 1) * variation));
		audio.onEnded = () => {
			audio.disconnect();
			audio.gain.disconnect();
			audio.removeFromParent();
		};
		audio.play(delay);
	}

	/**
	 * Sets the rumble by how fast I'm going.
	 * @param speed - How fast I'm going down the slope.
	 */
	public roll(speed: number): void {
		const k = MathUtils.clamp(speed / topSpeed, 0, 1);
		const now = this._rumble.context.currentTime;
		this._rumble.gain.gain.setTargetAtTime(k * loudest, now, smoothing);
		this._filter.frequency.setTargetAtTime(
			cutoff * (0.6 + 0.8 * k),
			now,
			smoothing,
		);
	}

	/**
	 * A tree goes down, ringing out a note up the scale if it builds a
	 * combo.
	 * @param combo - The combo it makes.
	 */
	public fell(combo: number): void {
		this.play('tree', { volume: 0.8 });
		if (combo > 1) {
			// It's a tune, so in tune.
			this.play('pluck', {
				volume: 0.6,
				rate: comboRate(combo),
				variation: 0,
			});
		}
	}

	public smash(): void {
		this.play('explosion', { volume: 0.9 });
		this.play('thump', { volume: 0.8 });
		this.play('found', { volume: 0.7, delay: 0.35, variation: 0 });
	}

	/**
	 * Bears go flying, one yelp each, higher as they go.
	 * @param bears - How many.
	 */
	public blast(bears: number): void {
		for (let i = 0; i < bears; i++) {
			this.play('growl', {
				volume: 0.5,
				rate: 1.5 + i * 0.1,
				delay: 0.3 + i * 0.15,
			});
		}
	}

	/**
	 * A bear up a tree spots me, and growls from where it is.
	 * @param bear - The bear.
	 */
	public spot(bear: Object3D): void {
		this.play('growl', { from: bear });
	}

	public caught(): void {
		this.play('roar');
		this.play('thud', { volume: 0.8, delay: 0.25 });
	}

	public dispose(): void {
		const rumble = this._rumble;
		rumble.gain.gain.setTargetAtTime(
			0,
			rumble.context.currentTime,
			fadeOut / 5,
		);
		rumble.stop(fadeOut);
		// Out of the page's sound, once it's faded.
		setTimeout(() => {
			rumble.disconnect();
			rumble.gain.disconnect();
		}, fadeOut * 1000);
	}
}
