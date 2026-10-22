import {
	BufferGeometry,
	type Camera,
	Group,
	MathUtils,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	type Scene,
	Vector3,
	type WebGLRenderer,
} from 'three';

import { withBudget } from './draw-budget';
import {
	EASTER_EGGS,
	type EasterEgg,
	type MergedEasterEgg,
	type Shattered,
	disposeObject,
	mergeParts,
} from './easter-eggs';
import { TREE_WINDOW } from './forest';
import type { Player } from './player';
import { LANE_HALF_WIDTH, terrainHeight } from './world';

// Roughly how far apart the easter eggs are, in metres.
export const EASTER_EGG_SPACING = 150;
// How far behind me an easter egg goes before it's cleared away.
const clearDistance = 40;
// How close I have to come to something solid to smash it.
const smashReach = 0.9;

export interface PlacedEasterEgg {
	egg: EasterEgg;
	x: number;
	z: number;
	yaw: number;
	// Created once it's close enough to matter, with its parts merged
	// to take fewer draw calls.
	instance: MergedEasterEgg | undefined;
	// Whether I've barrelled through it.
	isSmashed: boolean;
}

export interface EasterEggTrailHooks {
	// Whether rolling into something solid would smash it right now.
	canSmash: () => boolean;
	// I've rolled into an easter egg. Its pieces are still in place.
	onSmash: (placed: PlacedEasterEgg, shattered: Shattered) => void;
}

/**
 * Frees an object's geometry and textures, keeping its materials (and so
 * their shaders).
 * @param object - The object.
 */
const freeAllButMaterials = (object: Object3D): void => {
	object.traverse((child) => {
		if (!(child instanceof Mesh)) {
			return;
		}
		const geometry: unknown = child.geometry;
		const material: unknown = child.material;
		if (geometry instanceof BufferGeometry) {
			geometry.dispose();
		}
		if (material instanceof MeshStandardMaterial) {
			material.map?.dispose();
		}
	});
};

/**
 * The easter eggs down the mountain: where each goes (in its own clearing),
 * bringing them to life as I near them, and noticing when I roll into one.
 */
export class EasterEggTrail {
	private readonly _player: Player;
	private readonly _hooks: EasterEggTrailHooks;
	private readonly _eggs: PlacedEasterEgg[] = [];
	private readonly _local = new Vector3();
	private readonly _inverse = new Matrix4();
	private _count = 0;
	// A copy of each easter egg, merged and shattered, drawn up front to keep
	// its shaders.
	private readonly _merged: MergedEasterEgg[] = [];
	private readonly _shattered: Shattered[] = [];

	// The easter eggs, in the slope's space.
	public readonly group = new Group();

	public constructor(player: Player, hooks: EasterEggTrailHooks) {
		this._player = player;
		this._hooks = hooks;
		// Plan the first one straight away, so the trees can leave it a
		// clearing.
		this.plan(-EASTER_EGG_SPACING + MathUtils.randFloatSpread(40));
	}

	/**
	 * Picks the next easter egg and where it goes.
	 * @param z - Roughly where down the slope to put it.
	 */
	private plan(z: number): void {
		if (EASTER_EGGS.length === 0) {
			return;
		}
		const egg = EASTER_EGGS[this._count % EASTER_EGGS.length];
		this._count++;
		// Towards the middle of the slope, where the camera will catch it.
		const margin = LANE_HALF_WIDTH - 10;
		this._eggs.push({
			egg,
			x: MathUtils.randFloatSpread(margin * 2),
			z,
			yaw: MathUtils.randFloatSpread(0.6),
			instance: undefined,
			isSmashed: false,
		});
	}

	private updateEgg(
		placed: PlacedEasterEgg,
		instance: MergedEasterEgg,
		dt: number,
		time: number,
	): void {
		if (placed.isSmashed) {
			return;
		}
		// My position in the easter egg's own space.
		const { object } = instance;
		object.updateMatrix();
		const local = this._local
			.copy(this._player.position)
			.applyMatrix4(this._inverse.copy(object.matrix).invert());
		instance.update?.({ time, dt, player: local });

		// Barrel straight through anything solid.
		const { footprint } = placed.egg;
		if (
			!footprint ||
			!this._hooks.canSmash() ||
			Math.abs(local.x) > footprint.halfWidth + smashReach ||
			Math.abs(local.z) > footprint.halfDepth + smashReach
		) {
			return;
		}
		placed.isSmashed = true;
		// In pieces, each free to fly off on its own.
		const shattered = instance.shatter();
		object.removeFromParent();
		this._hooks.onSmash(placed, shattered);
	}

