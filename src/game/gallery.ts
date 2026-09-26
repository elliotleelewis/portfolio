import { Group, MathUtils, PerspectiveCamera, Scene, Vector3 } from 'three';

import { type Mirror, type ReadingDirection, mirrorFor } from './direction';
import { damp } from './easing';
import {
	ALL_EASTER_EGGS,
	type EasterEgg,
	type EasterEggInstance,
	type EasterEggShowcase,
	disposeObject,
} from './easter-eggs';
import { fadeIntoHaze } from './haze';
import { MYSTERY_SHOWCASE, createMystery } from './mystery';
import type { StageScene } from './stage-scene';
import { dragOffset, swipeStep } from './swipe';
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
	// How the camera shows it: where it sits and looks, and the caption.
	shot: Shot;
	// When the camera arrived, so the easter egg can replay from the start.
	arrivedAt: number;
}

interface Shot {
	camera: Vector3;
	look: Vector3;
	caption: string;
}

// Distance between easter eggs along the row.
export const GALLERY_SPACING = 18;
const fov = 40;
// How far off an easter egg "thinks" I am when it isn't being looked at, so
// it waits for me rather than playing out its moment.
const faraway = new Vector3(0, 0, 500);
// How quickly the camera catches up: gently after a button press, snappily
// once a swipe lets go, and all but at once while a finger is dragging.
const glideRate = 3;
// How far a finger drags, as a share of the stage's width, to pull the
// camera along to the next easter egg.
const swipeWidth = 0.6;
const snapRate = 7;
const dragRate = 25;
// When the camera arrives, I "approach" from this far off, at this speed,
// to set off anything that happens as I roll up.
const approachFrom = 70;
const approachSpeed = 35;

// How much of a drag at either end moves the camera at the finger's pace,
// with the rest spent crossing the gap between easter eggs.
const followShare = 0.4;

/**
 * A curve from 0 to 1 with a given slope at each end.
 * @param t - How far along, from 0 to 1.
 * @param slope - How steep it is at either end.
 * @returns How far along the curve is.
 */
const hermite = (t: number, slope: number): number =>
	(t ** 3 - 2 * t ** 2 + t) * slope +
	(-2 * t ** 3 + 3 * t ** 2) +
	(t ** 3 - t ** 2) * slope;

/**
 * How far the camera has come towards the next easter egg for how far a
 * drag has gone. At either end it keeps pace with the finger, so what's on
 * screen stays under it; in the middle it hurries across the gap.
 * @param t - How far the drag has gone, from 0 to 1.
 * @param pace - How far the camera moves for each easter egg dragged, to
 * keep up with the finger.
 * @returns How far the camera has come, from 0 to 1.
 */
const follow = (t: number, pace: number): number => {
	if (t <= followShare) {
		return t * pace;
	}
	if (t >= 1 - followShare) {
		return 1 - (1 - t) * pace;
	}
	const from = followShare * pace;
	const gap = 1 - 2 * from;
	const middle = 1 - 2 * followShare;
	return (
		from + gap * hermite((t - followShare) / middle, (pace * middle) / gap)
	);
};

/**
 * Where the camera shows an easter egg from, in world space.
 * @param showcase - How the easter egg is shown, in its own space.
 * @param position - Where it stands.
 * @returns The camera's shot of it.
 */
