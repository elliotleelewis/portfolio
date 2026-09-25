import {
	type BufferGeometry,
	Color,
	DirectionalLight,
	Fog,
	Group,
	HemisphereLight,
	InstancedMesh,
	type Material,
	MathUtils,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	PCFShadowMap,
	PerspectiveCamera,
	Quaternion,
	Scene,
	SphereGeometry,
	TetrahedronGeometry,
	Vector3,
	WebGLRenderer,
} from 'three';

import {
	BEAR_STANDING_HEIGHT,
	BEAR_TRUNK_OFFSET,
	type Bear,
	type BearParts,
	createBear,
	createBearParts,
	disposeBearParts,
} from './bear';
import { type Character, createCharacter } from './character';
import {
	EASTER_EGGS,
	type EasterEgg,
	type EasterEggInstance,
	disposeObject,
} from './easter-eggs';
import {
	CHUNK_LENGTH,
	LANE_HALF_WIDTH,
	createGroundChunk,
	createMountains,
	createTreeGeometry,
	shapeGroundChunk,
	terrainHeight,
} from './world';

export interface GameCallbacks {
	// The first frame has been drawn; safe to fade the canvas in.
	onReady: () => void;
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

type BearState =
	| 'free'
	| 'clinging'
	| 'alert'
	| 'climbing'
	| 'dismounting'
	| 'charging'
	| 'leaving'
	| 'mauling'
	| 'blasted';

interface BearActor {
	rig: Bear;
	state: BearState;
	tree: Tree | undefined;
	timer: number;
	// Height of the bear's middle above the ground.
	height: number;
	heading: number;
	gait: number;
	// Where the bear stands relative to me once it has caught me.
	offset: Vector3;
	// How it flies (and tumbles) once blasted.
	velocity: Vector3;
	spin: Vector3;
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

interface Tree {
	mesh: Mesh;
	// Its own copy, so it can fade out on its own.
	material: MeshLambertMaterial;
	// Fading out of the way of the camera, and how opaque it still is.
	isFading: boolean;
	opacity: number;
	bear: BearActor | undefined;
	state: 'standing' | 'falling';
	yaw: number;
	axis: Vector3;
	angle: number;
	angularVelocity: number;
	velocity: Vector3;
	hitRadius: number;
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
const fogColor = new Color('#dde3e5');
const treeCount = 170;
const treeWindow = 230;
const debrisCount = 320;
const blastDuration = 0.7;
// How long a tree in the camera's way takes to fade out, in seconds.
const treeFadeDuration = 0.3;
// How far past an easter egg's clearing a smash reaches bears.
const blastReach = 12;
// Points for each bear blasted, multiplied again by how many went at once.
const bearBlastPoints = 5;
const contactOffset = 0.05;
const bearCount = 8;
// States in which a bear is still up (or on) its tree.
const treeBoundStates = new Set<BearState>(['clinging', 'alert', 'climbing']);
const bearClimbSpeed = 3.4;
const bearCatchRadius = 1.35;
// Roughly how far apart the easter eggs are, in metres.
const easterEggSpacing = 150;
// How long after being caught before the game-over screen shows.
const gameOverDelay = 1.6;

// Intro timeline, in seconds.
const lookStart = 1.5;
const starStart = 5;
const starEnd = 5.8;
const turnEnd = 6.5;
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

const smooth = (edge0: number, edge1: number, x: number): number =>
	MathUtils.smootherstep(x, edge0, edge1);

const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

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

/**
 * A little mountain-rolling game: I look around, strike a star pose, then
 * cartwheel down the mountain flattening trees.
 */
export class Game {
	private readonly _host: HTMLElement;
	private readonly _callbacks: GameCallbacks;
	private readonly _renderer: WebGLRenderer;
	private readonly _scene = new Scene();
	private readonly _camera = new PerspectiveCamera(fov, 1, 0.05, 1200);
	private readonly _introCamera = new Vector3();
	private readonly _introTarget = new Vector3();
	private readonly _chaseOffset = new Vector3();
	private readonly _chaseLookAhead = new Vector3();
	private readonly _slope = new Group();
	private readonly _sun = new DirectionalLight('#fff3df', 2.2);
	private readonly _mountains: Group;
	private readonly _character: Character;
	private readonly _ground: Mesh[] = [];
	private readonly _trees: Tree[] = [];
	private readonly _debris: Debris[] = [];
	private readonly _debrisMesh: InstancedMesh;
	private readonly _bears: BearActor[] = [];
	private readonly _bearParts: BearParts;
	private readonly _easterEggs: PlacedEasterEgg[] = [];
	private readonly _shards: Shard[] = [];
	private readonly _blast: Blast;
	private _easterEggCount = 0;
	private readonly _resizeObserver: ResizeObserver;
	private readonly _reducedMotion: boolean;

