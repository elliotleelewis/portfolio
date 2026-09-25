import { Group, PerspectiveCamera, Scene, Vector3 } from 'three';

import { damp } from './easing';
import {
	ALL_EASTER_EGGS,
	type EasterEgg,
	type EasterEggInstance,
	type EasterEggShowcase,
	disposeObject,
} from './easter-eggs';
import { MYSTERY_SHOWCASE, createMystery } from './mystery';
import { type StageScene } from './stage-scene';
import { SYSTEM_ORDER, Systems } from './systems';

export interface GalleryCallbacks {
	// The camera is heading to a new easter egg (or one I've not found yet).
	onSelect: (index: number, caption: string, isLocked: boolean) => void;
}

interface Station {
	egg: EasterEgg;
	// How many times I've smashed it.
	hits: number;
	// Not found yet, so hidden behind a mystery.
	isLocked: boolean;
	instance: EasterEggInstance;
	position: Vector3;
	// When the camera arrived, so the easter egg can replay from the start.
	arrivedAt: number;
}

// Distance between easter eggs along the row.
export const GALLERY_SPACING = 18;
const fov = 40;
// How far off an easter egg "thinks" I am when it isn't being looked at, so
// it waits for me rather than playing out its moment.
const faraway = new Vector3(0, 0, 500);
// When the camera arrives, I "approach" from this far off, at this speed,
// to set off anything that happens as I roll up.
const approachFrom = 70;
const approachSpeed = 35;

/**
 * A clearing with every easter egg lined up in a row, and a camera that
 * glides from one to the next. The sky, light, ground and trees around them
 * are components (see ./components/gallery-world.tsx).
 */
export class Gallery implements StageScene {
	private readonly _callbacks: GalleryCallbacks;
	private readonly _scene = new Scene();
	private readonly _camera = new PerspectiveCamera(fov, 1, 0.05, 1200);
	private readonly _stations: Station[];

	private readonly _cameraTarget = new Vector3();
	private readonly _lookTarget = new Vector3();
	private readonly _look = new Vector3();
	private readonly _v = new Vector3();
	private readonly _drift = new Vector3();

	private _index = 0;
	private _zoom = 1;
	private _time = 0;

	// Everything that moves on each step, in order.
	public readonly systems = new Systems();
	// The easter eggs, in their row.
	public readonly easterEggs = new Group();

	/**
	 * @param callbacks - What to tell the hero as the gallery moves.
	 * @param hits - How many times I've smashed each easter egg, by id. Any
	 * I've not smashed yet stay hidden.
	 */
	public constructor(
		callbacks: GalleryCallbacks,
		hits: Readonly<Record<string, number>>,
	) {
		this._callbacks = callbacks;
		this._scene.add(this.easterEggs);

		this._stations = ALL_EASTER_EGGS.map((egg, i) => {
			const position = new Vector3(i * GALLERY_SPACING, 0, 0);
			const count = hits[egg.id] ?? 0;
			const isLocked = count <= 0;
			return {
				egg,
				hits: count,
				isLocked,
				instance: this.place(egg, isLocked, position),
				position,
				arrivedAt: 0,
			};
		});

		// Start at the first one I've found, with no fly-in.
		this.select(
			Math.max(
				0,
				this._stations.findIndex((s) => !s.isLocked),
			),
		);
		this._camera.position
			.subVectors(this._cameraTarget, this._lookTarget)
			.multiplyScalar(this._zoom)
			.add(this._lookTarget);
		this._look.copy(this._lookTarget);

		this.systems.add(SYSTEM_ORDER.camera, (dt) => {
			this.glide(dt);
		});
		// After the camera, since each easter egg watches where it is.
		this.systems.add(SYSTEM_ORDER.follow, (dt) => {
			this.updateStations(dt);
		});
	}

	private place(
		egg: EasterEgg,
		isLocked: boolean,
		position: Vector3,
	): EasterEggInstance {
		const instance = isLocked ? createMystery() : egg.create();
		instance.object.position.copy(position);
		this.easterEggs.add(instance.object);
		return instance;
	}

