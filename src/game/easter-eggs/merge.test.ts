// Some easter eggs paint their textures on a canvas, so these need a DOM.
// @vitest-environment happy-dom
import {
	Bone,
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	Quaternion,
	SkinnedMesh,
	Vector3,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMystery } from '../mystery';

import { mergeParts } from './merge';
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
 * @param onStep - Called after each step.
 */
const approach = (instance: EasterEggInstance, onStep?: () => void): void => {
	const dt = 1 / 30;
	for (let i = 0; i < 300; i++) {
		const time = i * dt;
		// From 60m out, rolling through and on past.
		const player = new Vector3(0.5, 0, 60 - time * 12);
		instance.update?.({ time, dt, player });
		onStep?.();
	}
};

/**
 * A point's x, y and z, to the nearest millimetre.
 * @param point - The point.
 * @returns Its coordinates, rounded.
 */
const rounded = (point: Vector3): number[] =>
	[point.x, point.y, point.z].map((value) => Math.round(value * 1000) / 1000);

/**
 * A summary of every triangle an object draws, wherever it is in the world:
 * how many there are, their average centre, and how spread out they are.
 * Triangles shrunk away to nothing aren't drawn. Instanced meshes are left
 * out: merging leaves them as they are.
 * @param object - The object.
 * @returns The summary.
 */
const drawnTriangles = (object: Object3D): number[] => {
	object.updateMatrixWorld(true);
	let count = 0;
	const sum = new Vector3();
	let spread = 0;
	const corners = [new Vector3(), new Vector3(), new Vector3()];
	const centre = new Vector3();
	const ab = new Vector3();
	const ac = new Vector3();
	object.traverseVisible((child) => {
		if (!(child instanceof Mesh) || child instanceof InstancedMesh) {
			return;
		}
		const geometry: unknown = child.geometry;
		if (!(geometry instanceof BufferGeometry)) {
			return;
		}
		const { index } = geometry;
		const position: unknown = geometry.getAttribute('position');
		if (!(position instanceof BufferAttribute)) {
			return;
		}
		const vertices = index?.count ?? position.count;
		for (let i = 0; i < vertices; i += 3) {
			for (const [j, corner] of corners.entries()) {
				const vertex = index ? index.getX(i + j) : i + j;
				child
					.getVertexPosition(vertex, corner)
					.applyMatrix4(child.matrixWorld);
			}
			const [a, b, c] = corners;
			ab.subVectors(b, a);
			ac.subVectors(c, a);
			if (ab.cross(ac).length() < 1e-9) {
				continue;
			}
			centre.copy(a).add(b).add(c).divideScalar(3);
			count++;
			sum.add(centre);
			spread += centre.lengthSq();
		}
	});
	return [count, ...sum.divideScalar(count), spread / count];
};

/**
 * Checks two objects draw the same triangles in the same places.
 * @param actual - One.
 * @param expected - The other.
 */
