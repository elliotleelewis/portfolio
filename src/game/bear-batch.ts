import {
	type BufferGeometry,
	Group,
	InstancedMesh,
	type Material,
	Matrix4,
	type Object3D,
} from 'three';

import type { Bear, BearParts } from './bear';

// One part of a bear, drawn for every bear at once: which geometry and
// material, and the joint (or joints) it sits on in each bear.
interface Batch {
	mesh: InstancedMesh;
	joints: (rig: Bear) => readonly Object3D[];
}

/**
 * Draws every bear in one go: each part of a bear (body, head, snout, nose,
 * eyes and legs) is one instanced mesh, with an instance for each bear,
 * placed by that bear's joints. So more bears cost no more draw calls.
 */
export class BearBatch {
	private readonly _batches: Batch[];
	private readonly _pose = new Matrix4();
	private readonly _joint = new Matrix4();

	// The batches, in the bears' space.
	public readonly group = new Group();

	/**
	 * @param parts - The bears' shared geometry and materials.
	 * @param capacity - The most bears there will ever be.
	 */
	public constructor(parts: BearParts, capacity: number) {
		const { geometries, fur, muzzle, nose, glint } = parts;
		const batch = (
			geometry: BufferGeometry,
			material: Material,
			joints: (rig: Bear) => readonly Object3D[],
			perBear = 1,
		): Batch => {
			const mesh = new InstancedMesh(
				geometry,
				material,
				capacity * perBear,
			);
			mesh.castShadow = true;
			// The bears are all over the slope, so the batch is never culled as
			// a whole.
			mesh.frustumCulled = false;
			mesh.count = 0;
			mesh.visible = false;
			this.group.add(mesh);
			return { mesh, joints };
		};
		this._batches = [
			batch(geometries.body, fur, (rig) => [rig.pose]),
			batch(geometries.head, fur, (rig) => [rig.head]),
			batch(geometries.snout, muzzle, (rig) => [rig.head]),
			batch(geometries.nose, nose, (rig) => [rig.head]),
			batch(geometries.glints, glint, (rig) => [rig.head]),
			batch(geometries.leg, fur, (rig) => rig.legs, 4),
		];
	}

	/**
	 * Draws these bears, where their joints are now.
	 * @param rigs - The bears to draw.
	 */
	public draw(rigs: Iterable<Bear>): void {
		for (const { mesh } of this._batches) {
			mesh.count = 0;
		}
		for (const rig of rigs) {
			rig.root.updateMatrix();
			rig.pose.updateMatrix();
			this._pose.multiplyMatrices(rig.root.matrix, rig.pose.matrix);
			for (const { mesh, joints } of this._batches) {
				for (const joint of joints(rig)) {
					if (joint === rig.pose) {
						mesh.setMatrixAt(mesh.count, this._pose);
					} else {
						joint.updateMatrix();
						mesh.setMatrixAt(
							mesh.count,
							this._joint.multiplyMatrices(
								this._pose,
								joint.matrix,
							),
						);
					}
					mesh.count++;
				}
			}
		}
		for (const { mesh } of this._batches) {
			mesh.visible = mesh.count > 0;
			mesh.instanceMatrix.needsUpdate = true;
		}
	}

	public dispose(): void {
		for (const { mesh } of this._batches) {
			mesh.dispose();
		}
	}
}
