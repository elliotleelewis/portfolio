import { MathUtils, type Object3D, Vector3 } from 'three';

import { type Character, createCharacter } from './character';
import { damp, smooth } from './easing';
import { disposeObject } from './easter-eggs';
import { LANE_HALF_WIDTH, terrainHeight } from './world';

// Intro timeline, in seconds.
const lookStart = 1.5;
const starStart = 5;
// When I've struck the star pose (a restart skips to just before this).
export const STAR_END = 5.8;
// When I've turned side-on and start to roll.
export const TURN_END = 6.5;

// How far my lowest hand or foot sits above the ground.
const contactOffset = 0.05;

// Head yaw/pitch keyframes while looking around: [time, yaw, pitch].
const lookKeys: [number, number, number][] = [
	[lookStart, 0, 0],
	[2.1, 0.8, 0.05],
	[2.8, 0.8, 0.1],
	[3.4, -0.8, 0.02],
	[4.1, -0.8, -0.05],
	[4.5, 0, 0.3],
	[5, 0, 0],
];

const lookAround = (t: number): [yaw: number, pitch: number] => {
	for (let i = 1; i < lookKeys.length; i++) {
		const [t1, yaw1, pitch1] = lookKeys[i] ?? [0, 0, 0];
		if (t <= t1) {
			const [t0, yaw0, pitch0] = lookKeys[i - 1] ?? [0, 0, 0];
			const k = smooth(t0, t1, t);
			return [
				MathUtils.lerp(yaw0, yaw1, k),
				MathUtils.lerp(pitch0, pitch1, k),
			];
		}
	}
	return [0, 0];
};

export interface PlayerControls {
	// -1 (left) to 1 (right).
	turn: number;
	// -1 (slower) to 1 (faster).
	push: number;
}

export interface PlayerHooks {
	// The intro is over and I've started rolling.
	onRolling: () => void;
	// I've rolled on a step.
	onMove: () => void;
}

/**
 * Me: the intro (looking around, then a star pose), then cartwheeling down
 * the mountain, steering, and skidding to a stop if a bear gets me.
 */
export class Player {
	private readonly _hooks: PlayerHooks;
	private readonly _character: Character = createCharacter();
	private readonly _v = new Vector3();
	private _speed = 0;
	private _lateral = 0;
	private _distance = 0;
	private _isRolling = false;

	public constructor(hooks: PlayerHooks) {
		this._hooks = hooks;
	}

	private roll(dt: number, { turn, push }: PlayerControls): void {
		const c = this._character;

		let target = MathUtils.clamp(10 + this._distance / 40, 10, 28);
		target *= 1 + push * (push > 0 ? 0.35 : 0.45);
		this._speed = MathUtils.lerp(this._speed, target, damp(0.8, dt));

		const maxLateral = 7 + this._speed * 0.3;
		this._lateral = MathUtils.lerp(
			this._lateral,
			turn * maxLateral,
			damp(5, dt),
		);

		const root = c.root.position;
		root.x += this._lateral * dt;
		if (Math.abs(root.x) > LANE_HALF_WIDTH) {
			root.x = Math.sign(root.x) * LANE_HALF_WIDTH;
			this._lateral *= -0.3;
		}
		root.z -= this._speed * dt;
		root.y = terrainHeight(root.x, root.z);
		this._distance = -root.z;

		// Cartwheel: the spin matches the ground speed for the average reach
		// of my hands and feet.
		c.roller.rotation.x -= (this._speed / 1.2) * dt;
		c.lean.rotation.z = -this._lateral * 0.03;
		c.root.rotation.y = -Math.atan2(this._lateral, this._speed) * 0.8;

		this._hooks.onMove();
	}

	// Caught: skid to a stop and flop onto my back.
	private crash(dt: number): void {
		const c = this._character;
		this._speed = MathUtils.lerp(this._speed, 0, damp(3, dt));
		this._lateral = MathUtils.lerp(this._lateral, 0, damp(3, dt));
		const root = c.root.position;
		root.x += this._lateral * dt;
		root.z -= this._speed * dt;
		root.y = terrainHeight(root.x, root.z);

		const fullTurn = Math.PI * 2;
		const upright = Math.round(c.roller.rotation.x / fullTurn) * fullTurn;
		c.roller.rotation.x = MathUtils.lerp(
			c.roller.rotation.x,
			upright,
			damp(4, dt),
		);
		c.lean.rotation.z = MathUtils.lerp(
			c.lean.rotation.z,
			Math.PI / 2,
			damp(3, dt),
		);
		c.head.rotation.set(0, -0.6, 0);
	}

	// My rig, to add to the slope.
	public get root(): Object3D {
		return this._character.root;
	}

	// Where I am, in the slope's space.
	public get position(): Vector3 {
		return this._character.root.position;
	}

	// How fast I'm rolling down the slope.
	public get speed(): number {
		return this._speed;
	}

	// How fast I'm moving across the slope (positive is right).
	public get lateral(): number {
		return this._lateral;
	}

	// How far down the mountain I've rolled.
	public get distance(): number {
		return this._distance;
	}

	public get isRolling(): boolean {
		return this._isRolling;
	}

	/**
	 * Moves me on: through the intro, then rolling (or crashing, once caught).
	 * @param dt - Seconds since the last step.
	 * @param time - Seconds since the game began.
	 * @param controls - How I'm steering.
	 * @param isCaught - Whether a bear has got me.
	 */
	public update(
		dt: number,
		time: number,
		controls: PlayerControls,
		isCaught: boolean,
	): void {
		const t = time;
		const c = this._character;

		// Breathing and blinking.
		c.body.position.y = -1.05 + Math.sin(t * 2.2) * 0.004;
		const blink = t % 3.7 < 0.12 ? 0.15 : 1;
		for (const eye of c.eyes) {
			eye.scale.y = blink;
		}

		// Look at the camera, then look around.
		const [yaw, pitch] = lookAround(t);
		c.head.rotation.set(-pitch, yaw, 0);
		c.body.rotation.y = yaw * 0.15;

		// Hands up in the air, legs out: a star.
		const star = smooth(starStart, STAR_END, t);
		c.leftArm.rotation.z = MathUtils.lerp(0.08, 2.35, star);
		c.rightArm.rotation.z = -c.leftArm.rotation.z;
		c.leftLeg.rotation.z = MathUtils.lerp(0, 0.5, star);
		c.rightLeg.rotation.z = -c.leftLeg.rotation.z;

		// Turn side-on, ready to cartwheel.
		c.facing.rotation.y = smooth(STAR_END, TURN_END, t) * (Math.PI / 2);

		if (t >= TURN_END) {
			if (!this._isRolling) {
				this._isRolling = true;
				this._hooks.onRolling();
			}
			if (isCaught) {
				this.crash(dt);
			} else {
				this.roll(dt, controls);
			}
		}

		// Keep the lowest hand or foot touching the ground.
		c.roller.position.y = 0;
		c.root.updateMatrixWorld(true);
		let lowest = Infinity;
		for (const extremity of c.extremities) {
			extremity.getWorldPosition(this._v);
			c.root.worldToLocal(this._v);
			lowest = Math.min(lowest, this._v.y);
		}
		c.roller.position.y =
			contactOffset + Math.abs(c.lean.rotation.z) * 0.08 - lowest;
	}

	public dispose(): void {
		disposeObject(this._character.root);
	}
}
