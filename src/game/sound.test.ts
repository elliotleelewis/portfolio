// three.js makes its audio context through `window`.
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLIPS } from './clips';
import { fakeAudioContext } from './fake-audio-context';
import { Sound } from './sound';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Sound', () => {
	it('hears through three.js, on its shared audio context', () => {
		const context = fakeAudioContext();
		const sound = new Sound();
		expect(sound.listener.context).toBe(context);
	});

	it('goes quiet when muted, and back when unmuted', () => {
		const context = fakeAudioContext();
		const sound = new Sound();
		sound.setMuted(true);
		expect(context.state).toBe('suspended');
		sound.setMuted(false);
		expect(context.state).toBe('running');
	});

	it('goes quiet while the page is hidden, and stays muted when it is back', () => {
		const context = fakeAudioContext();
		const sound = new Sound();
		sound.setHidden(true);
		expect(context.state).toBe('suspended');
		sound.setMuted(true);
		sound.setHidden(false);
		expect(context.state).toBe('suspended');
		sound.setMuted(false);
		expect(context.state).toBe('running');
	});

	it('wakes up again after a press, unless muted', () => {
		const context = fakeAudioContext();
		const sound = new Sound();
		context.state = 'suspended';
		sound.wake();
		expect(context.state).toBe('running');
		sound.setMuted(true);
		sound.wake();
		expect(context.state).toBe('suspended');
	});

	it('loads every recording, leaving out any that will not load', async () => {
		fakeAudioContext();
		const [missing] = CLIPS.roar;
		vi.stubGlobal(
			'fetch',
			vi.fn((request: Request) =>
				Promise.resolve(
					request.url.endsWith(missing)
						? new Response('', { status: 404 })
						: new Response(new ArrayBuffer(8)),
				),
			),
		);
		const sound = new Sound();
		await sound.load();
		expect(sound.clips('tree')).toHaveLength(CLIPS.tree.length);
		expect(sound.clips('growl')).toHaveLength(1);
		expect(sound.clips('roar')).toEqual([]);
	});
});
