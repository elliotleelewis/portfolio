import { vi } from 'vitest';

// A stand-in for the browser's AudioContext, for tests: it keeps what it's
// asked to do, and plays nothing. Only what three.js's audio and the game
// use.

class FakeParam {
	public value: number;

	public constructor(value: number) {
		this.value = value;
	}

	public setTargetAtTime(target: number): this {
		this.value = target;
		return this;
	}
}

class FakeNode {
	public readonly connections = new Set<FakeNode>();

	public connect(destination: FakeNode): FakeNode {
		this.connections.add(destination);
		return destination;
	}

	public disconnect(destination?: FakeNode): void {
		if (destination) {
			this.connections.delete(destination);
		} else {
			this.connections.clear();
		}
	}
}

/**
 * What a node plays through, in order, as far as it goes.
 * @param node - The node.
 * @returns The nodes after it.
 */
const chainFrom = (node: FakeNode): FakeNode[] => {
	const next = node.connections.values().next();
	return next.done ? [] : [next.value, ...chainFrom(next.value)];
};

class FakeGain extends FakeNode {
	public readonly gain = new FakeParam(1);
}

class FakeFilter extends FakeNode {
	public type = 'lowpass';
	public readonly frequency = new FakeParam(350);
	// eslint-disable-next-line @typescript-eslint/naming-convention -- Web Audio's name for it.
	public readonly Q = new FakeParam(1);
}

class FakePanner extends FakeNode {
	public panningModel = 'equalpower';
	public refDistance = 1;
	public setPosition(): void {
		// Where it is doesn't matter here.
	}

	public setOrientation(): void {
		// Nor which way it faces.
	}
}

class FakeBuffer {
	private readonly _samples: Float32Array;

	public constructor(length: number) {
		this._samples = new Float32Array(length);
	}

	public getChannelData(): Float32Array {
		return this._samples;
	}
}

export class FakeSource extends FakeNode {
	public buffer: FakeBuffer | null = null;
	public loop = false;
	public loopStart = 0;
	public loopEnd = 0;
	public onended: (() => void) | null = null;
	public readonly playbackRate = new FakeParam(1);
	public readonly detune = new FakeParam(0);
	public startedAt: number | undefined;
	public stoppedAt: number | undefined;

	public start(when = 0): void {
		this.startedAt = when;
	}

	public stop(when = 0): void {
		this.stoppedAt = when;
	}

	// The filter it plays through, if any.
	public get filter(): FakeFilter | undefined {
		return chainFrom(this).find((node) => node instanceof FakeFilter);
	}

	// The panner that places it, if it's somewhere in particular.
	public get panner(): FakePanner | undefined {
		return chainFrom(this).find((node) => node instanceof FakePanner);
	}

	// The gain that sets its volume.
	public get gain(): FakeGain | undefined {
		return chainFrom(this).find((node) => node instanceof FakeGain);
	}

	// Ends, as it would once it had played.
	public end(): void {
		this.onended?.();
	}
}

export class FakeAudioContext {
	public currentTime = 0;
	public readonly sampleRate = 100;
	public state: 'running' | 'suspended' = 'running';
	public readonly destination = new FakeNode();
	public readonly listener = {
		setPosition: (): void => {
			// Where I hear from doesn't matter here.
		},
		setOrientation: (): void => {
			// Nor which way I face.
		},
	};
	public sources: FakeSource[] = [];

	public createGain(): FakeGain {
		return new FakeGain();
	}

	public createBiquadFilter(): FakeFilter {
		return new FakeFilter();
	}

	public createPanner(): FakePanner {
		return new FakePanner();
	}

	public createBuffer(_channels: number, length: number): FakeBuffer {
		return new FakeBuffer(length);
	}

	// Any bytes decode to a short, silent recording.
	public decodeAudioData(
		_data: ArrayBuffer,
		onDecoded: (buffer: FakeBuffer) => void,
	): Promise<FakeBuffer> {
		const buffer = new FakeBuffer(10);
		onDecoded(buffer);
		return Promise.resolve(buffer);
	}

	public createBufferSource(): FakeSource {
		const source = new FakeSource();
		this.sources.push(source);
		return source;
	}

	public resume(): Promise<void> {
		this.state = 'running';
		return Promise.resolve();
	}

	public suspend(): Promise<void> {
		this.state = 'suspended';
		return Promise.resolve();
	}
}

// three.js makes one context and keeps it, so it's the same one all through
// a test file.
const shared = new FakeAudioContext();

/**
 * Puts the fake in place of the browser's AudioContext, set back as new.
 * @returns The fake, which three.js's audio will use.
 */
export const fakeAudioContext = (): FakeAudioContext => {
	vi.stubGlobal(
		'AudioContext',
		vi.fn(function () {
			return shared;
		}),
	);
	shared.currentTime = 0;
	shared.state = 'running';
	shared.sources = [];
	return shared;
};
