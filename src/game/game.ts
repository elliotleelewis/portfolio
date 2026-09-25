import {
	Group,
	MathUtils,
	Matrix4,
	type Object3D,
	PerspectiveCamera,
	Quaternion,
	Scene,
	Vector3,
	type WebGLRenderer,
} from 'three';

import { type BearActor, Bears } from './bears';
import { damp } from './easing';
import { EasterEggTrail, type PlacedEasterEgg } from './easter-egg-trail';
import { type EasterEggInstance } from './easter-eggs';
import { Effects } from './effects';
import { type Forest, type ForestHooks, type Tree } from './forest';
import { Player, type PlayerControls, STAR_END } from './player';
import { bearBlastPoints, nextCombo } from './scoring';
import { type StageScene } from './stage-scene';
import { SYSTEM_ORDER, Systems } from './systems';
import { isBlockingChaseView } from './view';
import { terrainHeight } from './world';

export interface GameCallbacks {
	// The intro is over and the player now has control.
	onRolling: () => void;
	onScore: (score: number, combo: number) => void;
	// Smashing an easter egg sent bears flying, for bonus points.
	onBearBlast: (bears: number, points: number) => void;
	onDistance: (metres: number) => void;
	// A bear got me.
	onGameOver: (score: number, metres: number) => void;
}

export interface GameOptions {
	// Skip straight to the star pose, for a quick restart.
	skipIntro?: boolean;
}

export interface GameInput {
	left: boolean;
	right: boolean;
	faster: boolean;
	slower: boolean;
	// The on-screen joystick: -1 (left) to 1 (right), and -1 (slower) to 1
	// (faster).
	steer: number;
	throttle: number;
}

// Steepness of the mountainside, in radians.
const slopeAngle = 0.24;
// How far past an easter egg's clearing a smash reaches bears.
const blastReach = 12;
// How long after being caught before the game-over screen shows.
const gameOverDelay = 1.6;

// When the camera has swung round from the intro to chase me.
const cameraSwingEnd = 8;

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
 * A little mountain-rolling game: I look around, strike a star pose, then
 * cartwheel down the mountain flattening trees.
 */
export class Game implements StageScene {
	private readonly _callbacks: GameCallbacks;
	private readonly _scene = new Scene();
	private readonly _camera = new PerspectiveCamera(fov, 1, 0.05, 1200);
	private readonly _introCamera = new Vector3();
	private readonly _introTarget = new Vector3();
	private readonly _chaseOffset = new Vector3();
	private readonly _chaseLookAhead = new Vector3();
	private readonly _slope = new Group();
	private readonly _player: Player;
	private _forest: Forest<BearActor> | undefined;
	private readonly _effects = new Effects();
	private readonly _bears: Bears;
	private readonly _trail: EasterEggTrail;
	private readonly _reducedMotion: boolean;

	private _time = 0;
	private _score = 0;
	private _combo = 0;
	private _lastHit = -10;
	private _shake = 0;
	private _caughtAt: number | undefined;
	private _isGameOverReported = false;
	private _cameraZoom = 1;

	private readonly _v = new Vector3();
	private readonly _v2 = new Vector3();
	private readonly _q = new Quaternion();
	private readonly _q2 = new Quaternion();
	private readonly _m = new Matrix4();
	private readonly _up = new Vector3(0, 1, 0);

	// Everything that moves on each step, in order.
	public readonly systems = new Systems();

	// How the trees ask the game where they can go.
	public readonly forestHooks: ForestHooks<BearActor> = {
		isInClearing: (x, z) => this._trail.isInClearing(x, z),
		isBlockingView: (x, z) => this.blocksView(x, z),
		onPlace: (tree, isInLane) => {
			this.placeBear(tree, isInLane);
		},
	};

	public readonly input: GameInput = {
		left: false,
		right: false,
		faster: false,
		slower: false,
		steer: 0,
		throttle: 0,
	};

	public constructor(callbacks: GameCallbacks, options: GameOptions = {}) {
		this._callbacks = callbacks;
		if (options.skipIntro) {
			this._time = STAR_END - 0.4;
		}
		this._reducedMotion = globalThis.matchMedia(
			'(prefers-reduced-motion: reduce)',
		).matches;

		// The sky, light, mountains and ground are components (see
		// ./components/world.tsx); everything else lives on the slope.
		this._slope.rotation.x = -slopeAngle;
		this._scene.add(this._slope);

		this._player = new Player({
			onRolling: () => {
				this._callbacks.onRolling();
			},
			onMove: () => {
				this._callbacks.onDistance(this._player.distance);
				this.checkHits();
			},
		});
		this._trail = new EasterEggTrail(this._player, {
			canSmash: () =>
				this._player.isRolling && this._caughtAt === undefined,
			onSmash: (placed, instance) => {
				this.smash(placed, instance);
			},
		});
		this._bears = new Bears(this._player, {
			isCaught: () => this._caughtAt !== undefined,
			onCatch: (bear) => {
				this.caught(bear);
			},
		});

		this.systems.add(SYSTEM_ORDER.character, (dt) => {
			this.updatePlayer(dt);
		});
		this.systems.add(SYSTEM_ORDER.bears, (dt) => {
			this._bears.update(dt, this._time);
		});
		this.systems.add(SYSTEM_ORDER.easterEggs, (dt) => {
			this._trail.update(dt, this._time);
		});
		this.systems.add(SYSTEM_ORDER.effects, (dt) => {
			this._effects.update(dt);
		});
		this.systems.add(SYSTEM_ORDER.camera, (dt) => {
			this.updateCamera(dt);
		});
	}