	private _time = 0;
	private _last = 0;
	private _ready = false;
	private _rolling = false;
	private _speed = 0;
	private _lateral = 0;
	private _distance = 0;
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

	public readonly input: GameInput = {
		left: false,
		right: false,
		faster: false,
		slower: false,
		steer: 0,
		throttle: 0,
	};

	public constructor(
		host: HTMLElement,
		callbacks: GameCallbacks,
		options: GameOptions = {},
	) {
		this._host = host;
		this._callbacks = callbacks;
		if (options.skipIntro) {
			this._time = starEnd - 0.4;
		}
		this._reducedMotion = globalThis.matchMedia(
			'(prefers-reduced-motion: reduce)',
		).matches;

		this._renderer = new WebGLRenderer({ antialias: true });
		this._renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
		this._renderer.shadowMap.enabled = true;
		this._renderer.shadowMap.type = PCFShadowMap;
		this._renderer.domElement.classList.add(
			'absolute',
			'inset-0',
			'size-full',
		);
		host.append(this._renderer.domElement);

		this._scene.background = fogColor;
		this._scene.fog = new Fog(fogColor, 35, 240);

		// Lighting: soft, overcast mountain light.
		this._scene.add(new HemisphereLight('#f4f7f9', '#4f5f3c', 2.1));
		this._sun.position.set(20, 40, 15);
		this._sun.castShadow = true;
		this._sun.shadow.mapSize.set(2048, 2048);
		this._sun.shadow.camera.left = -30;
		this._sun.shadow.camera.right = 30;
		this._sun.shadow.camera.top = 30;
		this._sun.shadow.camera.bottom = -30;
		this._sun.shadow.camera.far = 120;
		this._sun.shadow.bias = -0.0005;
		this._sun.shadow.normalBias = 0.03;
		this._scene.add(this._sun, this._sun.target);

		this._mountains = createMountains(fogColor);
		this._scene.add(this._mountains);

		this._slope.rotation.x = -slopeAngle;
		this._scene.add(this._slope);

		const groundMaterial = new MeshLambertMaterial({
			vertexColors: true,
			flatShading: true,
		});

		// The flat ledge I'm standing on at the start.
		const ledge = createGroundChunk(groundMaterial, 60);
		shapeGroundChunk(ledge, 30);
		this._scene.add(ledge);
		this._ground.push(ledge);

		// Chunks of mountainside that leapfrog each other as I roll.
		for (let i = 0; i < 3; i++) {
			const chunk = createGroundChunk(groundMaterial);
			shapeGroundChunk(chunk, -CHUNK_LENGTH / 2 - i * CHUNK_LENGTH);
			this._slope.add(chunk);
			this._ground.push(chunk);
		}

		this._bearParts = createBearParts();
		for (let i = 0; i < bearCount; i++) {
			const rig = createBear(this._bearParts);
			rig.root.visible = false;
			this._slope.add(rig.root);
			this._bears.push({
				rig,
				state: 'free',
				tree: undefined,
				timer: 0,
				height: 0,
				heading: 0,
				gait: Math.random() * 10,
				offset: new Vector3(),
				velocity: new Vector3(),
				spin: new Vector3(),
			});
		}

		// Plan the first easter egg before the trees, so they leave it a clearing.
		this.planEasterEgg(-easterEggSpacing + MathUtils.randFloatSpread(40));
		this.createTrees();

		this._character = createCharacter();
		this._slope.add(this._character.root);

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

		this._resizeObserver = new ResizeObserver(() => {
			this.resize();
		});
		this._resizeObserver.observe(host);
		this.resize();
	}

