// three.js makes its audio context through `window`.
// @vitest-environment happy-dom
import { PerspectiveCamera } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type FakeSource, fakeAudioContext } from './fake-audio-context';
import { GameAudio } from './game-audio';
import { Sound } from './sound';

afterEach(() => {
	vi.useRealTimers();
});

/**
 * A run's audio, heard from a camera.
 * @returns The audio, the camera, the page's sound, and the rumble.
 */
const setup = (): {
	audio: GameAudio;
	camera: PerspectiveCamera;
	sound: Sound;
	rumble: FakeSource;
} => {
	const context = fakeAudioContext();
	const sound = new Sound();
	const camera = new PerspectiveCamera();
	const audio = new GameAudio(sound.listener, camera);
	const [rumble] = context.sources;
	return { audio, camera, sound, rumble };
};

describe('GameAudio', () => {
	it('hears from the camera', () => {
		const { camera, sound } = setup();
		expect(sound.listener.parent).toBe(camera);
	});

	it('loops a rumble of noise, silent until I move', () => {
		const { rumble } = setup();
		expect(rumble.loop).toBe(true);
		expect(rumble.startedAt).toBe(0);
		expect(rumble.buffer?.getChannelData().some((s) => s !== 0)).toBe(true);
		expect(rumble.filter?.type).toBe('lowpass');
		expect(rumble.gain?.gain.value).toBe(0);
	});

	it('rumbles louder and brighter the faster I go', () => {
		const { audio, rumble } = setup();
		audio.roll(10);
		const slow = {
			volume: rumble.gain?.gain.value ?? 0,
			cutoff: rumble.filter?.frequency.value ?? 0,
		};
		expect(slow.volume).toBeGreaterThan(0);
		audio.roll(30);
		expect(rumble.gain?.gain.value).toBeGreaterThan(slow.volume);
		expect(rumble.filter?.frequency.value).toBeGreaterThan(slow.cutoff);
	});

	it('stops rumbling past top speed', () => {
		const { audio, rumble } = setup();
		audio.roll(38);
		const flatOut = rumble.gain?.gain.value;
		audio.roll(100);
		expect(rumble.gain?.gain.value).toBe(flatOut);
	});

	it('fades the rumble out when the run is over, then lets it go', () => {
		vi.useFakeTimers();
		const { audio, rumble } = setup();
		audio.roll(20);
		audio.dispose();
		expect(rumble.gain?.gain.value).toBe(0);
		expect(rumble.stoppedAt).toBeGreaterThan(0);
		vi.runAllTimers();
		expect(rumble.connections.size).toBe(0);
	});
});
