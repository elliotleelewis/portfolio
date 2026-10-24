import { AudioListener, AudioLoader } from 'three';

import { CLIPS, type ClipName } from './clips';

/**
 * Whether a key of {@link CLIPS} is one.
 * @param name - The key.
 * @returns True for every key of CLIPS: it narrows the type.
 */
const isClipName = (name: string): name is ClipName =>
	Object.hasOwn(CLIPS, name);

/**
 * The page's sound: what hears the game (a listener, which rides on each
 * game's camera) and the recordings it plays, muted on request and quiet
 * while the page is out of sight. One for the whole page, as browsers only
 * allow a few audio contexts.
 */
export class Sound {
	private readonly _clips = new Map<ClipName, AudioBuffer[]>();
	private _isMuted = false;
	private _isHidden = false;
	// Makes three.js's audio context, so it's only made after a press or a
	// key, when browsers let sound start.
	public readonly listener = new AudioListener();

	private refresh(): void {
		const { context } = this.listener;
		void (this.isAudible ? context.resume() : context.suspend());
	}

	/**
	 * Whether sound can be heard: not muted, and the page in sight. Sounds
	 * started while it can't would all play at once when it can again.
	 * @returns True if it can.
	 */
	public get isAudible(): boolean {
		return !this._isMuted && !this._isHidden;
	}

	/**
	 * The recordings for a sound, once they've loaded.
	 * @param name - Which sound.
	 * @returns Its recordings, or none yet.
	 */
	public clips(name: ClipName): readonly AudioBuffer[] {
		return this._clips.get(name) ?? [];
	}

	/**
	 * Adds a recording for a sound.
	 * @param name - Which sound.
	 * @param clip - The recording.
	 */
	public addClip(name: ClipName, clip: AudioBuffer): void {
		this._clips.set(name, [...this.clips(name), clip]);
	}

	/**
	 * Loads every recording in {@link CLIPS}. Any that won't load are left
	 * out, and the game plays on without them.
	 */
	public async load(): Promise<void> {
		const loader = new AudioLoader();
		await Promise.all(
			Object.entries(CLIPS).flatMap(([name, urls]) =>
				urls.map(async (url) => {
					try {
						const clip = await loader.loadAsync(url);
						if (isClipName(name)) {
							this.addClip(name, clip);
						}
					} catch {
						// Played without.
					}
				}),
			),
		);
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
 * Sets up the page's sound, and starts loading its recordings. Call it
 * after a press or a key, as it makes the audio context, and browsers only
 * let one start then.
 * @returns The sound.
 */
export const createSound = (): Sound => {
	const sound = new Sound();
	const onVisibilityChange = (): void => {
		sound.setHidden(document.hidden);
	};
	document.addEventListener('visibilitychange', onVisibilityChange);
	onVisibilityChange();
	void sound.load();
	return sound;
};
