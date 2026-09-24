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
	MeshLambertMaterial,
	PCFShadowMap,
	PerspectiveCamera,
	Quaternion,
	Scene,
	TetrahedronGeometry,
	Vector3,
	WebGLRenderer,
} from 'three';

import { type Character, createCharacter } from './character';
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
	onDistance: (metres: number) => void;
}

export interface GameInput {
	left: boolean;
	right: boolean;
	faster: boolean;
	slower: boolean;
}

interface Tree {
	mesh: Mesh;
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
const contactOffset = 0.05;

// Intro timeline, in seconds.
const lookStart = 1.5;
const starStart = 5;
const starEnd = 5.8;
const turnEnd = 6.5;
const cameraSwingEnd = 8;

const fov = 38;

// Where my face sits in the hero photo, as fractions of the image.
const photoAspect = 1717 / 2576;
const photoObjectPositionY = 0.55;
const photoFaceY = 0.535;
const photoHeadHeight = 0.2;

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
	};

	public constructor(host: HTMLElement, callbacks: GameCallbacks) {
		this._host = host;
		this._callbacks = callbacks;
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
			const mesh = new Mesh(
				geometries[i % geometries.length],
				materials[i % materials.length],
			);
			mesh.castShadow = true;
			const tree: Tree = {
				mesh,
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
		let x = isInLane
			? MathUtils.randFloatSpread(LANE_HALF_WIDTH * 2)
			: Math.sign(Math.random() - 0.5) *
				MathUtils.randFloat(LANE_HALF_WIDTH, 70);
		// Keep the first stretch clear so the roll gets going.
		if (isInitial && z > -14 && Math.abs(x) < 4) {
			x += Math.sign(x || 1) * 5;
		}
		const scale = MathUtils.randFloat(0.75, 1.25);
		tree.state = 'standing';
		tree.mesh.visible = true;
		tree.yaw = Math.random() * Math.PI * 2;
		tree.angle = 0;
		tree.angularVelocity = 0;
		tree.velocity.set(0, 0, 0);
		tree.hitRadius = 1 + scale * 0.35;
		tree.mesh.scale.setScalar(scale);
		tree.mesh.position.set(x, terrainHeight(x, z) - 0.15, z);
		tree.mesh.quaternion.setFromAxisAngle(this._up, tree.yaw);
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
		this.updateDebris(dt);
		this.updateGround();
		this.updateCamera(dt);

		this._renderer.render(this._scene, this._camera);

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
			this.roll(dt);
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
		c.roller.position.y = contactOffset - lowest;
	}

	private roll(dt: number): void {
		const c = this._character;
		const { left, right, faster, slower } = this.input;

		let target = MathUtils.clamp(10 + this._distance / 40, 10, 28);
		if (faster) {
			target *= 1.35;
		}
		if (slower) {
			target *= 0.55;
		}
		this._speed = MathUtils.lerp(this._speed, target, damp(0.8, dt));

		const steer = Number(right) - Number(left);
		const maxLateral = 7 + this._speed * 0.3;
		this._lateral = MathUtils.lerp(
			this._lateral,
			steer * maxLateral,
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
			tree.mesh.visible =
				tree.state === 'falling' || !this.blocksView(p.x, p.z);
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
		// Closest point on the camera→player segment, in the slope plane.
		const t = MathUtils.clamp(
			((x - player.x) * offsetX + (z - player.z) * offsetZ) /
				(offsetX * offsetX + offsetZ * offsetZ),
			0,
			1.2,
		);
		const dx = x - (player.x + offsetX * t);
		const dz = z - (player.z + offsetZ * t);
		return dx * dx + dz * dz < 2.5 * 2.5 && z > player.z - 1.5;
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

		// Where the chase camera wants to be, in world space.
		const chase = this._slope.localToWorld(
			this._v.copy(player).add(this._chaseOffset),
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
		this._renderer.dispose();
		this._renderer.domElement.remove();
	}
}
