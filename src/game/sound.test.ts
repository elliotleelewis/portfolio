import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeSound } from './fake-audio';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('Sound', () => {
	it('plays a sound at its volume, pitch and place, after its delay', () => {
		// Right in the middle, so the pitch doesn't vary.
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
		const { sound, output } = fakeSound();
		sound.play('chime', { volume: 0.6, rate: 2, pan: -0.5, delay: 0.2 });
		expect(output.played()).toEqual(['chime']);
		const [source] = output.sources;
		expect(source.startedAt).toBeCloseTo(10.2);
		expect(source.playbackRate.value).toBe(2);
		expect(source.panner?.pan.value).toBe(-0.5);
		expect(source.gain?.gain.value).toBe(0.6);
		// Through the master volume, and out.
		const [master] = output.gains;
		expect(source.gain?.connections).toEqual([master]);
		expect(master.connections).toEqual([output.destination]);
	});

	it('varies the pitch a little each time, unless told not to', () => {
		vi.spyOn(Math, 'random').mockReturnValue(1);
		const { sound, output } = fakeSound();
		sound.play('crunch');
		sound.play('chime', { variation: 0 });
		const [crunch, chime] = output.sources;
		expect(crunch.playbackRate.value).toBeCloseTo(1.05);
		expect(chime.playbackRate.value).toBe(1);
	});

	it('makes each sound once, however often it plays', () => {
		const { sound, builds } = fakeSound();
		sound.play('crunch');
		sound.play('crunch');
		sound.play('boom');
		expect(builds()).toBe(2);
	});

	it('goes quiet when muted, and plays nothing until unmuted', () => {
		const { sound, output } = fakeSound();
		sound.setMuted(true);
		expect(output.isRunning).toBe(false);
		sound.play('crunch');
		expect(output.played()).toEqual([]);
		sound.setMuted(false);
		expect(output.isRunning).toBe(true);
		sound.play('crunch');
		expect(output.played()).toEqual(['crunch']);
	});

	it('goes quiet while the page is hidden, and stays muted when it is back', () => {
		const { sound, output } = fakeSound();
		sound.setHidden(true);
		expect(output.isRunning).toBe(false);
		sound.setMuted(true);
		sound.setHidden(false);
		expect(output.isRunning).toBe(false);
		sound.setMuted(false);
		expect(output.isRunning).toBe(true);
	});

	it('wakes up again after a press, unless muted', () => {
		const { sound, output } = fakeSound();
		output.isRunning = false;
		sound.wake();
		expect(output.isRunning).toBe(true);
		sound.setMuted(true);
		sound.wake();
		expect(output.isRunning).toBe(false);
	});

	it('loops a sound, silent until set, and fades it out when stopped', () => {
		const { sound, output } = fakeSound();
		const loop = sound.loop('rumble');
		const [source] = output.sources;
		expect(source.loop).toBe(true);
		expect(source.startedAt).toBe(0);
		expect(source.gain?.gain.value).toBe(0);
		loop.set(0.5, 1.2);
		expect(source.gain?.gain.value).toBe(0.5);
		expect(source.playbackRate.value).toBe(1.2);
		loop.stop();
		expect(source.gain?.gain.value).toBe(0);
		expect(source.stoppedAt).toBeGreaterThan(output.currentTime);
	});
});
