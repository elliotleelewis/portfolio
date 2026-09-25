import {
	Group,
	MathUtils,
	type Object3D,
	type PerspectiveCamera,
	Scene,
	Vector3,
	type WebGLRenderer,
} from 'three';

import { type BearActor, Bears } from './bears';
import { ChaseCamera } from './chase-camera';
import { bearChance } from './difficulty';
import { EasterEggTrail, type PlacedEasterEgg } from './easter-egg-trail';
import { type EasterEggInstance } from './easter-eggs';
import { Effects } from './effects';
import { type Forest, type ForestHooks, type Tree } from './forest';
import { Player, type PlayerControls, STAR_END } from './player';
import { bearBlastPoints, nextCombo } from './scoring';
import { type StageScene } from './stage-scene';
import { SYSTEM_ORDER, Systems } from './systems';
import { isBlockingChaseView, isInChaseCameraWay } from './view';
import { SLOPE_ANGLE, terrainHeight } from './world';

export interface GameCallbacks {
	// The intro is over and the player now has control.
	onRolling: () => void;
	onScore: (score: number, combo: number) => void;
	// I've smashed an easter egg, so found it.
	onEasterEgg: (id: string) => void;
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

// How far past an easter egg's clearing a smash reaches bears.
const blastReach = 12;
// How long after being caught before the game-over screen shows.
const gameOverDelay = 1.6;

/**
 * A little mountain-rolling game: I look around, strike a star pose, then
 * cartwheel down the mountain flattening trees.
 */
export class Game implements StageScene {
	private readonly _callbacks: GameCallbacks;
	private readonly _scene = new Scene();
	private readonly _slope = new Group();
	private readonly _camera: ChaseCamera;
	private readonly _player: Player;
	private _forest: Forest<BearActor> | undefined;
	private readonly _effects = new Effects();
	private readonly _bears: Bears;
	private readonly _trail: EasterEggTrail;

	private _time = 0;
	private _score = 0;
	private _combo = 0;
	private _lastHit = -10;
	private _caughtAt: number | undefined;
	private _isGameOverReported = false;

	private readonly _v = new Vector3();
	private readonly _v2 = new Vector3();

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

		// The sky, light, mountains and ground are components (see
		// ./components/world.tsx); everything else lives on the slope.
		this._slope.rotation.x = -SLOPE_ANGLE;
		this._scene.add(this._slope);
		this._camera = new ChaseCamera(
			this._slope,
			globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
		);

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
			isInTheWay: (x, z) =>
				isInChaseCameraWay(
					{ x, z },
					this._player.position,
					this._camera.offset,
				),
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
			this._camera.update(
				dt,
				this._time,
				this._player.position,
				this._caughtAt !== undefined,
			);
		});
		this.systems.add(SYSTEM_ORDER.follow, () => {
			this._bears.pinAlerts(this.camera);
		});
	}

	/**
	 * Now and then, sends a bear up a newly placed tree: more of them the
	 * further down I get.
	 * @param tree - The tree that has just been placed.
	 * @param isInLane - Whether it's in the lane I roll down.
	 */
	private placeBear(tree: Tree<BearActor>, isInLane: boolean): void {
		if (tree.occupant) {
			this._bears.release(tree.occupant);
		}
		if (
			isInLane &&
			tree.mesh.position.z < -70 &&
			Math.random() < bearChance(this._player.distance)
		) {
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
		this._camera.shake(0.18, 0.35);

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
				this._camera.offset,
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
		this._camera.shake(0.6);
		this._callbacks.onEasterEgg(placed.egg.id);
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
		this._bears.maul(bear, this._v.copy(this._camera.offset).negate());
		this._camera.shake(0.5);
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

	// Bears' "!"s pinned to the edge of the view, to add to the scene.
	public get alertPins(): Object3D {
		return this._bears.pins;
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
		return this._camera.camera;
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
			this._forest.prepare(renderer, this._scene, this.camera);
		} else {
			renderer.compile(this._scene, this.camera);
		}
	}

	/**
	 * Fits the camera to the stage's size.
	 * @param width - Stage width, in CSS pixels.
	 * @param height - Stage height, in CSS pixels.
	 */
	public resize(width: number, height: number): void {
		this._camera.resize(width, height);
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
