import {
	type BufferGeometry,
	type Camera,
	Group,
	MathUtils,
	Mesh,
	MeshLambertMaterial,
	Quaternion,
	type Scene,
	Vector3,
	type WebGLRenderer,
} from 'three';

import { LANE_HALF_WIDTH, createTreeGeometry, terrainHeight } from './world';

// Trees in the pool, recycled from behind me to ahead of me.
const treeCount = 170;
// How far ahead of me the trees reach.
export const TREE_WINDOW = 230;
// How far behind me a tree goes before it's recycled.
const recycleDistance = 25;
// How long a tree in the camera's way takes to fade out, in seconds.
const fadeDuration = 0.3;

export interface Tree<Occupant> {
	mesh: Mesh;
	// Its own copy, so it can fade out on its own.
	material: MeshLambertMaterial;
	// Fading out of the way of the camera, and how opaque it still is.
	isFading: boolean;
	opacity: number;
	// Whoever is up the tree (a bear), if anyone.
	occupant: Occupant | undefined;
	state: 'standing' | 'falling';
	yaw: number;
	axis: Vector3;
	angle: number;
	angularVelocity: number;
	velocity: Vector3;
	hitRadius: number;
}

/**
 * How the forest asks the rest of the game about where trees can go.
 */
export interface ForestHooks<Occupant> {
	// Whether (x, z) is in an easter egg's clearing, which trees keep out of.
	isInClearing: (x: number, z: number) => boolean;
	// Whether a tree at (x, z) would block the camera's view of me.
	isBlockingView: (x: number, z: number) => boolean;
	// A tree has just been stood up somewhere new.
	onPlace: (tree: Tree<Occupant>, isInLane: boolean) => void;
}

/**
 * The trees down the mountainside: where they stand, how they fade out of
 * the camera's way, and how they topple when I roll into them.
 */
export class Forest<Occupant> {
	private readonly _hooks: ForestHooks<Occupant>;
	private readonly _geometries: BufferGeometry[];
	private readonly _materials: MeshLambertMaterial[];
	private readonly _up = new Vector3(0, 1, 0);
	private readonly _q = new Quaternion();
	private readonly _q2 = new Quaternion();

	// The trees down the slope, in the slope's space.
	public readonly group = new Group();
	// A few trees framing the opening shot, on the flat ledge.
	public readonly framing = new Group();
	public readonly trees: readonly Tree<Occupant>[];

	public constructor(hooks: ForestHooks<Occupant>) {
		this._hooks = hooks;
		this._geometries = [
			createTreeGeometry(6, 8, 1.5),
			createTreeGeometry(5, 6.5, 1.7),
			createTreeGeometry(8, 11, 1.4),
		];
		this._materials = ['#ffffff', '#dfe8d4', '#c9d6c2'].map(
			(color) =>
				new MeshLambertMaterial({
					color,
					vertexColors: true,
					flatShading: true,
				}),
		);

		this.trees = Array.from({ length: treeCount }, (_value, i) => {
			const material =
				this._materials[i % this._materials.length].clone();
			const mesh = new Mesh(
				this._geometries[i % this._geometries.length],
				material,
			);
			mesh.castShadow = true;
			this.group.add(mesh);
			return {
				mesh,
				material,
				isFading: false,
				opacity: 1,
				occupant: undefined,
				state: 'standing',
				yaw: 0,
				axis: new Vector3(),
				angle: 0,
				angularVelocity: 0,
				velocity: new Vector3(),
				hitRadius: 1,
			};
		});

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
				this._geometries[index % this._geometries.length],
				this._materials[index % this._materials.length],
			);
			mesh.position.set(x, terrainHeight(x, z) - 0.1, z);
			mesh.scale.setScalar(scale);
			mesh.rotation.y = index;
			mesh.castShadow = true;
			this.framing.add(mesh);
		}
	}

	/**
	 * Stands a tree back up at a random spot around `z`.
	 * @param tree - The tree to place.
	 * @param z - Where along the slope to place it.
	 * @param isInitial - Whether this is the first placement.
	 */
	private place(tree: Tree<Occupant>, z: number, isInitial = false): void {
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
		for (let i = 0; i < 6 && this._hooks.isInClearing(x, z); i++) {
			x = pickX();
		}
		if (this._hooks.isInClearing(x, z)) {
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
		this._hooks.onPlace(tree, isInLane);
	}

	/**
	 * Stands every tree up for the start of a run.
	 */
	public plant(): void {
		for (const tree of this.trees) {
			this.place(tree, 20 - Math.random() * TREE_WINDOW, true);
		}
	}

	/**
	 * Compiles the see-through tree shader up front, so the first tree to
	 * fade out doesn't stutter.
	 * @param renderer - The renderer that will draw the trees.
	 * @param scene - The scene they're in.
	 * @param camera - The camera looking at them.
	 */
	public prepare(
		renderer: WebGLRenderer,
		scene: Scene,
		camera: Camera,
	): void {
		const [tree] = this.trees;
		tree.material.transparent = true;
		tree.material.needsUpdate = true;
		renderer.compile(scene, camera);
		tree.material.transparent = false;
		tree.material.needsUpdate = true;
	}

	/**
	 * The standing trees I'm rolling into.
	 * @param player - Where I am, in the slope's space.
	 * @returns The trees I've hit.
	 */
	public hits(player: Vector3): Tree<Occupant>[] {
		return this.trees.filter(({ state, mesh, hitRadius }) => {
			if (state !== 'standing') {
				return false;
			}
			const dx = mesh.position.x - player.x;
			const dz = mesh.position.z - player.z;
			return Math.abs(dz) < 1 && Math.abs(dx) < hitRadius;
		});
	}

	/**
	 * Sends a tree toppling over and flying down the slope.
	 * @param tree - The tree.
	 * @param direction - Which way it goes, along the ground.
	 * @param speed - How fast I hit it.
	 */
	public fell(tree: Tree<Occupant>, direction: Vector3, speed: number): void {
		tree.state = 'falling';
		tree.axis.crossVectors(this._up, direction).normalize();
		tree.angularVelocity = MathUtils.randFloat(2.5, 4.5);
		tree.velocity
			.copy(direction)
			.multiplyScalar(speed * 0.45 + 3)
			.setY(MathUtils.randFloat(3, 7));
	}

	/**
	 * Moves the trees on: recycling ones I've passed, fading ones in the
	 * camera's way, and toppling the ones I've hit.
	 * @param dt - Seconds since the last step.
	 * @param playerZ - How far down the slope I am.
	 */
	public update(dt: number, playerZ: number): void {
		for (const tree of this.trees) {
			const p = tree.mesh.position;
			if (p.z > playerZ + recycleDistance) {
				this.place(tree, p.z - TREE_WINDOW);
				continue;
			}
			// Once a tree is in the way it fades out and stays hidden until it's
			// recycled, so it can't flicker in and out as the camera sways.
			if (
				tree.state === 'standing' &&
				!tree.isFading &&
				this._hooks.isBlockingView(p.x, p.z)
			) {
				tree.isFading = true;
				tree.mesh.castShadow = false;
				tree.material.transparent = true;
				tree.material.needsUpdate = true;
			}
			if (tree.isFading && tree.mesh.visible) {
				tree.opacity = Math.max(0, tree.opacity - dt / fadeDuration);
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

	public dispose(): void {
		for (const geometry of this._geometries) {
			geometry.dispose();
		}
		for (const material of this._materials) {
			material.dispose();
		}
		for (const { material } of this.trees) {
			material.dispose();
		}
	}
}
