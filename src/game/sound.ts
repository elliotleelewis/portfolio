import { SOUNDS, type SoundName } from './sounds';

// How loud everything is, all together: ZzFX's own default.
const masterVolume = 0.3;
// How quickly a loop follows a change in volume or pitch, in seconds.
const loopSmoothing = 0.1;
// How much a sound's pitch varies from one play to the next, so the same
// sound over and over doesn't grate.
const defaultVariation = 0.05;

// The parts of the Web Audio API the game uses, so tests can stand in for
// them. An AudioContext has them all.
interface AudioParamLike {
	value: number;
	setTargetAtTime(
		target: number,
		startTime: number,
		timeConstant: number,
	): unknown;
}

interface AudioNodeLike {
	connect(destination: AudioNodeLike): unknown;
}

interface GainLike extends AudioNodeLike {
	readonly gain: AudioParamLike;
}

interface PannerLike extends AudioNodeLike {
	readonly pan: AudioParamLike;
}

interface BufferLike {
	copyToChannel(source: Float32Array<ArrayBuffer>, channel: number): void;
}

interface SourceLike extends AudioNodeLike {
	buffer: BufferLike | null;
	loop: boolean;
	readonly playbackRate: AudioParamLike;
	start(when?: number): void;
	stop(when?: number): void;
}

export interface AudioOutput {
	readonly currentTime: number;
	readonly destination: AudioNodeLike;
	createBuffer(
		channels: number,
		length: number,
		sampleRate: number,
	): BufferLike;
	createBufferSource(): SourceLike;
	createGain(): GainLike;
	createStereoPanner(): PannerLike;
	resume(): Promise<void>;
	suspend(): Promise<void>;
}

// Turns a sound's ZzFX parameters into samples.
type BuildSamples = (
	parameters: readonly number[],
) => Float32Array<ArrayBuffer>;

interface PlayOptions {
	// 1 as made, 0.5 half as loud.
	volume?: number;
	// How fast to play it, which sets its pitch: 2 is an octave up.
	rate?: number;
	// Where it is: -1 (left) to 1 (right).
	pan?: number;
	// Seconds to wait before it plays.
	delay?: number;
	// How much its pitch may vary, as a share of `rate`.
	variation?: number;
}

// A sound playing over and over until it's stopped.
export interface Loop {
	// Eases it to a new volume and rate.
	set: (volume: number, rate: number) => void;
	// Fades it out.
	stop: () => void;
}

/**
 * The game's sound: plays the sounds in {@link SOUNDS}, and stays quiet
 * while muted or while the page is out of sight. One for the whole page, as
 * browsers only allow a few audio contexts.
 */
export class Sound {
	private readonly _output: AudioOutput;
	private readonly _build: BuildSamples;
	private readonly _sampleRate: number;
	private readonly _master: GainLike;
	// Each sound's samples, made the first time it plays.
	private readonly _buffers = new Map<SoundName, BufferLike>();
	private _isMuted = false;
	private _isHidden = false;

	/**
	 * @param output - Where the sound goes: an AudioContext.
	 * @param build - Turns a sound's parameters into samples.
	 * @param sampleRate - The samples' rate, in Hz.
	 */
	public constructor(
		output: AudioOutput,
		build: BuildSamples,
		sampleRate: number,
	) {
		this._output = output;
		this._build = build;
		this._sampleRate = sampleRate;
		this._master = output.createGain();
		this._master.gain.value = masterVolume;
		this._master.connect(output.destination);
	}

	private get isAudible(): boolean {
		return !this._isMuted && !this._isHidden;
	}

	private buffer(name: SoundName): BufferLike {
		const made = this._buffers.get(name);
		if (made) {
			return made;
		}
		const samples = this._build(SOUNDS[name]);
		const buffer = this._output.createBuffer(
			1,
			samples.length,
			this._sampleRate,
		);
		buffer.copyToChannel(samples, 0);
		this._buffers.set(name, buffer);
		return buffer;
	}

	/**
	 * Wires a sound up, ready to start.
	 * @param name - Which sound.
	 * @param volume - How loud.
	 * @param pan - Where, from -1 (left) to 1 (right).
	 * @returns The sound, and the gain that sets its volume.
	 */
	private connect(
		name: SoundName,
		volume: number,
		pan: number,
	): { source: SourceLike; gain: GainLike } {
		const output = this._output;
		const source = output.createBufferSource();
		source.buffer = this.buffer(name);
		const panner = output.createStereoPanner();
		panner.pan.value = pan;
		const gain = output.createGain();
		gain.gain.value = volume;
		source.connect(panner);
		panner.connect(gain);
		gain.connect(this._master);
		return { source, gain };
	}

	private refresh(): void {
		void (this.isAudible ? this._output.resume() : this._output.suspend());
	}

	/**
	 * Plays a sound once.
	 * @param name - Which sound.
	 * @param options - How loud, how high, where and when.
	 */
	public play(name: SoundName, options: PlayOptions = {}): void {
		// While it's quiet, sounds would queue up, then all play at once.
		if (!this.isAudible) {
			return;
		}
		const {
			volume = 1,
			rate = 1,
			pan = 0,
			delay = 0,
			variation = defaultVariation,
		} = options;
		const { source } = this.connect(name, volume, pan);
		source.playbackRate.value =
			rate * (1 + (Math.random() * 2 - 1) * variation);
		source.start(this._output.currentTime + delay);
	}

	/**
	 * Plays a sound over and over, silent until it's given a volume.
	 * @param name - Which sound.
	 * @returns The loop, to set and stop.
	 */
	public loop(name: SoundName): Loop {
		const { source, gain } = this.connect(name, 0, 0);
		source.loop = true;
		source.start();
		return {
			set: (volume, rate) => {
				const now = this._output.currentTime;
				gain.gain.setTargetAtTime(volume, now, loopSmoothing);
				source.playbackRate.setTargetAtTime(rate, now, loopSmoothing);
			},
			stop: () => {
				const now = this._output.currentTime;
				gain.gain.setTargetAtTime(0, now, loopSmoothing);
				source.stop(now + loopSmoothing * 5);
			},
		};
	}

	/**
	 * Mutes or unmutes everything.
	 * @param isMuted - Whether to mute.
	 */
	public setMuted(isMuted: boolean): void {
		this._isMuted = isMuted;
		this.refresh();
	}

	/**
	 * Goes quiet while the page is out of sight, and back again.
	 * @param isHidden - Whether the page is hidden.
	 */
	public setHidden(isHidden: boolean): void {
		this._isHidden = isHidden;
		this.refresh();
	}

	/**
	 * Starts the sound again (unless muted) after a press or a key, as
	 * browsers only let sound start then.
	 */
	public wake(): void {
		this.refresh();
	}
}

/**
 * Loads ZzFX and sets up the game's sound. Call it after a press or a key,
 * as ZzFX makes its audio context as it loads, and browsers only let one
 * start then.
 * @returns The sound.
 */
export const loadSound = async (): Promise<Sound> => {
	const { ZZFX: zzfx } = await import('zzfx');
	const sound = new Sound(
		zzfx.audioContext,
		(parameters) => zzfx.buildSamples(...parameters),
		zzfx.sampleRate,
	);
	const onVisibilityChange = (): void => {
		sound.setHidden(document.hidden);
	};
	document.addEventListener('visibilitychange', onVisibilityChange);
	onVisibilityChange();
	return sound;
};
