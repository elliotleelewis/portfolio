import { MathUtils, type Object3D, PerspectiveCamera, Vector3 } from 'three';

import type { Mirror } from './direction';
import { damp } from './easing';
import { STAR_END } from './player';

// When the camera has swung round from the intro to chase me.
export const CAMERA_SWING_END = 8;

const fov = 38;

// Where my face sits in the hero photo, as fractions of the image.
const photoAspect = 1280 / 1392;
const photoObjectPositionY = 0.45;
const photoFaceY = 0.453;
const photoHeadHeight = 0.277;

// ...and in the 3D model.
const modelFaceY = 1.72;
const modelHeadHeight = 0.21;

const chaseFov = 48;
// Chase camera for landscape screens; portrait ones sit further behind.
const chaseOffset = new Vector3(6.5, 3.8, 6.5);
const chaseLookAhead = new Vector3(-0.5, 0.8, -7);
const portraitChaseOffset = new Vector3(2.4, 5, 11);
const portraitChaseLookAhead = new Vector3(0, 0.5, -8);

/**
 * The game's camera: it opens framed like the hero photo, then swings round
 * behind me to chase me down the mountain, shaking as I smash things up.
 */
export class ChaseCamera {
	private readonly _slope: Object3D;
	private readonly _isShakeless: boolean;
	private readonly _mirror: Mirror;
	private readonly _introCamera = new Vector3();
	private readonly _introTarget = new Vector3();
	private readonly _offset = new Vector3().copy(chaseOffset);
	private readonly _lookAhead = new Vector3().copy(chaseLookAhead);
	private readonly _v = new Vector3();
	private readonly _v2 = new Vector3();
	private _shake = 0;
	private _zoom = 1;

	public readonly camera = new PerspectiveCamera(fov, 1, 0.05, 1200);

	/**
	 * @param slope - The mountainside I roll down, whose space I'm chased in.
	 * @param isShakeless - Keep the camera steady (for reduced motion).
	 * @param mirror - -1 to chase from the other side, so I roll right to left
	 * across the screen.
	 */
	public constructor(
		slope: Object3D,
		isShakeless = false,
		mirror: Mirror = 1,
	) {
		this._slope = slope;
		this._isShakeless = isShakeless;
		this._mirror = mirror;
		this._offset.x *= mirror;
		this._lookAhead.x *= mirror;
	}

	// Where the chase camera sits relative to me, in the slope's space.
	public get offset(): Readonly<Vector3> {
		return this._offset;
	}

	// How much the camera is shaking.
	public get shakiness(): number {
		return this._shake;
	}

	/**
	 * Gives the camera a jolt.
	 * @param amount - How big a jolt.
	 * @param limit - The most it can add up to, with jolts already going.
	 */
	public shake(amount: number, limit = amount): void {
		if (!this._isShakeless) {
			this._shake = Math.min(limit, this._shake + amount);
		}
	}

	/**
	 * Fits the camera (and the intro's framing) to the stage's size.
	 * @param width - Stage width, in CSS pixels.
	 * @param height - Stage height, in CSS pixels.
	 */
	public resize(width: number, height: number): void {
		if (width === 0 || height === 0) {
			return;
		}
		const aspect = width / height;
		this.camera.aspect = aspect;
		this.camera.updateProjectionMatrix();

		// Frame the opening shot like the (object-cover) photo it fades from,
		// so my face lands in the same spot at the same size.
		let headFraction = photoHeadHeight;
		let faceY = photoFaceY;
		if (aspect > photoAspect) {
			const visible = photoAspect / aspect;
			const top = (1 - visible) * photoObjectPositionY;
			headFraction = photoHeadHeight / visible;
			faceY = (photoFaceY - top) / visible;
		}
		const tanHalfFov = Math.tan(MathUtils.degToRad(fov / 2));
		const viewHeight = modelHeadHeight / headFraction;
		const distance = viewHeight / (2 * tanHalfFov);
		const cameraY = modelFaceY - (0.5 - faceY) * viewHeight;
		this._introCamera.set(0, cameraY, distance);
		this._introTarget.set(0, cameraY, 0);

		const landscape = MathUtils.smootherstep(aspect, 0.5, 1.3);
		this._offset.lerpVectors(portraitChaseOffset, chaseOffset, landscape);
		this._lookAhead.lerpVectors(
			portraitChaseLookAhead,
			chaseLookAhead,
			landscape,
		);
		// From behind and to one side, so I roll across the screen the way the
		// page reads.
		this._offset.x *= this._mirror;
		this._lookAhead.x *= this._mirror;
	}

	/**
	 * Moves the camera on.
	 * @param dt - Seconds since the last step.
	 * @param time - Seconds since the game began.
	 * @param player - Where I am, in the slope's space.
	 * @param isCaught - Whether a bear has got me.
	 */
	public update(
		dt: number,
		time: number,
		player: Vector3,
		isCaught: boolean,
	): void {
		const { camera } = this;

		// Once caught, move in for a closer look.
		this._zoom = MathUtils.lerp(
			this._zoom,
			isCaught ? 0.8 : 1,
			damp(2, dt),
		);

		// Where the chase camera wants to be, in world space.
		const chase = this._slope.localToWorld(
			this._v.copy(this._offset).multiplyScalar(this._zoom).add(player),
		);
		const chaseTarget = this._slope.localToWorld(
			this._v2.copy(player).add(this._lookAhead),
		);

		const swing = MathUtils.smootherstep(time, STAR_END, CAMERA_SWING_END);
		const position = chase.lerp(this._introCamera, 1 - swing);
		const target = chaseTarget.lerp(this._introTarget, 1 - swing);
		const cameraFov = MathUtils.lerp(fov, chaseFov, swing);
		if (cameraFov !== camera.fov) {
			camera.fov = cameraFov;
			camera.updateProjectionMatrix();
		}

		if (swing < 1) {
			camera.position.copy(position);
		} else {
			camera.position.lerp(position, damp(6, dt));
		}
		this._shake = Math.max(0, this._shake - dt * 1.2);
		if (this._shake > 0) {
			camera.position.x += MathUtils.randFloatSpread(this._shake);
			camera.position.y += MathUtils.randFloatSpread(this._shake);
		}
		camera.lookAt(target);
	}
}
