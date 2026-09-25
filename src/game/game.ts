import {
	type BufferGeometry,
	Color,
	Group,
	InstancedMesh,
	type Material,
	MathUtils,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	type Object3D,
	PerspectiveCamera,
	Quaternion,
	Scene,
	SphereGeometry,
	TetrahedronGeometry,
	Vector3,
	type WebGLRenderer,
} from 'three';

import { type BearActor, Bears } from './bears';
import { damp } from './easing';
import {
	EASTER_EGGS,
	type EasterEgg,
	type EasterEggInstance,
	disposeObject,
} from './easter-eggs';
import {
	type Forest,
	type ForestHooks,
	TREE_WINDOW,
	type Tree,
} from './forest';
import { Player, type PlayerControls, STAR_END } from './player';
import { bearBlastPoints, nextCombo } from './scoring';
import { type StageScene } from './stage-scene';
import { SYSTEM_ORDER, Systems } from './systems';
import { isBlockingChaseView } from './view';
import { LANE_HALF_WIDTH, terrainHeight } from './world';

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

interface PlacedEasterEgg {
	egg: EasterEgg;
	x: number;
	z: number;
	yaw: number;
	// Created once it's close enough to matter.
	instance: EasterEggInstance | undefined;
	// Whether I've barrelled through it.
	isSmashed: boolean;
}

// A piece of a smashed easter egg, flying off.
interface Shard {
	mesh: Mesh;
	velocity: Vector3;
	spin: Vector3;
	scale: Vector3;
	life: number;
}

// The fireball and smoke from smashing an easter egg.
interface Blast {
	fire: Mesh<SphereGeometry, MeshBasicMaterial>;
	smoke: Mesh<SphereGeometry, MeshBasicMaterial>;
	age: number;
}

interface Debris {
	position: Vector3;
	velocity: Vector3;
	spin: Vector3;
	rotation: Vector3;
	life: number;
}

