import { type Camera, MathUtils, type Object3D, Vector3 } from 'three';

import type { Loop, Sound } from './sound';

// The fastest I go, flat out: the rumble's at its loudest and highest.
const topSpeed = 38;
// A major pentatonic scale, in semitones: a combo climbs it, a note a tree.
const scale = [0, 2, 4, 7, 9];
// The highest note a combo reaches, in steps up the scale.
const highestStep = 10;
// How far to the side a sound can sit, so neither ear gets it all.
const panWidth = 0.8;

/**
 * How fast to play the combo's chime, so a bigger combo rings higher.
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
 * What a run sounds like: me rolling, trees snapping, easter eggs going up
 * and bears. Plays through the page's {@link Sound}, and stops what it
 * started once the run's over.
 */
export class GameAudio {
	private readonly _sound: Sound;
	private readonly _rumble: Loop;
	private readonly _point = new Vector3();

	/**
	 * @param sound - The page's sound.
	 */
	public constructor(sound: Sound) {
		this._sound = sound;
		this._rumble = sound.loop('rumble');
	}

	/**
	 * Sets the rumble of me rolling by how fast I'm going.
	 * @param speed - How fast I'm going down the slope.
	 */
	public roll(speed: number): void {
		const k = MathUtils.clamp(speed / topSpeed, 0, 1);
		this._rumble.set(k * 0.8, 0.6 + k * 0.8);
	}

	public setOff(): void {
		this._sound.play('whoosh');
	}

	/**
	 * A tree goes down.
	 * @param combo - The combo it makes.
	 */
	public fell(combo: number): void {
		this._sound.play('crunch');
		if (combo > 1) {
			this._sound.play('chime', {
				volume: 0.6,
				rate: comboRate(combo),
				// It's a tune, so in tune.
				variation: 0,
			});
		}
	}

	public smash(): void {
		this._sound.play('boom');
		this._sound.play('sparkle', { delay: 0.2, variation: 0 });
	}

	/**
	 * Bears go flying, one yelp each, higher as they go.
	 * @param bears - How many.
	 */
	public blast(bears: number): void {
		for (let i = 0; i < bears; i++) {
			this._sound.play('yelp', {
				delay: 0.25 + i * 0.12,
				rate: 1 + i * 0.1,
			});
		}
	}

	/**
	 * A bear up a tree spots me, and growls from where it is on screen.
	 * @param bear - The bear.
	 * @param camera - The camera I'm seen through.
	 */
	public spot(bear: Object3D, camera: Camera): void {
		const { x, z } = bear.getWorldPosition(this._point).project(camera);
		// Behind the camera, the projection comes out mirrored.
		const across = z > 1 ? -x : x;
		this._sound.play('growl', {
			volume: 0.7,
			pan: MathUtils.clamp(across, -1, 1) * panWidth,
		});
	}

	public caught(): void {
		this._sound.play('roar');
		this._sound.play('thud', { delay: 0.3 });
	}

	public dispose(): void {
		this._rumble.stop();
	}
}
