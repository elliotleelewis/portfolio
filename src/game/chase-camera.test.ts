import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { CAMERA_SWING_END, ChaseCamera } from './chase-camera';

const dt = 1 / 60;

/**
 * A chase camera on a flat slope, fitted to a stage.
 * @param width - Stage width.
 * @param height - Stage height.
 * @param isShakeless - Whether to keep it steady.
 * @returns The camera.
 */
const setUp = (width = 1600, height = 900, isShakeless = false) => {
	const camera = new ChaseCamera(new Group(), isShakeless);
	camera.resize(width, height);
	return camera;
};

describe('ChaseCamera', () => {
	it('opens framed on my face, looking straight at me', () => {
		const chase = setUp();
		chase.update(dt, 1, new Vector3(), false);
		const { position } = chase.camera;
		expect(position.x).toBe(0);
		expect(position.y).toBeGreaterThan(1.5);
		expect(position.z).toBeGreaterThan(0);
		expect(chase.camera.fov).toBe(38);
	});

	it('swings round to chase me once the intro is over', () => {
		const chase = setUp();
		const player = new Vector3(3, 0, -40);
		// Once round, it eases in behind me.
		for (let i = 0; i < 120; i++) {
			chase.update(dt, CAMERA_SWING_END + 1, player, false);
		}
		expect(chase.camera.fov).toBe(48);
		expect(
			chase.camera.position.distanceTo(player.clone().add(chase.offset)),
		).toBeLessThan(0.01);
	});

	it('sits further behind me on portrait screens', () => {
		const landscape = setUp(1600, 900);
		const portrait = setUp(400, 900);
		expect(portrait.offset.z).toBeGreaterThan(landscape.offset.z);
		expect(Math.abs(portrait.offset.x)).toBeLessThan(landscape.offset.x);
	});

	it('moves in closer once I am caught', () => {
		const chase = setUp();
		const player = new Vector3();
		let time = CAMERA_SWING_END + 1;
		for (let i = 0; i < 240; i++) {
			time += dt;
			chase.update(dt, time, player, true);
		}
		const distance = chase.camera.position.distanceTo(player);
		expect(distance).toBeLessThan(chase.offset.length() * 0.85);
	});

	it('shakes, up to a limit, then settles', () => {
		const chase = setUp();
		chase.shake(0.18, 0.35);
		chase.shake(0.18, 0.35);
		chase.shake(0.18, 0.35);
		expect(chase.shakiness).toBe(0.35);
		for (let i = 0; i < 60; i++) {
			chase.update(dt, CAMERA_SWING_END + 1, new Vector3(), false);
		}
		expect(chase.shakiness).toBe(0);
	});

	it('stays steady for reduced motion', () => {
		const chase = setUp(1600, 900, true);
		chase.shake(0.6);
		expect(chase.shakiness).toBe(0);
	});

	it('chases from the other side when mirrored, for right-to-left pages', () => {
		const chase = setUp();
		const mirrored = new ChaseCamera(new Group(), false, -1);
		mirrored.resize(1600, 900);
		expect(mirrored.offset.x).toBeCloseTo(-chase.offset.x);
		expect(mirrored.offset.z).toBeCloseTo(chase.offset.z);

		const player = new Vector3(3, 0, -40);
		for (let i = 0; i < 120; i++) {
			mirrored.update(dt, CAMERA_SWING_END + 1, player, false);
		}
		expect(mirrored.camera.position.x).toBeLessThan(player.x);
	});
});