// Steepness of the mountainside, in radians.
const slopeAngle = 0.24;
const debrisCount = 320;
const blastDuration = 0.7;
// How far past an easter egg's clearing a smash reaches bears.
const blastReach = 12;
// Roughly how far apart the easter eggs are, in metres.
const easterEggSpacing = 150;
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
	private readonly _debris: Debris[] = [];
	private readonly _debrisMesh: InstancedMesh;
	private readonly _bears: Bears;
	private readonly _easterEggs: PlacedEasterEgg[] = [];
	private readonly _shards: Shard[] = [];
	private readonly _blast: Blast;
	private _easterEggCount = 0;
	private readonly _reducedMotion: boolean;

	private _time = 0;
	private _score = 0;
	private _combo = 0;
	private _lastHit = -10;
	private _shake = 0;
	private _debrisCursor = 0;
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
		isInClearing: (x, z) => this.isInClearing(x, z),
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

		// Plan the first easter egg before the trees are planted, so they
		// leave it a clearing.
		this.planEasterEgg(-easterEggSpacing + MathUtils.randFloatSpread(40));

		this._player = new Player({
			onRolling: () => {
				this._callbacks.onRolling();
			},
			onMove: () => {
				this._callbacks.onDistance(this._player.distance);
				this.checkHits();
			},
		});
		this._bears = new Bears(this._player, {
			isCaught: () => this._caughtAt !== undefined,
			onCatch: (bear) => {
				this.caught(bear);
			},
		});

		this._debrisMesh = new InstancedMesh(
			new TetrahedronGeometry(0.14),
			new MeshLambertMaterial({ flatShading: true }),
			debrisCount,
		);
		this._debrisMesh.frustumCulled = false;
		const color = new Color();
		for (let i = 0; i < debrisCount; i++) {
			this._debris.push({
				position: new Vector3(),
				velocity: new Vector3(),
				spin: new Vector3(),
				rotation: new Vector3(),
				life: 0,
			});
			color.set(i % 5 === 0 ? '#6b4d33' : '#3f6532');
			color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.12);
			this._debrisMesh.setColorAt(i, color);
			this._debrisMesh.setMatrixAt(i, this._m.makeScale(0, 0, 0));
		}
		this._slope.add(this._debrisMesh);

		this._blast = {
			fire: new Mesh(
				new SphereGeometry(1, 16, 12),
				new MeshBasicMaterial({
					color: '#ffb347',
					transparent: true,
					depthWrite: false,
					fog: false,
				}),
			),
			smoke: new Mesh(
				new SphereGeometry(1, 12, 8),
				new MeshBasicMaterial({
					color: '#8a8f8c',
					transparent: true,
					depthWrite: false,
				}),
			),
			age: blastDuration,
		};
		this._blast.fire.visible = false;
		this._blast.smoke.visible = false;
		this._slope.add(this._blast.smoke, this._blast.fire);

		this.systems.add(SYSTEM_ORDER.character, (dt) => {
			this.updatePlayer(dt);
		});
		this.systems.add(SYSTEM_ORDER.bears, (dt) => {
			this._bears.update(dt, this._time);
		});
		this.systems.add(SYSTEM_ORDER.easterEggs, (dt) => {
			this.updateEasterEggs(dt);
		});
		this.systems.add(SYSTEM_ORDER.effects, (dt) => {
			this.updateDebris(dt);
			this.updateShards(dt);
			this.updateBlast(dt);
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
		const bearChance = this.isNearClearing(x, z)
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
		for (let i = 0; i < 22; i++) {
			const d = this._debris[this._debrisCursor];
			this._debrisCursor = (this._debrisCursor + 1) % debrisCount;
			d.life = MathUtils.randFloat(0.8, 1.6);
			d.position
				.copy(tree.mesh.position)
				.add(this._v2.set(0, MathUtils.randFloat(0.5, 5), 0));
			d.velocity.set(
				MathUtils.randFloatSpread(8) + side * 3,
				MathUtils.randFloat(2, 9),
				MathUtils.randFloatSpread(6) - this._player.speed * 0.3,
			);
			d.spin.set(
				MathUtils.randFloatSpread(14),
				MathUtils.randFloatSpread(14),
				MathUtils.randFloatSpread(14),
			);
		}
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
	 * Picks the next easter egg and where it goes.
	 * @param z - Roughly where down the slope to put it.
	 */
	private planEasterEgg(z: number): void {
		if (EASTER_EGGS.length === 0) {
			return;
		}
		const egg = EASTER_EGGS[this._easterEggCount % EASTER_EGGS.length];
		this._easterEggCount++;
		// Towards the middle of the slope, where the camera will catch it.
		const margin = LANE_HALF_WIDTH - 10;
		this._easterEggs.push({
			egg,
			x: MathUtils.randFloatSpread(margin * 2),
			z,
			yaw: MathUtils.randFloatSpread(0.6),
			instance: undefined,
			isSmashed: false,
		});
	}

	private isInClearing(x: number, z: number): boolean {
		return this._easterEggs.some(
			(placed) =>
				(x - placed.x) ** 2 + (z - placed.z) ** 2 <
				placed.egg.clearingRadius ** 2,
		);
	}

	private isNearClearing(x: number, z: number): boolean {
		return this._easterEggs.some(
			(placed) =>
				(x - placed.x) ** 2 + (z - placed.z) ** 2 <
				(placed.egg.clearingRadius + blastReach) ** 2,
		);
	}

	private updateEasterEggs(dt: number): void {
		const player = this._player.position;

		// Always have the next one planned well ahead of the trees.
		const last = this._easterEggs.at(-1);
		if (!last || last.z > player.z - TREE_WINDOW - 60) {
			this.planEasterEgg(
				(last?.z ?? player.z) -
					easterEggSpacing +
					MathUtils.randFloatSpread(60),
			);
		}

		// Clear away the ones well behind me.
		const behind = this._easterEggs.filter(({ z }) => z > player.z + 40);
		for (const placed of behind) {
			if (placed.instance) {
				placed.instance.object.removeFromParent();
				disposeObject(placed.instance.object);
			}
			this._easterEggs.splice(this._easterEggs.indexOf(placed), 1);
		}

		for (const placed of this._easterEggs) {
			if (!placed.instance && placed.z > player.z - TREE_WINDOW) {
				placed.instance = placed.egg.create();
				const { object } = placed.instance;
				object.position.set(
					placed.x,
					terrainHeight(placed.x, placed.z) - 0.05,
					placed.z,
				);
				object.rotation.y = placed.yaw;
				this._slope.add(object);
			}
			if (!placed.instance) {
				continue;
			}
			this.updateEasterEgg(placed, placed.instance, dt);
		}
	}

	private updateEasterEgg(
		placed: PlacedEasterEgg,
		instance: EasterEggInstance,
		dt: number,
	): void {
		if (placed.isSmashed) {
			return;
		}
		const { object } = instance;
		const root = this._player.position;
		object.updateMatrixWorld();
		// My position in the easter egg's own space.
		const local = object.worldToLocal(
			this._slope.localToWorld(this._v.copy(root)),
		);
		instance.update?.({ time: this._time, dt, player: local });

		// Barrel straight through anything solid.
		const { footprint } = placed.egg;
		if (
			!footprint ||
			!this._player.isRolling ||
			this._caughtAt !== undefined
		) {
			return;
		}
		const reach = 0.9;
		if (
			Math.abs(local.x) > footprint.halfWidth + reach ||
			Math.abs(local.z) > footprint.halfDepth + reach
		) {
			return;
		}
		this.smash(placed, instance);
	}

	/**
	 * Blows an easter egg apart as I roll through it.
	 * @param placed - The easter egg.
	 * @param instance - Its scene objects.
	 */
	private smash(placed: PlacedEasterEgg, instance: EasterEggInstance): void {
		placed.isSmashed = true;
		const { object } = instance;
		const centre = this._v2.set(
			placed.x,
			terrainHeight(placed.x, placed.z) + 1,
			placed.z,
		);

		// Fling every piece outwards, keeping where it was in the world.
		const meshes: Mesh[] = [];
		object.traverse((child) => {
			if (child instanceof Mesh) {
				meshes.push(child as Mesh);
			}
		});
		for (const mesh of meshes) {
			this._slope.attach(mesh);
			const outwards = this._v
				.subVectors(mesh.position, centre)
				.setY(0)
				.normalize()
				.multiplyScalar(MathUtils.randFloat(4, 11));
			this._shards.push({
				mesh,
				velocity: new Vector3(
					outwards.x + MathUtils.randFloatSpread(3),
					MathUtils.randFloat(5, 12),
					outwards.z - this._player.speed * 0.4,
				),
				spin: new Vector3(
					MathUtils.randFloatSpread(10),
					MathUtils.randFloatSpread(10),
					MathUtils.randFloatSpread(10),
				),
				scale: mesh.scale.clone(),
				life: MathUtils.randFloat(1.4, 2.4),
			});
		}
		object.removeFromParent();

		const { fire, smoke } = this._blast;
		fire.position.copy(centre);
		smoke.position.copy(centre);
		this._blast.age = 0;
		this.blastBears(placed);

		// Plus a spray of dirt and needles.
		for (let i = 0; i < 40; i++) {
			const d = this._debris[this._debrisCursor];
			this._debrisCursor = (this._debrisCursor + 1) % debrisCount;
			d.life = MathUtils.randFloat(0.8, 1.6);
			d.position.copy(centre);
			d.velocity.set(
				MathUtils.randFloatSpread(14),
				MathUtils.randFloat(4, 12),
				MathUtils.randFloatSpread(14) - this._player.speed * 0.3,
			);
			d.spin.set(
				MathUtils.randFloatSpread(14),
				MathUtils.randFloatSpread(14),
				MathUtils.randFloatSpread(14),
			);
		}
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

	private updateShards(dt: number): void {
		for (let i = this._shards.length - 1; i >= 0; i--) {
			const shard = this._shards[i];
			const { mesh, velocity } = shard;
			shard.life -= dt;
			if (shard.life <= 0) {
				mesh.removeFromParent();
				disposeObject(mesh);
				this._shards.splice(i, 1);
				continue;
			}
			velocity.y -= 22 * dt;
			mesh.position.addScaledVector(velocity, dt);
			const ground = terrainHeight(mesh.position.x, mesh.position.z);
			if (mesh.position.y < ground) {
				mesh.position.y = ground;
				velocity.multiplyScalar(0.5);
				velocity.y = Math.abs(velocity.y) * 0.6;
			}
			mesh.rotation.x += shard.spin.x * dt;
			mesh.rotation.y += shard.spin.y * dt;
			mesh.rotation.z += shard.spin.z * dt;
			// Shrink away at the end.
			mesh.scale
				.copy(shard.scale)
				.multiplyScalar(Math.min(1, shard.life * 2.5));
		}
	}

	private updateBlast(dt: number): void {
		const { fire, smoke } = this._blast;
		const isActive = this._blast.age < blastDuration;
		fire.visible = isActive;
		smoke.visible = isActive;
		if (!isActive) {
			return;
		}
		this._blast.age += dt;
		const t = Math.min(1, this._blast.age / blastDuration);
		// A quick flash of fire, then a slower, wider puff of smoke.
		fire.scale.setScalar(0.4 + Math.sqrt(t) * 2.4);
		fire.material.opacity = (1 - t) ** 2;
		smoke.scale.setScalar(0.8 + t * 3.5);
		smoke.position.y += dt * 2;
		smoke.material.opacity = 0.55 * (1 - t);
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

	private updateDebris(dt: number): void {
		let isActive = false;
		for (const [i, d] of this._debris.entries()) {
			if (d.life <= 0) {
				continue;
			}
			isActive = true;
			d.life -= dt;
			d.velocity.y -= 18 * dt;
			d.position.addScaledVector(d.velocity, dt);
			const ground = terrainHeight(d.position.x, d.position.z);
			if (d.position.y < ground) {
				d.position.y = ground;
				d.velocity.multiplyScalar(0.4);
				d.velocity.y = Math.abs(d.velocity.y);
			}
			d.rotation.addScaledVector(d.spin, dt);
			const scale = Math.max(0, Math.min(1, d.life * 2));
			this._q.setFromAxisAngle(
				this._v.copy(d.rotation).normalize(),
				d.rotation.length(),
			);
			this._m.compose(d.position, this._q, this._v2.setScalar(scale));
			this._debrisMesh.setMatrixAt(i, this._m);
		}
		if (isActive) {
			this._debrisMesh.instanceMatrix.needsUpdate = true;
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
		this._player.dispose();
		const geometries = new Set<BufferGeometry>();
		const materials = new Set<Material>();
		this._scene.traverse((object) => {
			if (!(object instanceof Mesh)) {
				return;
			}

			geometries.add(object.geometry as BufferGeometry);
			const material = object.material as Material | Material[];
			const list = Array.isArray(material) ? material : [material];
			for (const m of list) {
				materials.add(m);
			}
		});
		for (const geometry of geometries) {
			geometry.dispose();
		}
		for (const material of materials) {
			material.dispose();
		}
		this._debrisMesh.dispose();
		for (const shard of this._shards) {
			disposeObject(shard.mesh);
		}
		this._bears.dispose();
	}
}