	/**
	 * Glides the camera to the current easter egg, with a gentle drift once
	 * it's there.
	 * @param dt - Seconds since the last step.
	 */
	private glide(dt: number): void {
		const rate = damp(3, dt);
		const drift = this._v
			.subVectors(this._cameraTarget, this._lookTarget)
			.multiplyScalar(this._zoom)
			.add(this._lookTarget)
			.add(
				this._drift.set(
					Math.sin(this._time * 0.35) * 0.35,
					Math.sin(this._time * 0.5) * 0.1,
					0,
				),
			);
		this._camera.position.lerp(drift, rate);
		this._look.lerp(this._lookTarget, rate);
		this._camera.lookAt(this._look);
	}

	private updateStations(dt: number): void {
		for (const [i, station] of this._stations.entries()) {
			const { object, update } = station.instance;
			if (!update) {
				continue;
			}
			let player = faraway;
			if (i === this._index) {
				// "Roll up" to it, ending where the camera is.
				object.updateMatrixWorld();
				player = object.worldToLocal(
					this._v.copy(this._camera.position),
				);
				const since = this._time - station.arrivedAt;
				player.z += Math.max(0, approachFrom - since * approachSpeed);
			}
			update({ time: this._time, dt, player });
		}
	}

	public get count(): number {
		return this._stations.length;
	}

	public get index(): number {
		return this._index;
	}

	// How many times I've smashed each easter egg, in gallery order. Those
	// on 0 are still hidden.
	public get hits(): readonly number[] {
		return this._stations.map(({ hits }) => hits);
	}

	// Where the camera is looking, in world space.
	public get focus(): Readonly<Vector3> {
		return this._look;
	}

	public next(): void {
		this.select((this._index + 1) % this._stations.length);
	}

	public previous(): void {
		this.select(
			(this._index - 1 + this._stations.length) % this._stations.length,
		);
	}

	public select(index: number): void {
		const count = this._stations.length;
		this._index = ((index % count) + count) % count;
		const station = this._stations[this._index];
		// Start its moment over, fresh.
		station.instance.object.removeFromParent();
		disposeObject(station.instance.object);
		station.instance = this.place(
			station.egg,
			station.isLocked,
			station.position,
		);
		station.arrivedAt = this._time;

		const showcase: EasterEggShowcase = station.isLocked
			? MYSTERY_SHOWCASE
			: station.egg.gallery;
		const { camera, target } = showcase;
		this._cameraTarget.fromArray(camera).add(station.position);
		this._lookTarget.fromArray(target).add(station.position);
		// Aim a little low, so the easter egg sits above the caption panel.
		this._lookTarget.y -=
			this._cameraTarget.distanceTo(this._lookTarget) * 0.14;
		this._callbacks.onSelect(
			this._index,
			showcase.caption,
			station.isLocked,
		);
	}

	public get scene(): Scene {
		return this._scene;
	}

	public get camera(): PerspectiveCamera {
		return this._camera;
	}

	/**
	 * Fits the camera to the stage's size.
	 * @param width - Stage width, in CSS pixels.
	 * @param height - Stage height, in CSS pixels.
	 */
	public resize(width: number, height: number): void {
		if (width === 0 || height === 0) {
			return;
		}
		this._camera.aspect = width / height;
		// Portrait screens get a slightly wider view, with the camera pulled
		// back, to fit the same easter egg in.
		const isPortrait = this._camera.aspect < 1;
		this._camera.fov = isPortrait ? fov / this._camera.aspect ** 0.25 : fov;
		this._zoom = isPortrait ? this._camera.aspect ** -0.4 : 1;
		this._camera.updateProjectionMatrix();
	}

	/**
	 * Moves the camera and the easter eggs on.
	 * @param dt - Seconds since the last step.
	 */
	public step(dt: number): void {
		this._time += dt;
		this.systems.run(dt);
	}

	public dispose(): void {
		// The world's components free theirs.
		disposeObject(this.easterEggs);
	}
}