const expectDrawnAlike = (actual: Object3D, expected: Object3D): void => {
	const [count, ...rest] = drawnTriangles(expected);
	const [drawnCount, ...drawnRest] = drawnTriangles(actual);
	expect(drawnCount).toBe(count);
	for (const [i, value] of rest.entries()) {
		expect(drawnRest[i]).toBeCloseTo(value, 4);
	}
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('mergeParts', () => {
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
		const merged = mergeParts({ object: root });
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
		mergeParts({ object: root });
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
		const merged = mergeParts({ object: root });
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
		const merged = mergeParts({ object: root });
		// Three planks as one, and the steel on its own.
		expect(meshes(root)).toHaveLength(2);
		merged.unmerge();
		expect(meshes(root)).toHaveLength(4);
	});

	it('merges parts in still groups into one plain mesh', () => {
		const root = new Group();
		const wood = new MeshStandardMaterial();
		const box = new BoxGeometry();
		const shelf = new Group();
		shelf.position.set(1, 2, 0);
		root.add(shelf);
		for (const parent of [root, shelf, shelf]) {
			parent.add(new Mesh(box, wood));
		}
		const merged = mergeParts({ object: root });
		const [whole] = meshes(root);
		expect(meshes(root)).toHaveLength(1);
		expect(whole).not.toBeInstanceOf(SkinnedMesh);
		expect(meshes(shelf)).toHaveLength(0);
		// Still where they were.
		const geometry: unknown = whole instanceof Mesh && whole.geometry;
		if (!(geometry instanceof BufferGeometry)) {
			throw new TypeError('Expected a merged mesh');
		}
		geometry.computeBoundingBox();
		expect(geometry.boundingBox?.max.toArray()).toEqual([1.5, 2.5, 0.5]);
		merged.unmerge();
		expect(meshes(shelf)).toHaveLength(2);
	});

	it('merges parts that move separately into one skinned mesh that follows them', () => {
		const root = new Group();
		const wood = new MeshStandardMaterial();
		const box = new BoxGeometry();
		// In the order they're merged: a panel on a door, a plank on the
		// easter egg itself, and a note that moves on its own.
		const door = new Group();
		const panel = new Mesh(box, wood);
		panel.position.x = 2;
		door.add(panel);
		const note = new Mesh(box, wood);
		root.add(door, new Mesh(box, wood), note);
		const merged = mergeParts({ object: root, moving: [door, note] });
		const [whole] = meshes(root);
		expect(meshes(root)).toHaveLength(1);
		if (!(whole instanceof SkinnedMesh)) {
			throw new TypeError('Expected a skinned mesh');
		}
		const corner = new Vector3().fromBufferAttribute(
			box.getAttribute('position'),
			0,
		);
		const perBox = box.getAttribute('position').count;
		/**
		 * Where a part's first corner is drawn now, in the easter egg.
		 * @param part - Which part, in the order they're merged.
		 * @returns Its x, y and z, rounded.
		 */
		const drawn = (part: number): number[] => {
			root.updateMatrixWorld(true);
			return rounded(
				whole.getVertexPosition(part * perBox, new Vector3()),
			);
		};
		const offset = (x: number, y: number, z: number): number[] =>
			rounded(corner.clone().add(new Vector3(x, y, z)));
		const frame = { time: 0, dt: 0, player: new Vector3() };

		// The door swings out, carrying its panel, and the note falls.
		door.position.z = 3;
		note.position.y = 5;
		merged.update?.(frame);
		expect([drawn(0), drawn(1), drawn(2)]).toEqual([
			offset(2, 0, 3),
			offset(0, 0, 0),
			offset(0, 5, 0),
		]);

		// Hidden, the note shrinks away to nothing.
		note.visible = false;
		merged.update?.(frame);
		expect(drawn(2)).toEqual([0, 5, 0]);

		merged.unmerge();
		expect(meshes(root)).toHaveLength(3);
		expect(note.parent).toBe(root);
		expect(root.children.some((child) => child instanceof Bone)).toBe(
			false,
		);
	});

	it('leaves a mirrored part out before working out what the rest move with', () => {
		const root = new Group();
		const wood = new MeshStandardMaterial();
		const box = new BoxGeometry();
		const door = new Group();
		door.add(new Mesh(box, wood), new Mesh(box, wood));
		const mirrored = new Mesh(box, wood);
		mirrored.scale.x = -1;
		root.add(door, mirrored);
		mergeParts({ object: root, moving: [door] });
		// The door's panels as one, on the door, so they swing with it.
		expect(meshes(door)).toHaveLength(1);
		expect(mirrored.parent).toBe(root);
	});

	it('keeps what was hidden hidden once shattered', () => {
		const slope = new Group();
		const root = new Group();
		slope.add(root);
		const wood = new MeshStandardMaterial();
		const box = new BoxGeometry();
		// A lid that's shown and hidden, with its own planks merged on it.
		const lid = new Group();
		lid.add(new Mesh(box, wood), new Mesh(box, wood));
		root.add(lid);
		const merged = mergeParts({ object: root, moving: [lid] });
		lid.visible = false;
		const shattered = merged.shatter();
		const [count] = drawnTriangles(shattered.object);
		expect(count).toBe(0);
		shattered.dispose();
	});

	it('puts parts back when a still group they were merged past moves', () => {
		const root = new Group();
		const wood = new MeshStandardMaterial();
		const box = new BoxGeometry();
		const lid = new Group();
		root.add(lid);
		root.add(new Mesh(box, wood));
		lid.add(new Mesh(box, wood));
		const merged = mergeParts({
			object: root,
			update: ({ time }) => {
				lid.rotation.x = time;
			},
		});
		expect(meshes(root)).toHaveLength(1);
		merged.update?.({ time: 1, dt: 1, player: new Vector3() });
		expect(meshes(root)).toHaveLength(2);
		expect(meshes(lid)).toHaveLength(1);
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
		const merged = mergeParts({
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
	])('knows everything %s moves, so its merges hold', (_name, create) => {
		const instance = create();
		const parts: Object3D[] = [];
		instance.object.traverse((child) => {
			if (child !== instance.object) {
				parts.push(child);
			}
		});
		const placed = parts.map((part) => {
			part.updateMatrix();
			return part.matrix.clone();
		});
		const shown = parts.map((part) => part.visible);
		const moved = new Set<Object3D>();
		approach(instance, () => {
			for (const [i, part] of parts.entries()) {
				part.updateMatrix();
				if (
					!part.matrix.equals(placed[i]) ||
					part.visible !== shown[i]
				) {
					moved.add(part);
				}
			}
		});
		const moving = new Set(instance.moving);
		expect([...moved].filter((part) => !moving.has(part))).toEqual([]);
	});

	it.each(ALL_EASTER_EGGS)(
		'keeps every part of the $id inside its clearing, so it can be culled by it',
		({ create, clearingRadius }) => {
			const instance = create();
			let reach = 0;
			const vertex = new Vector3();
			let step = 0;
			approach(instance, () => {
				if (step++ % 15 !== 0) {
					return;
				}
				instance.object.updateMatrixWorld(true);
				instance.object.traverseVisible((child) => {
					if (!(child instanceof Mesh)) {
						return;
					}
					const geometry: unknown = child.geometry;
					if (!(geometry instanceof BufferGeometry)) {
						return;
					}
					const position: unknown = geometry.getAttribute('position');
					if (!(position instanceof BufferAttribute)) {
						return;
					}
					for (let i = 0; i < position.count; i++) {
						child
							.getVertexPosition(i, vertex)
							.applyMatrix4(child.matrixWorld);
						reach = Math.max(reach, vertex.length());
					}
				});
			});
			expect(reach).toBeLessThan(clearingRadius);
		},
	);

	it.each([
		...ALL_EASTER_EGGS.map((egg) => [egg.id, egg.create] as const),
		['mystery', createMystery] as const,
	])(
		'draws %s just where it would unmerged, all through its moment',
		(_name, create) => {
			/**
			 * Plays an easter egg, noting what it draws every half a second.
			 * @param instance - The easter egg.
			 * @returns What it drew.
			 */
			const play = (instance: EasterEggInstance): number[][] => {
				const drawn: number[][] = [];
				let step = 0;
				seedRandom();
				approach(instance, () => {
					if (step++ % 15 === 0) {
						drawn.push(drawnTriangles(instance.object));
					}
				});
				vi.restoreAllMocks();
				return drawn;
			};
			seedRandom();
			const plain = create();
			vi.restoreAllMocks();
			seedRandom();
			const merged = mergeParts(create());
			vi.restoreAllMocks();
			const expected = play(plain);
			const actual = play(merged);
			for (const [i, [count, ...rest]] of expected.entries()) {
				const [drawnCount, ...drawnRest] = actual[i] ?? [];
				expect(drawnCount).toBe(count);
				for (const [j, value] of rest.entries()) {
					expect(drawnRest[j]).toBeCloseTo(value, 4);
				}
			}
		},
	);

	it.each([
		...ALL_EASTER_EGGS.map((egg) => [egg.id, egg.create] as const),
		['mystery', createMystery] as const,
	])(
		'shatters %s into pieces drawn just where its parts are, as they fly',
		(_name, create) => {
			/**
			 * Plays an easter egg partway through its moment, on a slope.
			 * @param instance - The easter egg.
			 * @returns The slope.
			 */
			const playOnSlope = (instance: EasterEggInstance): Group => {
				const slope = new Group();
				slope.add(instance.object);
				seedRandom();
				for (let i = 0; i < 150; i++) {
					const time = i / 30;
					const player = new Vector3(0.5, 0, 60 - time * 12);
					instance.update?.({ time, dt: 1 / 30, player });
				}
				vi.restoreAllMocks();
				return slope;
			};
			seedRandom();
			const plain = create();
			vi.restoreAllMocks();
			seedRandom();
			const merged = mergeParts(create());
			vi.restoreAllMocks();
			const plainSlope = playOnSlope(plain);
			const mergedSlope = playOnSlope(merged);

			// The plain copy broken up as it was: every mesh on its own, on the
			// slope, and those that weren't showing still hidden.
			const parts: Object3D[] = [];
			plain.object.traverse((child) => {
				if (child instanceof Mesh) {
					parts.push(child);
				}
			});
			plain.object.updateMatrixWorld(true);
			const shown = new Set<Object3D>();
			plain.object.traverseVisible((child) => shown.add(child));
			for (const part of parts) {
				plainSlope.attach(part);
				part.visible = shown.has(part);
			}
			plain.object.removeFromParent();
			const shattered = merged.shatter();
			merged.object.removeFromParent();
			expect(shattered.pieces).toHaveLength(parts.length);
			expectDrawnAlike(mergedSlope, plainSlope);

			// Then each piece flung somewhere new, the same in both.
			const turn = new Quaternion();
			for (const [i, part] of parts.entries()) {
				if (!part.visible) {
					continue;
				}
				part.position.add(
					new Vector3(i * 0.3, (i % 5) * 0.4, -i * 0.2),
				);
				part.quaternion.premultiply(
					turn.setFromAxisAngle(
						new Vector3(1, 1, 0).normalize(),
						i * 0.7,
					),
				);
				part.scale.multiplyScalar(0.6 + (i % 3) * 0.2);
				const piece = shattered.pieces[i];
				piece.position.copy(part.position);
				piece.quaternion.copy(part.quaternion);
				piece.scale.copy(part.scale);
			}
			expectDrawnAlike(mergedSlope, plainSlope);
			shattered.dispose();
		},
	);

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
		const merged = mergeParts(built);
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
