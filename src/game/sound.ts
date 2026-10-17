import { AudioListener } from 'three';

/**
 * The page's sound: what hears the game (a listener, which rides on each
 * game's camera), muted on request and quiet while the page is out of
 * sight. One for the whole page, as browsers only allow a few audio contexts.
 */
export class Sound {
	private _isMuted = false;
	private _isHidden = false;
	// Makes three.js's audio context, so it's only made after a press or a
	// key, when browsers let sound start.
	public readonly listener = new AudioListener();

	private refresh(): void {
		const { context } = this.listener;
		void (this._isMuted || this._isHidden
			? context.suspend()
			: context.resume());
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
 * Sets up the page's sound. Call it after a press or a key, as it makes the
 * audio context, and browsers only let one start then.
 * @returns The sound.
 */
export const createSound = (): Sound => {
	const sound = new Sound();
	const onVisibilityChange = (): void => {
		sound.setHidden(document.hidden);
	};
	document.addEventListener('visibilitychange', onVisibilityChange);
	onVisibilityChange();
	return sound;
};
