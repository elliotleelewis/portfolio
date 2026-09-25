import {
	Color,
	Group,
	InstancedMesh,
	MathUtils,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	type Object3D,
	Quaternion,
	SphereGeometry,
	TetrahedronGeometry,
	Vector3,
} from 'three';

import { disposeObject } from './easter-eggs';
import { terrainHeight } from './world';

// Bits of needle, bark and dirt, reused round-robin.
const debrisCount = 320;
// How long a smash's fireball and smoke last, in seconds.
const blastDuration = 0.7;

interface Debris {
	position: Vector3;
	velocity: Vector3;
	spin: Vector3;
	rotation: Vector3;
	life: number;
}

// A piece of something smashed, flying off.
interface Shard {
	mesh: Mesh;
	velocity: Vector3;
	spin: Vector3;
	scale: Vector3;
	life: number;
}

// The fireball and smoke from a smash.
interface Blast {
	fire: Mesh<SphereGeometry, MeshBasicMaterial>;
	smoke: Mesh<SphereGeometry, MeshBasicMaterial>;
	age: number;
}

/**
 * How a burst of debris flies: each bit gets its own random spread within
 * these ranges.
 */
export interface Burst {
	// Where it bursts from.
	origin: Vector3;
	count: number;
	// Random height above the origin to start at: [min, max].
	lift: [number, number];
	// How widely the sideways (x) and along-the-slope (z) speeds vary, in
	// total (half each way).
	spread: { x: number; z: number };
	// Random upward speed: [min, max].
	upward: [number, number];
	// Speed added to every bit, e.g. carried on from how fast I was going.
	drift: { x: number; z: number };
}

/**
 * The flying bits: needles and bark from toppled trees, the pieces of a
 * smashed easter egg, and the smash's fireball.
 */
export class Effects {
	private readonly _debris: Debris[] = [];
	private readonly _debrisMesh: InstancedMesh;
	private readonly _shards: Shard[] = [];
	private readonly _blast: Blast;
	private readonly _v = new Vector3();
	private readonly _v2 = new Vector3();
	private readonly _q = new Quaternion();
	private readonly _m = new Matrix4();
	private _debrisCursor = 0;

	// Everything flying about, in the slope's space.
	public readonly group = new Group();

	public constructor() {
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
		this.group.add(this._debrisMesh);

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
		this.group.add(this._blast.smoke, this._blast.fire);
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

	// How many shards are still flying.
	public get shardCount(): number {
		return this._shards.length;
	}

	// Whether the fireball is still going.
	public get isExploding(): boolean {
		return this._blast.age < blastDuration;
	}

	/**
	 * Sends a spray of debris flying.
	 * @param burst - Where from, how many, and how they fly.
	 */
	public burst(burst: Burst): void {
		const { origin, count, lift, spread, upward, drift } = burst;
		for (let i = 0; i < count; i++) {
			const d = this._debris[this._debrisCursor];
			this._debrisCursor = (this._debrisCursor + 1) % debrisCount;
			d.life = MathUtils.randFloat(0.8, 1.6);
			d.position
				.copy(origin)
				.add(this._v2.set(0, MathUtils.randFloat(...lift), 0));
			d.velocity.set(
				MathUtils.randFloatSpread(spread.x) + drift.x,
				MathUtils.randFloat(...upward),
				MathUtils.randFloatSpread(spread.z) + drift.z,
			);
			d.spin.set(
				MathUtils.randFloatSpread(14),
				MathUtils.randFloatSpread(14),
				MathUtils.randFloatSpread(14),
			);
		}
	}

	/**
	 * Breaks something into its pieces and flings them outwards, keeping
	 * where each was.
	 * @param object - What to break apart.
	 * @param centre - Where it breaks from, in the slope's space.
	 * @param speed - How fast I hit it, which carries the pieces on.
	 */
	public shatter(object: Object3D, centre: Vector3, speed: number): void {
		const meshes: Mesh[] = [];
		object.traverse((child) => {
			if (child instanceof Mesh) {
				meshes.push(child as Mesh);
			}
		});
		for (const mesh of meshes) {
			this.group.attach(mesh);
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
					outwards.z - speed * 0.4,
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
	}

	/**
	 * A quick fireball and puff of smoke.
	 * @param centre - Where, in the slope's space.
	 */
	public explode(centre: Vector3): void {
		const { fire, smoke } = this._blast;
		fire.position.copy(centre);
		smoke.position.copy(centre);
		this._blast.age = 0;
	}

	/**
	 * Moves everything flying on.
	 * @param dt - Seconds since the last step.
	 */
	public update(dt: number): void {
		this.updateDebris(dt);
		this.updateShards(dt);
		this.updateBlast(dt);
	}

	public dispose(): void {
		disposeObject(this.group);
		this._debrisMesh.dispose();
	}
}
