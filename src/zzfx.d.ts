// ZzFX ships no types of its own. Only what the game uses is here.
declare module 'zzfx' {
	export const ZZFX: {
		// Made as the module loads, so load it after a press or a key, when
		// the browser lets sound play.
		readonly audioContext: AudioContext;
		readonly sampleRate: number;
		buildSamples: (...parameters: number[]) => Float32Array<ArrayBuffer>;
	};
}
