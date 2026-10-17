// The bears' alert badge is drawn on a canvas, so these need a DOM.
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { fakeAudioContext } from './fake-audio-context';
import { Game, type GameCallbacks } from './game';
import { Sound } from './sound';

const ignore = (): void => {
	// Not needed here.
};

/**
 * A game that notes when I start rolling.
 * @param isHeld - Whether to hold me at the start.
 * @returns The game, and whether I've started rolling.
 */
const setup = (isHeld: boolean) => {
	const state = { isRolling: false };
	const callbacks: GameCallbacks = {
		onRolling: () => {
			state.isRolling = true;
		},
		onScore: ignore,
		onEasterEgg: ignore,
		onBearBlast: ignore,
		onDistance: ignore,
		onGameOver: ignore,
	};
	return { game: new Game(callbacks, { isHeld }), state };
};

describe('Game', () => {
	it('sets off on its own when not held', () => {
		const { game, state } = setup(false);
		game.advance(8);
		expect(state.isRolling).toBe(true);
		game.dispose();
	});

	it('holds me at the start, looking around, until released', () => {
		const { game, state } = setup(true);
		game.advance(30);
		expect(game.isHeld).toBe(true);
		expect(state.isRolling).toBe(false);
		game.release();
		expect(game.isHeld).toBe(false);
		// Promptly: quicker than the intro would take from where it was.
		game.advance(2.5);
		expect(state.isRolling).toBe(true);
		game.dispose();
	});

	it('is silent until it has sound, then rumbles as I roll', () => {
		const context = fakeAudioContext();
		const { game } = setup(false);
		game.advance(8);
		expect(context.sources).toEqual([]);
		game.attachSound(new Sound());
		const [rumble] = context.sources;
		expect(rumble.gain?.gain.value).toBe(0);
		game.advance(0.5);
		expect(rumble.gain?.gain.value).toBeGreaterThan(0);
		game.dispose();
		expect(rumble.stoppedAt).toBeDefined();
	});
});
