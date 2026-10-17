import { Audio, type AudioListener, type Camera, MathUtils } from 'three';

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
 * and brighter the faster I go. I hear it from the camera.
 */
export class GameAudio {
	private readonly _rumble: Audio;
	private readonly _filter: BiquadFilterNode;

	/**
	 * @param listener - The page's listener.
	 * @param camera - The camera I'm seen through, which I hear from too.
	 */
	public constructor(listener: AudioListener, camera: Camera) {
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
