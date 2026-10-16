import { type AudioOutput, Sound } from './sound';
import { SOUNDS, type SoundName } from './sounds';

// A stand-in for the Web Audio API, for tests: it keeps what it's asked to
// do, and plays nothing.

class FakeParam {
	public value = 0;

	public setTargetAtTime(target: number): void {
		this.value = target;
	}
}

class FakeNode {
	public readonly connections: FakeNode[] = [];

	public connect(destination: FakeNode): void {
		this.connections.push(destination);
	}
}

export class FakeGain extends FakeNode {
	public readonly gain = new FakeParam();
}

export class FakePanner extends FakeNode {
	public readonly pan = new FakeParam();
}

class FakeBuffer {
	public samples: Float32Array | undefined;

	public copyToChannel(source: Float32Array<ArrayBuffer>): void {
		this.samples = source;
	}
}

export class FakeSource extends FakeNode {
	public buffer: FakeBuffer | null = null;
	public loop = false;
	public readonly playbackRate = new FakeParam();
	public startedAt: number | undefined;
	public stoppedAt: number | undefined;

	public start(when = 0): void {
		this.startedAt = when;
	}

	public stop(when = 0): void {
		this.stoppedAt = when;
	}

	// The panner it goes through.
	public get panner(): FakePanner | undefined {
		const [panner] = this.connections;
		return panner instanceof FakePanner ? panner : undefined;
	}

	// The gain that sets its volume.
	public get gain(): FakeGain | undefined {
		const [gain] = this.panner?.connections ?? [];
		return gain instanceof FakeGain ? gain : undefined;
	}
}

export class FakeOutput implements AudioOutput {
	public currentTime = 10;
	public readonly destination = new FakeNode();
	public isRunning = true;
	public readonly sources: FakeSource[] = [];
	public readonly gains: FakeGain[] = [];
	// Which sound each set of samples is.
	public readonly names = new Map<Float32Array, SoundName>();

	public createBuffer(): FakeBuffer {
		return new FakeBuffer();
	}

	public createBufferSource(): FakeSource {
		const source = new FakeSource();
		this.sources.push(source);
		return source;
	}

	public createGain(): FakeGain {
		const gain = new FakeGain();
		this.gains.push(gain);
		return gain;
	}

	public createStereoPanner(): FakePanner {
		return new FakePanner();
	}

	public resume(): Promise<void> {
		this.isRunning = true;
		return Promise.resolve();
	}

	public suspend(): Promise<void> {
		this.isRunning = false;
		return Promise.resolve();
	}

	/**
	 * The sounds played once (not looped), in order.
	 * @returns Their names.
	 */
	public played(): SoundName[] {
		return this.sources
			.filter(({ loop }) => !loop)
			.map(({ buffer }) =>
				buffer?.samples ? this.names.get(buffer.samples) : undefined,
			)
			.filter((name) => name !== undefined);
	}
}

/**
 * A sound that plays into a {@link FakeOutput}, with each sound's samples
 * standing for which sound it is.
 * @returns The sound, its output, and how many times samples were built.
 */
export const fakeSound = (): {
	sound: Sound;
	output: FakeOutput;
	builds: () => number;
} => {
	const output = new FakeOutput();
	const names = Object.keys(SOUNDS).filter((name): name is SoundName =>
		Object.hasOwn(SOUNDS, name),
	);
	let builds = 0;
	const sound = new Sound(
		output,
		(parameters) => {
			builds += 1;
			const samples = new Float32Array(1);
			const name = names.find((n) => SOUNDS[n] === parameters);
			if (name) {
				output.names.set(samples, name);
			}
			return samples;
		},
		44_100,
	);
	return { sound, output, builds: () => builds };
};
