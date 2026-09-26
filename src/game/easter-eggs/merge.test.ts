// Some easter eggs paint their textures on a canvas, so these need a DOM.
// @vitest-environment happy-dom
import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	Group,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	Vector3,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMystery } from '../mystery';

import { mergeStill } from './merge';
import type { EasterEggInstance } from './types';

import { ALL_EASTER_EGGS } from '.';

const meshes = (object: Object3D): Object3D[] => {
	const found: Object3D[] = [];
	object.traverse((child) => {
		if (child instanceof Mesh) {
			found.push(child);
		}
	});
	return found;
};

/**
 * Makes Math.random repeat the same numbers from each call, so two copies of
 * an easter egg are built (and move) the same.
 */
const seedRandom = (): void => {
	let seed = 42;
	vi.spyOn(Math, 'random').mockImplementation(() => {
		seed = (seed * 16_807) % 2_147_483_647;
		return (seed - 1) / 2_147_483_646;
	});
};

/**
 * Plays an easter egg as I roll up to it and past, long enough for its
 * moment to play out.
 * @param instance - The easter egg.
 */
const approach = (instance: EasterEggInstance): void => {
	const dt = 1 / 30;
	for (let i = 0; i < 300; i++) {
		const time = i * dt;
		// From 60m out, rolling through and on past.
		const player = new Vector3(0.5, 0, 60 - time * 12);
		instance.update?.({ time, dt, player });
	}
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('mergeStill', () => {
	it('merges parts that differ only in colour, with their colours in the geometry', () => {
		const root = new Group();
		const box = new BoxGeometry();
		const colors = ['#ff0000', '#00ff00', '#0000ff'];
		const materials = colors.map(
			(color) => new MeshStandardMaterial({ color, roughness: 0.85 }),
		);
		for (const [x, material] of materials.entries()) {
			const part = new Mesh(box, material);
			part.position.x = x;
			root.add(part);
		}
		const merged = mergeStill({ object: root });
		const [mesh] = meshes(root);
		expect(meshes(root)).toHaveLength(1);
		if (!(mesh instanceof Mesh)) {
			throw new TypeError('Expected a mesh');
		}
		const geometry: unknown = mesh.geometry;
		if (
			!(geometry instanceof BufferGeometry) ||
			!(mesh.material instanceof MeshStandardMaterial)
		) {
			throw new TypeError('Expected one standard mesh');
		}
		// A white copy of the material, coloured by the geometry.
		expect(materials).not.toContain(mesh.material);
		expect(mesh.material.vertexColors).toBe(true);
		expect(mesh.material.color.getHex()).toBe(0xff_ff_ff);
		expect(mesh.material.roughness).toBe(0.85);
		const color: unknown = geometry.getAttribute('color');
		if (!(color instanceof BufferAttribute)) {
			throw new TypeError('Expected colours in the geometry');
		}
		const perBox = box.getAttribute('position').count;
		for (const [i, material] of materials.entries()) {
			const { r, g, b } = material.color;
			expect([
				color.getX(i * perBox),
				color.getY(i * perBox),
				color.getZ(i * perBox),
			]).toEqual([r, g, b]);
		}
		const copy = mesh.material;
		const dispose = vi.spyOn(copy, 'dispose');
		merged.unmerge();
		expect(meshes(root)).toHaveLength(3);
		expect(dispose).toHaveBeenCalled();
	});

	it('leaves glowing, see-through and textured parts their own materials', () => {
		const root = new Group();
		const box = new BoxGeometry();
		const looks = [
			new MeshStandardMaterial({ emissive: '#ff00ff' }),
			new MeshStandardMaterial({ color: '#ff0000', emissive: '#ff00ff' }),
			new MeshStandardMaterial({ transparent: true, opacity: 0.5 }),
			new MeshStandardMaterial({
				color: '#ff0000',
				transparent: true,
				opacity: 0.5,
			}),
		];
		for (const material of looks) {
			root.add(new Mesh(box, material));
		}
		mergeStill({ object: root });
		expect(meshes(root)).toHaveLength(4);
	});

	it('puts back parts merged by colour when one changes colour', () => {
		const root = new Group();
		const box = new BoxGeometry();
		const red = new MeshStandardMaterial({ color: '#ff0000' });
		root.add(
			new Mesh(box, red),
			new Mesh(box, new MeshStandardMaterial({ color: '#0000ff' })),
		);
		const merged = mergeStill({ object: root });
		expect(meshes(root)).toHaveLength(1);
		merged.update?.({ time: 0, dt: 0, player: new Vector3() });
		expect(meshes(root)).toHaveLength(1);
		red.color.set('#00ff00');
		merged.update?.({ time: 0, dt: 0, player: new Vector3() });
		expect(meshes(root)).toHaveLength(2);
	});

	it('merges parts that share a parent and a material', () => {
		const root = new Group();
		const wood = new MeshStandardMaterial();
		const steel = new MeshStandardMaterial({ metalness: 1 });
		const box = new BoxGeometry();
		for (const x of [0, 1, 2]) {
			const plank = new Mesh(box, wood);
			plank.position.x = x;
			root.add(plank);
		}
		root.add(new Mesh(box, steel));
		const merged = mergeStill({ object: root });
		// Three planks as one, and the steel on its own.
		expect(meshes(root)).toHaveLength(2);
		merged.unmerge();
		expect(meshes(root)).toHaveLength(4);
	});

	it('puts a part back as soon as it moves on its own', () => {
		const root = new Group();
		const wood = new MeshStandardMaterial();
		const box = new BoxGeometry();
		const planks = [0, 1].map((x) => {
			const plank = new Mesh(box, wood);
			plank.position.x = x;
			root.add(plank);
			return plank;
		});
		const merged = mergeStill({
			object: root,
			update: ({ time }) => {
				if (time > 1) {
					planks[1].position.y = 1;
				}
			},
		});
		const frame = { dt: 1, player: new Vector3() };
		merged.update?.({ ...frame, time: 1 });
		expect(meshes(root)).toHaveLength(1);
		// Back before anything is drawn, not a frame later.
		merged.update?.({ ...frame, time: 2 });
		expect(meshes(root)).toEqual(expect.arrayContaining(planks));
		expect(planks[1].parent).toBe(root);
	});

	it.each([
		...ALL_EASTER_EGGS.map((egg) => [egg.id, egg.create] as const),
		['mystery', createMystery] as const,
	])('moves %s exactly as it did unmerged', (_name, create) => {
		// Merging makes new geometries, which takes random numbers for their
		// ids, so start the same numbers afresh for playing each one.
		seedRandom();
		const plain = create();
		const plainMeshes = meshes(plain.object);
		vi.restoreAllMocks();
		seedRandom();
		approach(plain);

		vi.restoreAllMocks();
		seedRandom();
		const built = create();
		const builtMeshes = meshes(built.object);
		const merged = mergeStill(built);
		const drawn = meshes(merged.object).length;
		vi.restoreAllMocks();
		seedRandom();
		approach(merged);
		merged.unmerge();

		expect(builtMeshes).toHaveLength(plainMeshes.length);
		plain.object.updateMatrixWorld(true);
		merged.object.updateMatrixWorld(true);
		const a = new Matrix4();
		for (const [i, mesh] of builtMeshes.entries()) {
			a.copy(plainMeshes[i].matrixWorld);
			const b = mesh.matrixWorld;
			for (let j = 0; j < 16; j++) {
				expect(b.elements[j]).toBeCloseTo(a.elements[j], 5);
			}
			expect(mesh.visible).toBe(plainMeshes[i].visible);
		}
		// Far fewer to draw while it stands.
		expect(drawn).toBeLessThan(plainMeshes.length);
	});
});