	private createTrees(): void {
		const geometries = [
			createTreeGeometry(6, 8, 1.5),
			createTreeGeometry(5, 6.5, 1.7),
			createTreeGeometry(8, 11, 1.4),
		];
		const materials = ['#ffffff', '#dfe8d4', '#c9d6c2'].map(
			(color) =>
				new MeshLambertMaterial({
					color,
					vertexColors: true,
					flatShading: true,
				}),
		);

		for (let i = 0; i < treeCount; i++) {
			const material = materials[i % materials.length].clone();
			const mesh = new Mesh(geometries[i % geometries.length], material);
			mesh.castShadow = true;
			const tree: Tree = {
				mesh,
				material,
				isFading: false,
				opacity: 1,
				bear: undefined,
				state: 'standing',
				yaw: 0,
				axis: new Vector3(),
				angle: 0,
				angularVelocity: 0,
				velocity: new Vector3(),
				hitRadius: 1,
			};
			this.placeTree(tree, 20 - Math.random() * treeWindow, true);
			this._slope.add(mesh);
			this._trees.push(tree);
		}

		// Trees framing the opening shot, on the flat ledge.
		const framing: [number, number, number][] = [
			[-3.2, -1.5, 1.1],
			[-5, 3, 1.3],
			[-7.5, -4, 1.4],
			[3.6, -2.5, 1.2],
			[5.5, 2, 1],
			[8, -6, 1.5],
			[-11, 1, 1.2],
			[11, 5, 1.3],
			[-2, 12, 1.1],
			[4, 16, 1],
		];
		for (const [index, [x, z, scale]] of framing.entries()) {
			const mesh = new Mesh(
				geometries[index % geometries.length],
				materials[index % materials.length],
			);
			mesh.position.set(x, terrainHeight(x, z) - 0.1, z);
			mesh.scale.setScalar(scale);
			mesh.rotation.y = index;
			mesh.castShadow = true;
			this._scene.add(mesh);
		}
	}

	/**
	 * Stands a tree back up at a random spot around `z`.
	 * @param tree - The tree to place.
	 * @param z - Where along the slope to place it.
	 * @param isInitial - Whether this is the first placement.
	 */
	private placeTree(tree: Tree, z: number, isInitial = false): void {
		const isInLane = Math.random() < 0.72;
		const pickX = (): number =>
			isInLane
				? MathUtils.randFloatSpread(LANE_HALF_WIDTH * 2)
				: Math.sign(Math.random() - 0.5) *
					MathUtils.randFloat(LANE_HALF_WIDTH, 70);
		let x = pickX();
		// Keep the first stretch clear so the roll gets going.
		if (isInitial && z > -14 && Math.abs(x) < 4) {
			x += Math.sign(x || 1) * 5;
		}
		// Leave a clearing around each easter egg.
		for (let i = 0; i < 6 && this.isInClearing(x, z); i++) {
			x = pickX();
		}
		if (this.isInClearing(x, z)) {
			x = Math.sign(x || 1) * (LANE_HALF_WIDTH + 8);
		}
		const scale = MathUtils.randFloat(0.75, 1.25);
		tree.state = 'standing';
		tree.mesh.visible = true;
		tree.mesh.castShadow = true;
		if (tree.isFading) {
			tree.isFading = false;
			tree.opacity = 1;
			tree.material.opacity = 1;
			tree.material.transparent = false;
			tree.material.needsUpdate = true;
		}
		tree.yaw = Math.random() * Math.PI * 2;
		tree.angle = 0;
		tree.angularVelocity = 0;
		tree.velocity.set(0, 0, 0);
		tree.hitRadius = 1 + scale * 0.35;
		tree.mesh.scale.setScalar(scale);
		tree.mesh.position.set(x, terrainHeight(x, z) - 0.15, z);
		tree.mesh.quaternion.setFromAxisAngle(this._up, tree.yaw);

		if (tree.bear) {
			this.releaseBear(tree.bear);
		}
		// Now and then, a bear is up the tree. More of them further down, and
		// they lurk around the easter eggs.
		const bearChance = this.isNearClearing(x, z)
			? 0.3
			: Math.min(0.08, 0.025 + this._distance / 12_000);
		const bear = this._bears.find(({ state }) => state === 'free');
		if (bear && isInLane && z < -70 && Math.random() < bearChance) {
			this.attachBear(bear, tree);
		}
	}