	// The easter eggs planned so far, nearest first.
	public get eggs(): readonly PlacedEasterEgg[] {
		return this._eggs;
	}

	/**
	 * Whether a spot is in (or within `margin` of) an easter egg's clearing.
	 * @param x - Across the slope.
	 * @param z - Down the slope.
	 * @param margin - How far past the clearing's edge still counts.
	 * @returns True if it's in or near a clearing.
	 */
	public isInClearing(x: number, z: number, margin = 0): boolean {
		return this._eggs.some(
			(placed) =>
				(x - placed.x) ** 2 + (z - placed.z) ** 2 <
				(placed.egg.clearingRadius + margin) ** 2,
		);
	}

	/**
	 * Keeps the trail going: plans easter eggs ahead of the trees, brings
	 * near ones to life, clears away ones I've passed, and moves them on.
	 * @param dt - Seconds since the last step.
	 * @param time - Seconds since the game began.
	 */
	public update(dt: number, time: number): void {
		const player = this._player.position;

		// Always have the next one planned well ahead of the trees.
		const last = this._eggs.at(-1);
		if (!last || last.z > player.z - TREE_WINDOW - 60) {
			this.plan(
				(last?.z ?? player.z) -
					EASTER_EGG_SPACING +
					MathUtils.randFloatSpread(60),
			);
		}

		// Clear away the ones well behind me.
		const behind = this._eggs.filter(
			({ z }) => z > player.z + clearDistance,
		);
		for (const placed of behind) {
			if (placed.instance) {
				placed.instance.unmerge();
				placed.instance.object.removeFromParent();
				disposeObject(placed.instance.object);
			}
			this._eggs.splice(this._eggs.indexOf(placed), 1);
		}

		for (const placed of this._eggs) {
			if (!placed.instance && placed.z > player.z - TREE_WINDOW) {
				placed.instance = mergeParts(
					placed.egg.create(),
					placed.egg.clearingRadius,
				);
				const { object } = placed.instance;
				withBudget(object, 'easter egg');
				object.position.set(
					placed.x,
					terrainHeight(placed.x, placed.z) - 0.05,
					placed.z,
				);
				object.rotation.y = placed.yaw;
				this.group.add(object);
			}
			if (!placed.instance) {
				continue;
			}
			this.updateEgg(placed, placed.instance, dt, time);
		}
	}

	/**
	 * Gets every easter egg's shaders ready up front, so none stutters the
	 * run when it's built, far down the slope, or smashed: merged, shattered,
	 * and in the sun's shadows. The copies' materials are kept until the
	 * run's over, as three.js deletes a shader once nothing uses it, but
	 * nothing else of them.
	 * @param renderer - The renderer that will draw them.
	 * @param scene - The scene they'll be in, for its lights and haze.
	 * @param camera - The camera looking at them.
	 */
	public prepare(
		renderer: WebGLRenderer,
		scene: Scene,
		camera: Camera,
	): void {
		// A copy of each merged, and one smashed to pieces.
		for (const egg of EASTER_EGGS) {
			const instance = egg.create();
			renderer.compile(instance.object, camera, scene);
			this._merged.push(mergeParts(instance, egg.clearingRadius));
			const smashed = mergeParts(egg.create());
			this.group.add(smashed.object);
			this._shattered.push(smashed.shatter());
			smashed.object.removeFromParent();
		}
		// Shadows have shaders of their own, which only drawing builds. So draw
		// the copies once, wherever they are; the first frame is drawn over
		// it before it's seen.
		const copies = [
			...this._merged.map(({ object }) => object),
			...this._shattered.map(({ object }) => object),
		];
		const unculled: Object3D[] = [];
		for (const object of copies) {
			this.group.add(object);
			object.traverse((child) => {
				if (!child.frustumCulled) {
					return;
				}

				child.frustumCulled = false;
				unculled.push(child);
			});
		}
		renderer.render(scene, camera);
		for (const child of unculled) {
			child.frustumCulled = true;
		}
		for (const object of copies) {
			object.removeFromParent();
			freeAllButMaterials(object);
		}
	}

	public dispose(): void {
		const instances = [
			...this._eggs.flatMap(({ instance }) =>
				instance ? [instance] : [],
			),
			...this._merged,
		];
		for (const instance of instances) {
			instance.unmerge();
			disposeObject(instance.object);
		}
		for (const shattered of this._shattered) {
			shattered.dispose();
		}
	}
}