const shotOf = (showcase: EasterEggShowcase, position: Vector3): Shot => {
	const camera = new Vector3().fromArray(showcase.camera).add(position);
	const look = new Vector3().fromArray(showcase.target).add(position);
	// Aim a little low, so the easter egg sits above the caption panel.
	look.y -= camera.distanceTo(look) * 0.14;
	return { camera, look, caption: showcase.caption };
};

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
	// How far a drag has pulled the camera along the row, in easter eggs.
	private _offset = 0;
	private _isDragging = false;
	// Which easter egg's caption is showing, which a drag can change.
	private _shown = 0;
	private _rate = glideRate;
	private _zoom = 1;
	private _time = 0;

	// Everything that moves on each step, in order.
	public readonly systems = new Systems();
	// The easter eggs, in their row.
	public readonly easterEggs = new Group();
	// Whether the row runs right to left, for a right-to-left page.
	public readonly mirror: Mirror;

	/**
	 * @param callbacks - What to tell the hero as the gallery moves.
	 * @param hits - How many times I've smashed each easter egg, by id. Any
	 * I've not smashed yet stay hidden.
	 * @param direction - Which way the page reads, which way the row runs.
	 */
	public constructor(
		callbacks: GalleryCallbacks,
		hits: Readonly<Record<string, number>>,
		direction: ReadingDirection = 'ltr',
	) {
		this._callbacks = callbacks;
		// Before anything is drawn, so every material picks it up.
		fadeIntoHaze();
		this.mirror = mirrorFor(direction);
		this._scene.add(this.easterEggs);

		this._stations = ALL_EASTER_EGGS.map((egg, i) => {
			// Running the way the page reads, so the next is always ahead.
			const position = new Vector3(
				i * GALLERY_SPACING * this.mirror,
				0,
				0,
			);
			const count = hits[egg.id] ?? 0;
			const isLocked = count <= 0;
			return {
				egg,
				hits: count,
				isLocked,
				instance: this.place(egg, isLocked, position),
				position,
				shot: shotOf(
					isLocked ? MYSTERY_SHOWCASE : egg.gallery,
					position,
				),
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
	 * Where the camera is heading: the current easter egg's shot, or part of
	 * the way to a neighbour's while a drag pulls it along.
	 */
	private aim(): void {
		const { shot } = this._stations[this._index];
		this._cameraTarget.copy(shot.camera);
		this._lookTarget.copy(shot.look);
		// Blend towards whichever neighbour the drag is pulling to...
		const toward = MathUtils.clamp(
			this._offset,
			this._index > 0 ? -1 : 0,
			this._index < this._stations.length - 1 ? 1 : 0,
		);
		// The easter eggs are much further apart than the view is wide, so
		// the camera sets off (and arrives) at the pace that keeps what's on
		// screen under the finger, and hurries across the gap in between.
		const pace = this.followPace();
		if (toward !== 0) {
			const next = this._stations[this._index + Math.sign(toward)].shot;
			const amount = follow(Math.abs(toward), pace);
			this._cameraTarget.lerp(next.camera, amount);
			this._lookTarget.lerp(next.look, amount);
		}
		// ...and slide on along the row, at that pace, for any stretch past
		// it.
		const stretch =
			(this._offset - toward) * GALLERY_SPACING * pace * this.mirror;
		this._cameraTarget.x += stretch;
		this._lookTarget.x += stretch;
	}

	/**
	 * How fast the camera has to move along the row, as a share of the way
	 * to the next easter egg for each easter egg dragged, to keep what's on
	 * screen under the finger.
	 * @returns The pace, from 0 to 1.
	 */
	private followPace(): number {
		const { shot } = this._stations[this._index];
		const distance = shot.camera.distanceTo(shot.look) * this._zoom;
		const halfFov = MathUtils.degToRad(this._camera.fov / 2);
		const viewWidth =
			2 * distance * Math.tan(halfFov) * this._camera.aspect;
		return Math.min(1, (swipeWidth * viewWidth) / GALLERY_SPACING);
	}

	/**
	 * Tells the hero which easter egg's caption to show.
	 * @param index - Which easter egg.
	 */
	private show(index: number): void {
		this._shown = index;
		const { shot, isLocked } = this._stations[index];
		this._callbacks.onSelect(index, shot.caption, isLocked);
	}

	/**
	 * Glides the camera to the current easter egg, with a gentle drift once
	 * it's there.
	 * @param dt - Seconds since the last step.
	 */
	private glide(dt: number): void {
		this.aim();
		const rate = damp(this._isDragging ? dragRate : this._rate, dt);
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
		this._offset = 0;
		this._isDragging = false;
		this._rate = glideRate;
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
		this.aim();
		this.show(this._index);
	}

	/**
	 * Pulls the camera along the row with a finger, one easter egg at most
	 * either way, showing the caption of whichever it's nearer.
	 * @param across - How far the finger has moved towards the next easter
	 * egg, as a share of the stage's width.
	 */
	public drag(across: number): void {
		const hasPrevious = this._index > 0;
		const hasNext = this._index < this._stations.length - 1;
		this._isDragging = true;
		this._offset = dragOffset(across / swipeWidth, hasPrevious, hasNext);
		const nearest =
			this._index +
			Math.round(
				MathUtils.clamp(
					this._offset,
					hasPrevious ? -1 : 0,
					hasNext ? 1 : 0,
				),
			);
		if (nearest !== this._shown) {
			this.show(nearest);
		}
	}

	/**
	 * Lets go of a drag: on to the next or previous easter egg if it went far
	 * or fast enough, otherwise back where it started.
	 * @param velocity - How fast the finger was moving towards the next
	 * easter egg, in stage widths a second.
	 */
	public release(velocity: number): void {
		if (!this._isDragging) {
			return;
		}
		const step = swipeStep(this._offset, velocity / swipeWidth);
		const target = this._index + step;
		if (step !== 0 && target >= 0 && target < this._stations.length) {
			this.select(target);
		} else {
			this._offset = 0;
			this._isDragging = false;
			if (this._shown !== this._index) {
				this.show(this._index);
			}
		}
		this._rate = snapRate;
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