	/**
	 * Now and then, sends a bear up a newly placed tree: more of them further
	 * down, and they lurk around the easter eggs.
	 * @param tree - The tree that has just been placed.
	 * @param isInLane - Whether it's in the lane I roll down.
	 */
	private placeBear(tree: Tree<BearActor>, isInLane: boolean): void {
		if (tree.occupant) {
			this._bears.release(tree.occupant);
		}
		const { x, z } = tree.mesh.position;
		const bearChance = this._trail.isInClearing(x, z, blastReach)
			? 0.3
			: Math.min(0.08, 0.025 + this._player.distance / 12_000);
		if (isInLane && z < -70 && Math.random() < bearChance) {
			this._bears.climb(tree);
		}
	}

	private updatePlayer(dt: number): void {
		const { left, right, faster, slower, steer, throttle } = this.input;
		const controls: PlayerControls = {
			turn: MathUtils.clamp(steer + Number(right) - Number(left), -1, 1),
			push: MathUtils.clamp(
				throttle + Number(faster) - Number(slower),
				-1,
				1,
			),
		};
		this._player.update(
			dt,
			this._time,
			controls,
			this._caughtAt !== undefined,
		);
	}

	private checkHits(): void {
		const forest = this._forest;
		if (!forest) {
			return;
		}
		const player = this._player.position;
		for (const tree of forest.hits(player)) {
			this.topple(forest, tree, tree.mesh.position.x - player.x);
		}
	}

	private topple(
		forest: Forest<BearActor>,
		tree: Tree<BearActor>,
		dx: number,
	): void {
		// Knocking a bear out of its tree is a bad idea.
		const { occupant: bear } = tree;
		if (bear && this._bears.isTreeBound(bear)) {
			this.caught(bear);
		}

		const side = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
		const direction = this._v
			.set(
				side * (0.8 + Math.abs(dx)) + this._player.lateral * 0.08,
				0,
				-1.4,
			)
			.normalize();
		forest.fell(tree, direction, this._player.speed);

		this._combo = nextCombo(this._combo, this._time - this._lastHit);
		this._lastHit = this._time;
		this._score += this._combo;
		this._callbacks.onScore(this._score, this._combo);
		if (!this._reducedMotion) {
			this._shake = Math.min(0.35, this._shake + 0.18);
		}

		// A burst of needles and bark.
		this._effects.burst({
			origin: tree.mesh.position,
			count: 22,
			lift: [0.5, 5],
			spread: { x: 8, z: 6 },
			upward: [2, 9],
			drift: { x: side * 3, z: -this._player.speed * 0.3 },
		});
	}

	/**
	 * Whether a tree at (x, z) would sit between the chase camera and me.
	 * @param x - Tree position across the slope.
	 * @param z - Tree position down the slope.
	 * @returns True if the tree would block the view.
	 */
	private blocksView(x: number, z: number): boolean {
		return (
			this._player.isRolling &&
			isBlockingChaseView(
				{ x, z },
				this._player.position,
				this._chaseOffset,
			)
		);
	}

	/**
	 * Blows an easter egg apart as I roll through it.
	 * @param placed - The easter egg.
	 * @param instance - Its scene objects.
	 */
	private smash(placed: PlacedEasterEgg, instance: EasterEggInstance): void {
		const centre = this._v2.set(
			placed.x,
			terrainHeight(placed.x, placed.z) + 1,
			placed.z,
		);
		this._effects.shatter(instance.object, centre, this._player.speed);
		this._effects.explode(centre);
		this.blastBears(placed);
		// Plus a spray of dirt and needles.
		this._effects.burst({
			origin: centre,
			count: 40,
			lift: [0, 0],
			spread: { x: 14, z: 14 },
			upward: [4, 12],
			drift: { x: 0, z: -this._player.speed * 0.3 },
		});
		if (!this._reducedMotion) {
			this._shake = 0.6;
		}
	}

	/**
	 * Sends any bears around a smashed easter egg flying, for bonus points:
	 * the more at once, the bigger the multiplier.
	 * @param placed - The smashed easter egg.
	 */
	private blastBears(placed: PlacedEasterEgg): void {
		const count = this._bears.blast(
			placed,
			placed.egg.clearingRadius + blastReach,
		);
		if (count === 0) {
			return;
		}
		const points = bearBlastPoints(count);
		this._score += points;
		this._callbacks.onScore(this._score, this._combo);
		this._callbacks.onBearBlast(count, points);
	}

