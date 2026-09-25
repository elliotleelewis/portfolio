import {
	Group,
	type Material,
	MathUtils,
	Mesh,
	type PerspectiveCamera,
	Sprite,
	Vector3,
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
import { damp } from './easing';
import { disposeObject } from './easter-eggs';
import { type Tree } from './forest';
import { type Player } from './player';
import { pinToScreenEdge } from './view';
import { terrainHeight } from './world';

// Bears in the pool to start with, sent up trees as they're placed. More join
// as they're needed, further down the mountain, up to a limit.
const initialBearCount = 8;
export const MAX_BEARS = 24;
const climbSpeed = 3.4;
// How close a charging bear has to get to catch me.
const catchRadius = 1.35;
// How far behind me a bear goes before it gives up.
const giveUpDistance = 30;
// How long a bear in the camera's way takes to fade out, in seconds.
const fadeDuration = 0.3;
// A pinned "!": its size (as a fraction of the view's height, roughly), how
// far in from the edge of the view it sits, and how far from the camera.
const pinSize = 0.07;
const pinInset = 0.1;
const pinDistance = 2;

export type BearState =
	| 'free'
	| 'clinging'
	| 'alert'
	| 'climbing'
	| 'dismounting'
	| 'charging'
	| 'leaving'
	| 'mauling'
	| 'blasted';

// States in which a bear is still up (or on) its tree.
const treeBoundStates = new Set<BearState>(['clinging', 'alert', 'climbing']);

export interface BearActor {
	rig: Bear;
	state: BearState;
	tree: Tree<BearActor> | undefined;
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
	// Its own copies of the bear materials, so it can fade out on its own.
	materials: Material[];
	// Fading out of the camera's way, and how opaque it still is.
	isFading: boolean;
	opacity: number;
	// Its "!" pinned to the edge of the view, when the bear is out of shot.
	pin: Sprite;
}

export interface BearsHooks {
	// Whether a bear has already got me.
	isCaught: () => boolean;
	// A charging bear has reached me.
	onCatch: (bear: BearActor) => void;
	// Whether something at (x, z) is in the camera's way.
	isInTheWay: (x: number, z: number) => boolean;
}

/**
 * The black bears: up trees until I come near, then down and after me. A
 * smashed easter egg sends them flying.
 */
export class Bears {
	private readonly _player: Player;
	private readonly _hooks: BearsHooks;
	private readonly _parts: BearParts = createBearParts();
	private readonly _actors: BearActor[] = [];
	private readonly _point = new Vector3();
	private readonly _eye = new Vector3();

	// The bears, in the slope's space.
	public readonly group = new Group();
	// Their "!"s pinned to the edge of the view, in world space.
	public readonly pins = new Group();

	public constructor(player: Player, hooks: BearsHooks) {
		this._player = player;
		this._hooks = hooks;
		for (let i = 0; i < initialBearCount; i++) {
			this.add();
		}
	}

	/**
	 * Adds a bear to the pool.
	 * @returns The new bear, free to go up a tree.
	 */
	private add(): BearActor {
		const { fur, muzzle, nose, glint } = this._parts;
		const own = {
			fur: fur.clone(),
			muzzle: muzzle.clone(),
			nose: nose.clone(),
			glint: glint.clone(),
		};
		const rig = createBear({ ...this._parts, ...own });
		rig.root.visible = false;
		this.group.add(rig.root);
		const pin = new Sprite(this._parts.pin);
		pin.scale.setScalar(pinSize);
		pin.visible = false;
		pin.renderOrder = 10;
		this.pins.add(pin);
		const bear: BearActor = {
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
			materials: Object.values(own),
			isFading: false,
			opacity: 1,
			pin,
		};
		this._actors.push(bear);
		return bear;
	}

	/**
	 * A free bear from the pool, adding one if they're all busy.
	 * @returns The bear, or undefined if the pool is full and all are busy.
	 */
	private spare(): BearActor | undefined {
		const bear = this._actors.find(({ state }) => state === 'free');
		return bear || this._actors.length >= MAX_BEARS ? bear : this.add();
	}

	private updateBear(bear: BearActor, dt: number, time: number): void {
		switch (bear.state) {
			case 'clinging': {
				this.updateClinging(bear, time);
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
			case 'free': {
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

	private updateClinging(bear: BearActor, time: number): void {
		const { rig } = bear;
		const player = this._player.position;
		rig.pose.rotation.z = Math.sin(time * 1.3 + bear.gait) * 0.06;
		const ahead = player.z - rig.root.position.z;
		// Spot me early enough to be on the ground as I arrive.
		if (!(
			this._player.isRolling &&
			!this._hooks.isCaught() &&
			ahead > -2 &&
			ahead < this._player.speed * 2.6 + 8
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
		bear.height = Math.max(0.95, bear.height - climbSpeed * dt);
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
		const k = MathUtils.smootherstep(bear.timer, 0, 0.3);
		rig.pose.rotation.x = MathUtils.lerp(-Math.PI / 2, 0, k);
		p.z += dt * 2;
		p.y =
			terrainHeight(p.x, p.z) +
			MathUtils.lerp(0.95, BEAR_STANDING_HEIGHT, k);
		this.turnTowardsMe(bear, dt, 10);
		if (k < 1) {
			return;
		}
		// Off the tree and after me.
		if (tree) {
			tree.occupant = undefined;
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
		const player = this._player.position;
		if (bear.state === 'charging') {
			if (p.z > player.z + 3 || this._hooks.isCaught()) {
				// Missed me (or someone else got me): carry on past, fading out
				// if it gets in the camera's way.
				bear.state = 'leaving';
			} else {
				this.turnTowardsMe(bear, dt, 3.5);
			}
		}
		const speed = Math.min(11, 8 + this._player.distance / 250);
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
			Math.hypot(p.x - player.x, p.z - player.z) < catchRadius
		) {
			this._hooks.onCatch(bear);
		}
	}

	private updateMauling(bear: BearActor, dt: number): void {
		const { rig } = bear;
		const p = rig.root.position;
		const player = this._player.position;
		// Stand over me, up on hind legs, waving.
		p.x = MathUtils.lerp(p.x, player.x + bear.offset.x, damp(8, dt));
		p.z = MathUtils.lerp(p.z, player.z + bear.offset.z, damp(8, dt));
		const rear = MathUtils.smootherstep(bear.timer, 0.2, 0.7);
		p.y = terrainHeight(p.x, p.z) + BEAR_STANDING_HEIGHT + rear * 0.45;
		rig.pose.rotation.x = -1.05 * rear;
		rig.head.rotation.x = 0.6 * rear;
		const wave = Math.sin(bear.timer * 9) * 0.5;
		const [frontLeft, frontRight, backLeft, backRight] = rig.legs;
		frontLeft.rotation.set(-1.3 * rear + wave, 0, 0.3 * rear);
		frontRight.rotation.set(-1.3 * rear - wave, 0, -0.3 * rear);
		backLeft.rotation.set(1 * rear, 0, 0);
		backRight.rotation.set(1 * rear, 0, 0);
		this.turnTowardsMe(bear, dt, 6);
	}

	private turnTowardsMe(bear: BearActor, dt: number, rate: number): void {
		const p = bear.rig.root.position;
		const player = this._player.position;
		const target = Math.atan2(player.x - p.x, player.z - p.z);
		// Shortest way round.
		const delta = MathUtils.euclideanModulo(
			target - bear.heading + Math.PI,
			Math.PI * 2,
		);
		bear.heading += (delta - Math.PI) * damp(rate, dt);
		bear.rig.root.rotation.y = bear.heading;
	}

	private leaveTree(bear: BearActor): void {
		if (bear.tree) {
			bear.tree.occupant = undefined;
		}
		bear.tree = undefined;
	}

	/**
	 * Fades a bear that's left me out of the camera's way, like the trees.
	 * @param bear - The bear.
	 * @param dt - Seconds since the last step.
	 */
	private fade(bear: BearActor, dt: number): void {
		const p = bear.rig.root.position;
		if (!bear.isFading) {
			if (bear.state !== 'leaving' || !this._hooks.isInTheWay(p.x, p.z)) {
				return;
			}
			bear.isFading = true;
			this.setShadows(bear, false);
			for (const material of bear.materials) {
				material.transparent = true;
				material.needsUpdate = true;
			}
		}
		bear.opacity = Math.max(0, bear.opacity - dt / fadeDuration);
		for (const material of bear.materials) {
			material.opacity = bear.opacity;
		}
		if (bear.opacity === 0) {
			this.release(bear);
		}
	}

	/**
	 * Brings a faded bear back to solid, for its next outing.
	 * @param bear - The bear.
	 */
	private unfade(bear: BearActor): void {
		if (!bear.isFading) {
			return;
		}
		bear.isFading = false;
		bear.opacity = 1;
		this.setShadows(bear, true);
		for (const material of bear.materials) {
			material.opacity = 1;
			material.transparent = false;
			material.needsUpdate = true;
		}
	}

	private setShadows(bear: BearActor, isCasting: boolean): void {
		bear.rig.root.traverse((child) => {
			if (child instanceof Mesh) {
				child.castShadow = isCasting;
			}
		});
	}

	/**
	 * Pins the "!" of any bear coming down its tree out of shot to the edge
	 * of the view, in its direction, so I know it's there.
	 * @param camera - The camera, once it has moved for this step.
	 */
	public pinAlerts(camera: PerspectiveCamera): void {
		camera.updateMatrixWorld();
		const inset = { x: pinInset / camera.aspect, y: pinInset };
		for (const { rig, pin } of this._actors) {
			pin.visible = false;
			if (!rig.root.visible || !rig.alert.visible) {
				continue;
			}
			rig.alert.updateWorldMatrix(true, false);
			const point = rig.alert.getWorldPosition(this._point);
			const isBehind =
				this._eye.copy(point).applyMatrix4(camera.matrixWorldInverse)
					.z > 0;
			point.project(camera);
			const spot = pinToScreenEdge(point.x, point.y, isBehind, inset);
			if (!spot.isOffScreen) {
				continue;
			}
			// Along the ray through that spot, just in front of the camera.
			pin.position
				.set(spot.x, spot.y, 0.5)
				.unproject(camera)
				.sub(camera.position)
				.setLength(pinDistance)
				.add(camera.position);
			pin.visible = true;
		}
	}

	// Every bear in the pool, busy or not.
	public get actors(): readonly BearActor[] {
		return this._actors;
	}

	/**
	 * Sends a free bear up a tree, clinging to the uphill side of the trunk.
	 * @param tree - The tree to climb.
	 * @returns The bear, or undefined if the pool is full and all are busy.
	 */
	public climb(tree: Tree<BearActor>): BearActor | undefined {
		const bear = this.spare();
		if (!bear) {
			return undefined;
		}
		const { rig } = bear;
		const scale = tree.mesh.scale.x;
		bear.state = 'clinging';
		bear.tree = tree;
		bear.timer = 0;
		bear.height = MathUtils.randFloat(2.6, 3.8) * scale;
		bear.heading = Math.PI;
		tree.occupant = bear;
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
		return bear;
	}

	/**
	 * Sends a bear back to the pool.
	 * @param bear - The bear.
	 */
	public release(bear: BearActor): void {
		this.leaveTree(bear);
		bear.state = 'free';
		bear.rig.root.visible = false;
		this.unfade(bear);
	}

	/**
	 * Whether a bear is still up (or on) its tree, so knocking the tree down
	 * would bring it down on me.
	 * @param bear - The bear.
	 * @returns True while it's up the tree.
	 */
	public isTreeBound(bear: BearActor): boolean {
		return treeBoundStates.has(bear.state);
	}

	/**
	 * Has a bear stand over me, up on its hind legs, once it's caught me.
	 * @param bear - The bear.
	 * @param awayFromCamera - Which way (across the ground) is away from the
	 * camera, so we're both in shot.
	 */
	public maul(bear: BearActor, awayFromCamera: Vector3): void {
		const player = this._player.position;
		const p = bear.rig.root.position;
		this.leaveTree(bear);
		bear.state = 'mauling';
		bear.timer = 0;
		bear.rig.alert.visible = false;
		bear.rig.pose.rotation.set(0, 0, 0);
		bear.offset
			.copy(awayFromCamera)
			.setY(0)
			.normalize()
			.multiplyScalar(1.7);
		bear.heading = Math.atan2(player.x - p.x, player.z - p.z);
	}

	/**
	 * Sends the bears near a blast flying.
	 * @param centre - Where the blast was, across the slope (x) and down it (z).
	 * @param centre.x - Across the slope.
	 * @param centre.z - Down the slope.
	 * @param reach - How far it reaches.
	 * @returns How many bears it caught.
	 */
	public blast(centre: { x: number; z: number }, reach: number): number {
		let count = 0;
		for (const bear of this._actors) {
			const p = bear.rig.root.position;
			const dx = p.x - centre.x;
			const dz = p.z - centre.z;
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
			this.leaveTree(bear);
			bear.state = 'blasted';
			bear.timer = 0;
			bear.rig.alert.visible = false;
			// Harder the closer it was.
			const force = MathUtils.mapLinear(distance, 0, reach, 16, 8);
			bear.velocity.set(
				(dx / (distance || 1)) * force,
				MathUtils.randFloat(9, 14),
				(dz / (distance || 1)) * force - this._player.speed * 0.3,
			);
			bear.spin.set(
				MathUtils.randFloatSpread(12),
				MathUtils.randFloatSpread(6),
				MathUtils.randFloatSpread(12),
			);
		}
		return count;
	}

	/**
	 * Puts a bear right next to me (for tests that need a bear to catch me).
	 * @returns The bear.
	 */
	public spawnBesideMe(): BearActor {
		const bear = this.spare() ?? this._actors[0];
		const p = this._player.position;
		bear.rig.root.visible = true;
		bear.rig.root.position.set(
			p.x,
			terrainHeight(p.x, p.z) + BEAR_STANDING_HEIGHT,
			p.z - 2,
		);
		return bear;
	}

	/**
	 * Moves the bears on.
	 * @param dt - Seconds since the last step.
	 * @param time - Seconds since the game began.
	 */
	public update(dt: number, time: number): void {
		const player = this._player.position;
		for (const bear of this._actors) {
			if (bear.state === 'free') {
				continue;
			}
			const p = bear.rig.root.position;
			if (bear.state !== 'mauling' && p.z > player.z + giveUpDistance) {
				this.release(bear);
				continue;
			}
			bear.timer += dt;
			this.updateBear(bear, dt, time);
			this.fade(bear, dt);
		}
	}

	public dispose(): void {
		disposeObject(this.group);
		disposeBearParts(this._parts);
	}
}
