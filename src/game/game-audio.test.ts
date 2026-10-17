// three.js makes its audio context through `window`.
// @vitest-environment happy-dom
import { Object3D, PerspectiveCamera } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLIPS, type ClipName } from './clips';
import {
	type FakeAudioContext,
	type FakeSource,
	fakeAudioContext,
} from './fake-audio-context';
import { GameAudio, comboRate } from './game-audio';
import { Sound } from './sound';

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/**
 * A run's audio, heard from a camera, with one recording for each sound,
 * told apart by length.
 * @returns The audio, the camera, the page's sound, its context, the rumble,
 * and the sounds played once, in order.
 */
const setup = (): {
	audio: GameAudio;
	camera: PerspectiveCamera;
	sound: Sound;
	context: FakeAudioContext;
	rumble: FakeSource;
	played: () => { name: ClipName; source: FakeSource }[];
} => {
	const context = fakeAudioContext();
	const sound = new Sound();
	const names = Object.keys(CLIPS).filter((name): name is ClipName =>
		Object.hasOwn(CLIPS, name),
	);
	for (const [i, name] of names.entries()) {
		sound.addClip(name, sound.listener.context.createBuffer(1, i + 1, 100));
	}
	const camera = new PerspectiveCamera();
	const audio = new GameAudio(sound, camera);
	const [rumble] = context.sources;
	const played = (): { name: ClipName; source: FakeSource }[] =>
		context.sources.slice(1).map((source) => ({
			name: names[(source.buffer?.getChannelData().length ?? 0) - 1],
			source,
		}));
	return { audio, camera, sound, context, rumble, played };
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

	it('stops rumbling louder past top speed', () => {
		const { audio, rumble } = setup();
		audio.roll(38);
		const flatOut = rumble.gain?.gain.value;
		audio.roll(100);
		expect(rumble.gain?.gain.value).toBe(flatOut);
	});

	it('cracks and creaks as a tree goes down, with a note only for a combo', () => {
		const { audio, played } = setup();
		audio.fell(1);
		expect(played().map(({ name }) => name)).toEqual(['tree', 'creak']);
		audio.fell(4);
		const plucked = played().at(-1);
		expect(plucked?.name).toBe('pluck');
		expect(plucked?.source.playbackRate.value).toBeCloseTo(comboRate(4));
	});

	it('blows up an easter egg, then plays a jingle for finding it', () => {
		const { audio, played } = setup();
		audio.smash();
		const sounds = played();
		expect(sounds.map(({ name }) => name)).toEqual([
			'explosion',
			'thump',
			'found',
		]);
		expect(sounds[2].source.startedAt).toBeGreaterThan(0);
	});

	it('yelps once for each bear sent flying, one after another, higher each time', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
		const { audio, played } = setup();
		audio.blast(3);
		const yelps = played();
		expect(yelps.map(({ name }) => name)).toEqual([
			'growl',
			'growl',
			'growl',
		]);
		const [first, second] = yelps.map(({ source }) => source);
		expect(second.startedAt).toBeGreaterThan(first.startedAt ?? 0);
		expect(second.playbackRate.value).toBeGreaterThan(
			first.playbackRate.value,
		);
	});

	it('growls from where the bear is', () => {
		const { audio, played } = setup();
		const bear = new Object3D();
		audio.spot(bear);
		const [growl] = played();
		expect(growl.name).toBe('growl');
		expect(growl.source.panner).toBeDefined();
		expect(bear.children).toHaveLength(1);
		// Gone from the bear once it's played.
		growl.source.end();
		expect(bear.children).toHaveLength(0);
		expect(growl.source.connections.size).toBe(0);
	});

	it('roars and thuds when a bear gets me', () => {
		const { audio, played } = setup();
		audio.caught();
		expect(played().map(({ name }) => name)).toEqual(['roar', 'thud']);
	});

	it('plays nothing while muted, rather than all of it at once after', () => {
		const { audio, sound, played } = setup();
		sound.setMuted(true);
		audio.caught();
		expect(played()).toEqual([]);
	});

	it('plays nothing it has no recording for yet', () => {
		const context = fakeAudioContext();
		const audio = new GameAudio(new Sound(), new PerspectiveCamera());
		audio.caught();
		// Just the rumble.
		expect(context.sources).toHaveLength(1);
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
