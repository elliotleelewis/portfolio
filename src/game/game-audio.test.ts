import { Object3D, PerspectiveCamera } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeSound } from './fake-audio';
import { GameAudio, comboRate } from './game-audio';

afterEach(() => {
	vi.restoreAllMocks();
});

/**
 * A run's audio, playing into a fake output.
 * @returns The audio and its output.
 */
const setup = (): {
	audio: GameAudio;
	output: ReturnType<typeof fakeSound>['output'];
} => {
	const { sound, output } = fakeSound();
	return { audio: new GameAudio(sound), output };
};

describe('comboRate', () => {
	it('climbs a pentatonic scale, a note a tree', () => {
		expect(comboRate(2)).toBe(1);
		expect(comboRate(3)).toBeCloseTo(2 ** (2 / 12));
		expect(comboRate(6)).toBeCloseTo(2 ** (9 / 12));
		// An octave up.
		expect(comboRate(7)).toBeCloseTo(2);
	});

	it('stops climbing at two octaves', () => {
		expect(comboRate(12)).toBeCloseTo(4);
		expect(comboRate(50)).toBeCloseTo(4);
	});
});

describe('GameAudio', () => {
	it('rumbles louder and higher the faster I go', () => {
		const { audio, output } = setup();
		const [rumble] = output.sources;
		expect(rumble.loop).toBe(true);
		audio.roll(0);
		expect(rumble.gain?.gain.value).toBe(0);
		audio.roll(19);
		const halfway = rumble.gain?.gain.value ?? 0;
		expect(halfway).toBeGreaterThan(0);
		audio.roll(38);
		expect(rumble.gain?.gain.value).toBeGreaterThan(halfway);
		expect(rumble.playbackRate.value).toBeCloseTo(1.4);
		audio.roll(100);
		expect(rumble.playbackRate.value).toBeCloseTo(1.4);
	});

	it('chimes for a tree only when it builds a combo, higher as it grows', () => {
		const { audio, output } = setup();
		audio.fell(1);
		expect(output.played()).toEqual(['crunch']);
		audio.fell(4);
		expect(output.played()).toEqual(['crunch', 'crunch', 'chime']);
		expect(output.sources.at(-1)?.playbackRate.value).toBeCloseTo(
			comboRate(4),
		);
	});

	it('yelps once for each bear sent flying, one after another', () => {
		const { audio, output } = setup();
		audio.blast(3);
		expect(output.played()).toEqual(['yelp', 'yelp', 'yelp']);
		const starts = output.sources
			.filter(({ loop }) => !loop)
			.map(({ startedAt = 0 }) => startedAt);
		expect(starts[1]).toBeGreaterThan(starts[0]);
		expect(starts[2]).toBeGreaterThan(starts[1]);
	});

	it('growls from the side of the screen the bear is on', () => {
		const { audio, output } = setup();
		const camera = new PerspectiveCamera();
		camera.updateMatrixWorld();
		const bear = new Object3D();
		bear.position.set(5, 0, -10);
		bear.updateMatrixWorld();
		audio.spot(bear, camera);
		bear.position.set(-5, 0, -10);
		bear.updateMatrixWorld();
		audio.spot(bear, camera);
		const [right, left] = output.sources.filter(({ loop }) => !loop);
		expect(output.played()).toEqual(['growl', 'growl']);
		expect(right.panner?.pan.value).toBeGreaterThan(0);
		expect(left.panner?.pan.value).toBeLessThan(0);
	});

	it('roars and thuds when a bear gets me', () => {
		const { audio, output } = setup();
		audio.caught();
		expect(output.played()).toEqual(['roar', 'thud']);
	});

	it('stops the rumble when the run is over', () => {
		const { audio, output } = setup();
		const [rumble] = output.sources;
		audio.dispose();
		expect(rumble.stoppedAt).toBeDefined();
	});
});