	private caught(bear: BearActor): void {
		if (this._caughtAt !== undefined) {
			return;
		}
		this._caughtAt = this._time;
		// The bear stands on the far side of me from the camera, so we're both
		// in shot.
		this._bears.maul(bear, this._v.copy(this._chaseOffset).negate());
		if (!this._reducedMotion) {
			this._shake = 0.5;
		}
	}

	private updateCamera(dt: number): void {
		const player = this._player.position;

		// Once caught, move in for a closer look.
		this._cameraZoom = MathUtils.lerp(
			this._cameraZoom,
			this._caughtAt === undefined ? 1 : 0.8,
			damp(2, dt),
		);

		// Where the chase camera wants to be, in world space.
		const chase = this._slope.localToWorld(
			this._v
				.copy(this._chaseOffset)
				.multiplyScalar(this._cameraZoom)
				.add(player),
		);
		const chaseTarget = this._slope.localToWorld(
			this._v2.copy(player).add(this._chaseLookAhead),
		);

		const swing = MathUtils.smootherstep(
			this._time,
			STAR_END,
			cameraSwingEnd,
		);
		const position = chase.lerp(this._introCamera, 1 - swing);
		const target = chaseTarget.lerp(this._introTarget, 1 - swing);
		const cameraFov = MathUtils.lerp(fov, chaseFov, swing);
		if (cameraFov !== this._camera.fov) {
			this._camera.fov = cameraFov;
			this._camera.updateProjectionMatrix();
		}

		if (swing < 1) {
			this._camera.position.copy(position);
		} else {
			this._camera.position.lerp(position, damp(6, dt));
		}
		this._shake = Math.max(0, this._shake - dt * 1.2);
		if (this._shake > 0) {
			this._camera.position.x += MathUtils.randFloatSpread(this._shake);
			this._camera.position.y += MathUtils.randFloatSpread(this._shake);
		}
		this._camera.lookAt(target);
	}

	public get scene(): Scene {
		return this._scene;
	}

	// The mountainside everything rolls down, tilted to the slope's angle.
	public get slope(): Group {
		return this._slope;
	}

	// Where I am, in the slope's space.
	public get player(): Vector3 {
		return this._player.position;
	}

	// My rig, to add to the slope.
	public get character(): Object3D {
		return this._player.root;
	}

	// The bears, to add to the slope.
	public get bears(): Object3D {
		return this._bears.group;
	}

	// The easter eggs, to add to the slope.
	public get easterEggs(): Object3D {
		return this._trail.group;
	}

	// Debris, flying pieces and the smash's fireball, to add to the slope.
	public get effects(): Object3D {
		return this._effects.group;
	}

	public get camera(): PerspectiveCamera {
		return this._camera;
	}

	/**
	 * Runs the game forward without waiting for real time. Lets tests skip
	 * the intro or play out a crash quickly.
	 * @param seconds - How much game time to simulate.
	 */
	public advance(seconds: number): void {
		const steps = Math.ceil(seconds * 60);
		for (let i = 0; i < steps; i++) {
			this.step(1 / 60);
		}
	}

	/**
	 * Ends the run as though a bear had got me.
	 */
	public catchPlayer(): void {
		this.caught(this._bears.spawnBesideMe());
	}

	/**
	 * Hands the game its trees, and plants them for the start of the run.
	 * @param forest - The trees.
	 */
	public attachForest(forest: Forest<BearActor>): void {
		this._forest = forest;
		forest.plant();
	}

	/**
	 * Gets ready to be drawn: compiling shaders up front, so nothing
	 * stutters the first time it's needed.
	 * @param renderer - The renderer that will draw the game.
	 */
	public prepare(renderer: WebGLRenderer): void {
		if (this._forest) {
			this._forest.prepare(renderer, this._scene, this._camera);
		} else {
			renderer.compile(this._scene, this._camera);
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
		this._camera.aspect = aspect;
		this._camera.updateProjectionMatrix();

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
		this._chaseOffset.lerpVectors(
			portraitChaseOffset,
			chaseOffset,
			landscape,
		);
		this._chaseLookAhead.lerpVectors(
			portraitChaseLookAhead,
			chaseLookAhead,
			landscape,
		);
	}

	/**
	 * Moves the game on.
	 * @param dt - Seconds since the last step.
	 */
	public step(dt: number): void {
		this._time += dt;
		this.systems.run(dt);

		if (
			this._caughtAt === undefined ||
			this._isGameOverReported ||
			this._time - this._caughtAt <= gameOverDelay
		) {
			return;
		}
		this._isGameOverReported = true;
		this._callbacks.onGameOver(this._score, this._player.distance);
	}

	public dispose(): void {
		// Each part frees what it made; the world's components free theirs.
		this._player.dispose();
		this._bears.dispose();
		this._trail.dispose();
		this._effects.dispose();
	}
}