	/**
	 * Sends a bear up a tree, clinging to the uphill side of the trunk.
	 * @param bear - A free bear.
	 * @param tree - The tree to climb.
	 */
	private attachBear(bear: BearActor, tree: Tree): void {
		const { rig } = bear;
		const scale = tree.mesh.scale.x;
		bear.state = 'clinging';
		bear.tree = tree;
		bear.timer = 0;
		bear.height = MathUtils.randFloat(2.6, 3.8) * scale;
		bear.heading = Math.PI;
		tree.bear = bear;
		const { x, y, z } = tree.mesh.position;
		rig.root.visible = true;
		rig.root.position.set(x, y + bear.height, z + BEAR_TRUNK_OFFSET);
		rig.root.rotation.set(0, Math.PI, 0);
		rig.pose.position.set(0, 0, 0);
		rig.pose.rotation.set(-Math.PI / 2, 0, 0);
		rig.head.rotation.set(0, 0, 0);
		rig.alert.visible = false;
		rig.alert.position.set(0, 1.4, 0);
		for (const [i, leg] of rig.legs.entries()) {
			leg.rotation.set(0, 0, i % 2 === 0 ? 0.35 : -0.35);
		}
	}

	private releaseBear(bear: BearActor): void {
		if (bear.tree) {
			bear.tree.bear = undefined;
		}
		bear.tree = undefined;
		bear.state = 'free';
		bear.rig.root.visible = false;
	}

	private resize(): void {
		const { clientWidth: width, clientHeight: height } = this._host;
		if (width === 0 || height === 0) {
			return;
		}
		this._renderer.setSize(width, height, false);
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

		const landscape = smooth(0.5, 1.3, aspect);
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

	private frame(now: number): void {
		const dt = Math.min((now - this._last) / 1000, 1 / 20);
		this._last = now;
		this._time += dt;

		this.updateCharacter(dt);
		this.updateTrees(dt);
		this.updateBears(dt);
		this.updateEasterEggs(dt);
		this.updateDebris(dt);
		this.updateShards(dt);
		this.updateBlast(dt);
		this.updateGround();
		this.updateCamera(dt);

		this._renderer.render(this._scene, this._camera);

		if (
			this._caughtAt !== undefined &&
			!this._isGameOverReported &&
			this._time - this._caughtAt > gameOverDelay
		) {
			this._isGameOverReported = true;
			this._callbacks.onGameOver(this._score, this._distance);
		}

		if (this._ready) {
			return;
		}

		this._ready = true;
		this._callbacks.onReady();
	}

	private updateCharacter(dt: number): void {
		const t = this._time;
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
		const star = smooth(starStart, starEnd, t);
		c.leftArm.rotation.z = MathUtils.lerp(0.08, 2.35, star);
		c.rightArm.rotation.z = -c.leftArm.rotation.z;
		c.leftLeg.rotation.z = MathUtils.lerp(0, 0.5, star);
		c.rightLeg.rotation.z = -c.leftLeg.rotation.z;

		// Turn side-on, ready to cartwheel.
		c.facing.rotation.y = smooth(starEnd, turnEnd, t) * (Math.PI / 2);

		if (t >= turnEnd) {
			if (!this._rolling) {
				this._rolling = true;
				this._callbacks.onRolling();
			}
			if (this._caughtAt === undefined) {
				this.roll(dt);
			} else {
				this.crash(dt);
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

	private roll(dt: number): void {
		const c = this._character;
		const { left, right, faster, slower, steer, throttle } = this.input;

		let target = MathUtils.clamp(10 + this._distance / 40, 10, 28);
		const push = MathUtils.clamp(
			throttle + Number(faster) - Number(slower),
			-1,
			1,
		);
		target *= 1 + push * (push > 0 ? 0.35 : 0.45);
		this._speed = MathUtils.lerp(this._speed, target, damp(0.8, dt));

		const turn = MathUtils.clamp(
			steer + Number(right) - Number(left),
			-1,
			1,
		);
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

		this._callbacks.onDistance(this._distance);
		this.checkHits();
	}

	private checkHits(): void {
		const player = this._character.root.position;
		for (const tree of this._trees) {
			if (tree.state !== 'standing') {
				continue;
			}
			const dx = tree.mesh.position.x - player.x;
			const dz = tree.mesh.position.z - player.z;
			if (Math.abs(dz) < 1 && Math.abs(dx) < tree.hitRadius) {
				this.topple(tree, dx);
			}
		}
	}

	private topple(tree: Tree, dx: number): void {
		// Knocking a bear out of its tree is a bad idea.
		const { bear } = tree;
		if (bear && treeBoundStates.has(bear.state)) {
			this.caught(bear);
		}

		const side = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
		const direction = this._v
			.set(side * (0.8 + Math.abs(dx)) + this._lateral * 0.08, 0, -1.4)
			.normalize();
		tree.state = 'falling';
		tree.axis.crossVectors(this._up, direction).normalize();
		tree.angularVelocity = MathUtils.randFloat(2.5, 4.5);
		tree.velocity
			.copy(direction)
			.multiplyScalar(this._speed * 0.45 + 3)
			.setY(MathUtils.randFloat(3, 7));

		if (this._time - this._lastHit < 1.5) {
			this._combo++;
		} else {
			this._combo = 1;
		}
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
				MathUtils.randFloatSpread(6) - this._speed * 0.3,
			);
			d.spin.set(
				MathUtils.randFloatSpread(14),
				MathUtils.randFloatSpread(14),
				MathUtils.randFloatSpread(14),
			);
		}
	}

	private updateTrees(dt: number): void {
		const playerZ = this._character.root.position.z;
		for (const tree of this._trees) {
			const p = tree.mesh.position;
			if (p.z > playerZ + 25) {
				this.placeTree(tree, p.z - treeWindow);
				continue;
			}
			// Once a tree is in the way it fades out and stays hidden until it's
			// recycled, so it can't flicker in and out as the camera sways.
			if (
				tree.state === 'standing' &&
				!tree.isFading &&
				this.blocksView(p.x, p.z)
			) {
				tree.isFading = true;
				tree.mesh.castShadow = false;
				tree.material.transparent = true;
				tree.material.needsUpdate = true;
			}
			if (tree.isFading && tree.mesh.visible) {
				tree.opacity = Math.max(
					0,
					tree.opacity - dt / treeFadeDuration,
				);
				tree.material.opacity = tree.opacity;
				tree.mesh.visible = tree.opacity > 0;
			}
			if (tree.state !== 'falling') {
				continue;
			}
			// Topple over while being flung down the slope.
			tree.angle = Math.min(
				Math.PI / 2 - 0.05,
				tree.angle + tree.angularVelocity * dt,
			);
			tree.angularVelocity += 7 * dt;
			tree.velocity.y -= 22 * dt;
			p.addScaledVector(tree.velocity, dt);
			const ground = terrainHeight(p.x, p.z) - 0.15;
			if (p.y < ground) {
				p.y = ground;
				tree.velocity.y = 0;
				tree.velocity.multiplyScalar(Math.exp(-4 * dt));
			}
			this._q.setFromAxisAngle(tree.axis, tree.angle);
			this._q2.setFromAxisAngle(this._up, tree.yaw);
			tree.mesh.quaternion.multiplyQuaternions(this._q, this._q2);
		}
	}

	/**
	 * Whether a tree at (x, z) would sit between the chase camera and me.
	 * Only trees I've already passed count, never ones I'm about to hit.
	 * @param x - Tree position across the slope.
	 * @param z - Tree position down the slope.
	 * @returns True if the tree would block the view.
	 */
	private blocksView(x: number, z: number): boolean {
		if (!this._rolling) {
			return false;
		}
		const player = this._character.root.position;
		const { x: offsetX, z: offsetZ } = this._chaseOffset;
		const lengthSq = offsetX * offsetX + offsetZ * offsetZ;
		// How far along the player→camera segment the tree is, in the slope
		// plane: 0 at me, 1 at the camera.
		const t =
			((x - player.x) * offsetX + (z - player.z) * offsetZ) / lengthSq;
		// Leave anything within 1.5m of me (or ahead of me) alone.
		if (t < 1.5 / Math.sqrt(lengthSq) || t > 1.2) {
			return false;
		}
		const dx = x - (player.x + offsetX * t);
		const dz = z - (player.z + offsetZ * t);
		return dx * dx + dz * dz < 2.5 * 2.5;
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
		const player = this._character.root.position;

		// Always have the next one planned well ahead of the trees.
		const last = this._easterEggs.at(-1);
		if (!last || last.z > player.z - treeWindow - 60) {
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
			if (!placed.instance && placed.z > player.z - treeWindow) {
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
		const root = this._character.root.position;
		object.updateMatrixWorld();
		// My position in the easter egg's own space.
		const local = object.worldToLocal(
			this._slope.localToWorld(this._v.copy(root)),
		);
		instance.update?.({ time: this._time, dt, player: local });

		// Barrel straight through anything solid.
		const { footprint } = placed.egg;
		if (!footprint || !this._rolling || this._caughtAt !== undefined) {
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
					outwards.z - this._speed * 0.4,
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
				MathUtils.randFloatSpread(14) - this._speed * 0.3,
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
		const reach = placed.egg.clearingRadius + blastReach;
		let count = 0;
		for (const bear of this._bears) {
			const p = bear.rig.root.position;
			const dx = p.x - placed.x;
			const dz = p.z - placed.z;
			const distance = Math.hypot(dx, dz);
			if (
				bear.state === 'free' ||
				bear.state === 'blasted' ||
				bear.state === 'mauling' ||
				distance > reach
			) {
				continue;
			}
			count++;
			if (bear.tree) {
				bear.tree.bear = undefined;
			}
			bear.tree = undefined;
			bear.state = 'blasted';
			bear.timer = 0;
			bear.rig.alert.visible = false;
			// Harder the closer it was.
			const force = MathUtils.mapLinear(distance, 0, reach, 16, 8);
			bear.velocity.set(
				(dx / (distance || 1)) * force,
				MathUtils.randFloat(9, 14),
				(dz / (distance || 1)) * force - this._speed * 0.3,
			);
			bear.spin.set(
				MathUtils.randFloatSpread(12),
				MathUtils.randFloatSpread(6),
				MathUtils.randFloatSpread(12),
			);
		}
		if (count === 0) {
			return;
		}
		const points = bearBlastPoints * count * count;
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

	private updateBears(dt: number): void {
		const player = this._character.root.position;
		for (const bear of this._bears) {
			if (bear.state === 'free') {
				continue;
			}
			const p = bear.rig.root.position;
			if (bear.state !== 'mauling' && p.z > player.z + 30) {
				this.releaseBear(bear);
				continue;
			}
			bear.timer += dt;
			this.updateBear(bear, dt);
		}
	}

	private updateBear(bear: BearActor, dt: number): void {
		switch (bear.state) {
			case 'clinging': {
				this.updateClinging(bear);
				break;
			}
			case 'alert': {
				bear.rig.alert.position.y =
					1.4 + Math.abs(Math.sin(bear.timer * 12)) * 0.15;
				if (bear.timer > 0.35) {
					bear.state = 'climbing';
				}
				break;
			}
			case 'climbing': {
				this.updateClimbing(bear, dt);
				break;
			}
			case 'dismounting': {
				this.updateDismounting(bear, dt);
				break;
			}
			case 'charging':
			case 'leaving': {
				this.updateCharging(bear, dt);
				break;
			}
			case 'mauling': {
				this.updateMauling(bear, dt);
				break;
			}
			case 'blasted': {
				this.updateBlasted(bear, dt);
				break;
			}
		}
	}

	private updateBlasted(bear: BearActor, dt: number): void {
		const { rig, velocity, spin } = bear;
		if (velocity.lengthSq() === 0) {
			return;
		}
		const p = rig.root.position;
		// Tumble through the air...
		velocity.y -= 22 * dt;
		p.addScaledVector(velocity, dt);
		rig.root.rotation.x += spin.x * dt;
		rig.root.rotation.y += spin.y * dt;
		rig.root.rotation.z += spin.z * dt;
		for (const [i, leg] of rig.legs.entries()) {
			leg.rotation.x = Math.sin(bear.timer * 20 + i) * 0.9;
		}
		const ground = terrainHeight(p.x, p.z);
		if (p.y > ground + 0.6 || velocity.y > 0) {
			return;
		}
		// ...then land, out cold on its side.
		velocity.set(0, 0, 0);
		p.y = ground + 0.6;
		rig.root.rotation.set(
			0,
			rig.root.rotation.y,
			Math.sign(spin.z || 1) * (Math.PI / 2),
		);
		rig.pose.rotation.set(0, 0, 0);
		for (const leg of rig.legs) {
			leg.rotation.set(0.4, 0, 0);
		}
	}

	private updateClinging(bear: BearActor): void {
		const { rig } = bear;
		const player = this._character.root.position;
		rig.pose.rotation.z = Math.sin(this._time * 1.3 + bear.gait) * 0.06;
		const ahead = player.z - rig.root.position.z;
		// Spot me early enough to be on the ground as I arrive.
		if (!(
			this._rolling &&
			this._caughtAt === undefined &&
			ahead > -2 &&
			ahead < this._speed * 2.6 + 8
		)) {
			return;
		}

		bear.state = 'alert';
		bear.timer = 0;
		rig.alert.visible = true;
		rig.head.rotation.set(0.5, 0, 0);
		rig.pose.rotation.z = 0;
	}

	private updateClimbing(bear: BearActor, dt: number): void {
		const { rig } = bear;
		const p = rig.root.position;
		bear.height = Math.max(0.95, bear.height - bearClimbSpeed * dt);
		bear.gait += dt * 14;
		for (const [i, leg] of rig.legs.entries()) {
			leg.rotation.x =
				Math.sin(bear.gait + (i % 3 === 0 ? 0 : Math.PI)) * 0.5;
		}
		p.y = terrainHeight(p.x, p.z) + bear.height;
		if (!(bear.height <= 0.95)) {
			return;
		}

		bear.state = 'dismounting';
		bear.timer = 0;
	}

	private updateDismounting(bear: BearActor, dt: number): void {
		const { rig, tree } = bear;
		const p = rig.root.position;
		const k = smooth(0, 0.3, bear.timer);
		rig.pose.rotation.x = MathUtils.lerp(-Math.PI / 2, 0, k);
		p.z += dt * 2;
		p.y =
			terrainHeight(p.x, p.z) +
			MathUtils.lerp(0.95, BEAR_STANDING_HEIGHT, k);
		this.turnBearTowardsMe(bear, dt, 10);
		if (k < 1) {
			return;
		}
		// Off the tree and after me.
		if (tree) {
			tree.bear = undefined;
		}
		bear.tree = undefined;
		bear.state = 'charging';
		rig.alert.visible = false;
		rig.head.rotation.set(0, 0, 0);
		for (const leg of rig.legs) {
			leg.rotation.set(0, 0, 0);
		}
	}

	private updateCharging(bear: BearActor, dt: number): void {
		const { rig } = bear;
		const p = rig.root.position;
		const player = this._character.root.position;
		if (bear.state === 'charging') {
			if (p.z > player.z + 3 || this._caughtAt !== undefined) {
				// Missed me (or someone else got me): wander off sideways.
				bear.state = 'leaving';
				bear.heading = (Math.sign(p.x - player.x) || 1) * (Math.PI / 2);
				rig.root.rotation.y = bear.heading;
			} else {
				this.turnBearTowardsMe(bear, dt, 3.5);
			}
		}
		const speed = Math.min(11, 8 + this._distance / 250);
		p.x += Math.sin(bear.heading) * speed * dt;
		p.z += Math.cos(bear.heading) * speed * dt;

		// Gallop.
		bear.gait += dt * speed * 1.5;
		const [frontLeft, frontRight, backLeft, backRight] = rig.legs;
		const swing = Math.sin(bear.gait) * 0.8;
		frontLeft.rotation.set(swing, 0, 0);
		frontRight.rotation.set(Math.sin(bear.gait + 0.4) * 0.8, 0, 0);
		backLeft.rotation.set(-swing, 0, 0);
		backRight.rotation.set(-Math.sin(bear.gait + 0.4) * 0.8, 0, 0);
		rig.pose.rotation.x = Math.sin(bear.gait * 2) * 0.06;
		p.y =
			terrainHeight(p.x, p.z) +
			BEAR_STANDING_HEIGHT +
			Math.abs(Math.sin(bear.gait)) * 0.1;

		if (
			bear.state === 'charging' &&
			Math.hypot(p.x - player.x, p.z - player.z) < bearCatchRadius
		) {
			this.caught(bear);
		}
	}

	private updateMauling(bear: BearActor, dt: number): void {
		const { rig } = bear;
		const p = rig.root.position;
		const player = this._character.root.position;
		// Stand over me, up on hind legs, waving.
		p.x = MathUtils.lerp(p.x, player.x + bear.offset.x, damp(8, dt));
		p.z = MathUtils.lerp(p.z, player.z + bear.offset.z, damp(8, dt));
		const rear = smooth(0.2, 0.7, bear.timer);
		p.y = terrainHeight(p.x, p.z) + BEAR_STANDING_HEIGHT + rear * 0.45;
		rig.pose.rotation.x = -1.05 * rear;
		rig.head.rotation.x = 0.6 * rear;
		const wave = Math.sin(bear.timer * 9) * 0.5;
		const [frontLeft, frontRight, backLeft, backRight] = rig.legs;
		frontLeft.rotation.set(-1.3 * rear + wave, 0, 0.3 * rear);
		frontRight.rotation.set(-1.3 * rear - wave, 0, -0.3 * rear);
		backLeft.rotation.set(1 * rear, 0, 0);
		backRight.rotation.set(1 * rear, 0, 0);
		this.turnBearTowardsMe(bear, dt, 6);
	}

	private turnBearTowardsMe(bear: BearActor, dt: number, rate: number): void {
		const p = bear.rig.root.position;
		const player = this._character.root.position;
		const target = Math.atan2(player.x - p.x, player.z - p.z);
		// Shortest way round.
		const delta = MathUtils.euclideanModulo(
			target - bear.heading + Math.PI,
			Math.PI * 2,
		);
		bear.heading += (delta - Math.PI) * damp(rate, dt);
		bear.rig.root.rotation.y = bear.heading;
	}

	private caught(bear: BearActor): void {
		if (this._caughtAt !== undefined) {
			return;
		}
		this._caughtAt = this._time;
		const player = this._character.root.position;
		const p = bear.rig.root.position;
		if (bear.tree) {
			bear.tree.bear = undefined;
		}
		bear.tree = undefined;
		bear.state = 'mauling';
		bear.timer = 0;
		bear.rig.alert.visible = false;
		bear.rig.pose.rotation.set(0, 0, 0);
		// Stand on the far side of me from the camera, so we're both in shot.
		bear.offset
			.set(-this._chaseOffset.x, 0, -this._chaseOffset.z)
			.normalize()
			.multiplyScalar(1.7);
		bear.heading = Math.atan2(player.x - p.x, player.z - p.z);
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

	private updateGround(): void {
		const playerZ = this._character.root.position.z;
		for (const chunk of this._ground.slice(1)) {
			if (chunk.position.z - CHUNK_LENGTH / 2 > playerZ + 30) {
				shapeGroundChunk(chunk, chunk.position.z - CHUNK_LENGTH * 3);
			}
		}
	}

	private updateCamera(dt: number): void {
		const player = this._character.root.position;

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

		const swing = smooth(starEnd, cameraSwingEnd, this._time);
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

		// Distant peaks stay on the horizon.
		this._mountains.position.copy(this._camera.position);

		// The sun (and its shadow) follow me down the mountain.
		const focus = this._slope.localToWorld(this._v.copy(player));
		this._sun.target.position.copy(focus);
		this._sun.position.copy(focus).add(this._v2.set(20, 40, 15));
	}

	public start(): void {
		// Compile the see-through tree shader up front, so the first tree to
		// fade out doesn't stutter.
		const [tree] = this._trees;
		tree.material.transparent = true;
		tree.material.needsUpdate = true;
		this._renderer.compile(this._scene, this._camera);
		tree.material.transparent = false;
		tree.material.needsUpdate = true;

		this._last = performance.now();
		this._renderer.setAnimationLoop((now: number) => {
			this.frame(now);
		});
	}

	public dispose(): void {
		this._renderer.setAnimationLoop(null);
		this._resizeObserver.disconnect();
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
		disposeBearParts(this._bearParts);
		this._renderer.dispose();
		this._renderer.domElement.remove();
	}
}
