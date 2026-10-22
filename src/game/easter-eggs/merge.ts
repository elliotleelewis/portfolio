import {
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	Material,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	Quaternion,
	Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { EasterEggFrame, EasterEggInstance } from './types';

/**
 * An easter egg with its still parts merged, so it takes far fewer draw
 * calls.
 */
export interface MergedEasterEgg extends EasterEggInstance {
	// Puts every part back as it was built, separate, so that (for example)
	// each can fly off on its own when the easter egg is smashed.
	unmerge: () => void;
}

// How something was placed when it was merged.
interface Placement {
	object: Object3D;
	position: Vector3;
	quaternion: Quaternion;
	scale: Vector3;
	isVisible: boolean;
}

// A part taken out of the scene and drawn as part of a merged mesh: where it
// goes back, how it was placed, and (if its colour went into the merge) what
// colour it was.
interface Original extends Placement {
	mesh: Mesh<BufferGeometry, Material>;
	parent: Object3D;
	color: Color | undefined;
}

// Parts merged into one mesh, under the nearest group they all move with.
// Parts merged by colour draw with a material of the merge's own, which goes
// when it does.
interface Merge {
	frame: Object3D;
	merged: Mesh;
	originals: Original[];
	// The still groups between the parts and the frame, as they were.
	between: Placement[];
	ownMaterial: Material | undefined;
}

// A part that can be merged, and where its merge goes.
interface Candidate {
	mesh: Mesh<BufferGeometry, Material>;
	// The nearest group it moves with: something the easter egg moves, or
	// the easter egg itself.
	frame: Object3D;
	// The still groups in between.
	between: Object3D[];
}

/**
 * Whether a material's colour can go into the geometry instead, so parts
 * that differ only in colour can share one material: a plain, solid, untextured
 * standard material that doesn't glow. Easter eggs animate glowing and
 * see-through materials (a flickering ember, the RGB, smoke), so those keep
 * their own.
 * @param material - The material.
 * @returns True if its colour can go into the geometry.
 */
const isTintable = (material: Material): material is MeshStandardMaterial =>
	material instanceof MeshStandardMaterial &&
	material.type === 'MeshStandardMaterial' &&
	!material.transparent &&
	!material.vertexColors &&
	material.emissive.getHex() === 0 &&
	[
		material.map,
		material.alphaMap,
		material.aoMap,
		material.bumpMap,
		material.displacementMap,
		material.emissiveMap,
		material.envMap,
		material.lightMap,
		material.metalnessMap,
		material.normalMap,
		material.roughnessMap,
	].every((map) => map === null);

// What a material's look leaves out: which material it is, and its colour.
const unlike = new Set(['uuid', 'name', 'color']);

/**
 * Everything about a tintable material but its colour, so materials that
 * look alike apart from their colour share it.
 * @param material - The material.
 * @returns Its look, colour aside.
 */
const lookOf = (material: MeshStandardMaterial): string =>
	JSON.stringify(material.toJSON(), (key: string, value: unknown) =>
		unlike.has(key) ? undefined : value,
	);

/**
 * Whether a mesh can be merged with others like it: a plain mesh with one
 * material and nothing attached to it, and showing.
 * @param object - The object.
 * @returns True if it can be merged.
 */
const isMergeable = (
	object: Object3D,
): object is Mesh<BufferGeometry, Material> =>
	object instanceof Mesh &&
	object.type === 'Mesh' &&
	object.geometry instanceof BufferGeometry &&
	object.material instanceof Material &&
	object.children.length === 0 &&
	object.visible &&
	Object.keys(object.geometry.morphAttributes).length === 0;

/**
 * Where a part's merge goes: up past every still group above it, to the
 * nearest one that moves (or the easter egg itself), so parts all over a
 * still easter egg merge as one.
 * @param mesh - The part.
 * @param root - The easter egg.
 * @param moving - What the easter egg moves.
 * @returns Where it goes, or undefined if a still group above it is hidden,
 * so it's never drawn.
 */
const placeMerge = (
	mesh: Mesh<BufferGeometry, Material>,
	root: Object3D,
	moving: ReadonlySet<Object3D>,
): Candidate | undefined => {
	const between: Object3D[] = [];
	let frame = mesh.parent;
	while (frame && frame !== root && !moving.has(frame)) {
		if (!frame.visible) {
			return undefined;
		}
		between.push(frame);
		frame = frame.parent;
	}
	return frame ? { mesh, frame, between } : undefined;
};

/**
 * Where and how something is placed now.
 * @param object - The thing.
 * @returns Its placement.
 */
const placementOf = (object: Object3D): Placement => ({
	object,
	position: object.position.clone(),
	quaternion: object.quaternion.clone(),
	scale: object.scale.clone(),
	isVisible: object.visible,
});

/**
 * Whether something has been moved, turned, resized or hidden since it was
 * placed.
 * @param placement - The thing, and how it was placed.
 * @returns True if it has.
 */
const hasMoved = (placement: Placement): boolean => {
	const { object, position, quaternion, scale, isVisible } = placement;
	return (
		!object.position.equals(position) ||
		!object.quaternion.equals(quaternion) ||
		!object.scale.equals(scale) ||
		object.visible !== isVisible
	);
};

/**
 * What meshes have to share to be merged into one: the same material,
 * shadows and kind of geometry (the same attributes, laid out the same).
 * @param mesh - The mesh.
 * @returns A key shared by every mesh it can merge with.
 */
const mergeKey = (mesh: Mesh<BufferGeometry, Material>): string =>
	[
		isTintable(mesh.material)
			? `tint:${lookOf(mesh.material)}`
			: mesh.material.uuid,
		mesh.castShadow,
		mesh.receiveShadow,
		mesh.geometry.index ? 'indexed' : 'flat',
		...Object.entries(mesh.geometry.attributes)
			.map(
				([name, attribute]) =>
					`${name}:${String(attribute.itemSize)}:${String(attribute.normalized)}`,
			)
			.toSorted((x, y) => x.localeCompare(y)),
	].join('|');

/**
 * Whether a merged-away part has been moved, turned, resized or hidden
 * since it was merged, or has changed colour.
 * @param original - The part, and how it was placed.
 * @returns True if it has changed.
 */
const hasChanged = (original: Original): boolean => {
	const { mesh, color } = original;
	return (
		hasMoved(original) ||
		(color !== undefined &&
			(!isTintable(mesh.material) || !mesh.material.color.equals(color)))
	);
};

/**
 * Whether a merge no longer shows its parts as they are: one of them, or a
 * still group above them, has changed.
 * @param merge - The merge.
 * @returns True if it has to be put back.
 */
const isStale = (merge: Merge): boolean =>
	merge.originals.some((original) => hasChanged(original)) ||
	merge.between.some((placement) => hasMoved(placement));

/**
 * A copy of a part's geometry, moved into place in its merge's frame, and
 * coloured like its material if the merge takes its colour.
 * @param mesh - The part.
 * @param matrix - Where it is in the frame.
 * @param isTinted - Whether to colour it.
 * @returns The copy.
 */
const placedGeometry = (
	mesh: Mesh<BufferGeometry, Material>,
	matrix: Matrix4,
	isTinted: boolean,
): BufferGeometry => {
	const geometry = mesh.geometry.clone().applyMatrix4(matrix);
	if (isTinted && isTintable(mesh.material)) {
		const { r, g, b } = mesh.material.color;
		const { count } = geometry.getAttribute('position');
		geometry.setAttribute(
			'color',
			new Float32BufferAttribute(
				Array.from({ length: count }, () => [r, g, b]).flat(),
				3,
			),
		);
	}
	return geometry;
};

/**
 * Merges an easter egg's parts that move together and share a material into
 * one mesh each, so the easter egg takes far fewer draw calls. Parts merge
 * up past every still group, into the nearest group the easter egg moves
 * (or the easter egg itself), so they still move with it. What the easter
 * egg moves on its own is left out. Plain parts whose materials differ only
 * in colour merge too, with their colours in the geometry.
 *
 * If anything it hasn't said it moves does move (or a part merged by colour
 * changes colour), the merge it's in is put back, after the update and
 * before anything is drawn, so it still looks right.
 * @param instance - The easter egg, just created.
 * @returns The easter egg, merged.
 */
export const mergeStill = (instance: EasterEggInstance): MergedEasterEgg => {
	const { object } = instance;
	const moving = new Set(instance.moving);
	object.updateMatrixWorld(true);

	// Group the parts by where their merge goes, then by what they'd need to
	// share.
	const byFrame = new Map<Object3D, Map<string, Candidate[]>>();
	object.traverse((child) => {
		if (!child.parent || !isMergeable(child) || moving.has(child)) {
			return;
		}
		const candidate = placeMerge(child, object, moving);
		if (!candidate) {
			return;
		}
		const groups =
			byFrame.get(candidate.frame) ?? new Map<string, Candidate[]>();
		byFrame.set(candidate.frame, groups);
		const key = mergeKey(child);
		groups.set(key, [...(groups.get(key) ?? []), candidate]);
	});

	const merges: Merge[] = [];
	const inverse = new Matrix4();
	for (const [frame, groups] of byFrame) {
		inverse.copy(frame.matrixWorld).invert();
		for (const candidates of groups.values()) {
			// Where each part is in the frame. A mirrored one can't merge: its
			// faces would turn inside out.
			const placed = candidates
				.map((candidate) => ({
					...candidate,
					matrix: new Matrix4().multiplyMatrices(
						inverse,
						candidate.mesh.matrixWorld,
					),
				}))
				.filter(({ matrix }) => matrix.determinant() > 0);
			if (placed.length < 2) {
				continue;
			}
			const meshes = placed.map(({ mesh }) => mesh);
			const [first] = meshes;
			// Parts that share a material keep it. Parts that only look alike
			// get their colours in the geometry, and a white copy of it.
			const isTinted = meshes.some(
				(mesh) => mesh.material !== first.material,
			);
			const geometries = placed.map(({ mesh, matrix: at }) =>
				placedGeometry(mesh, at, isTinted),
			);
			const geometry = mergeGeometries(geometries);
			for (const clone of geometries) {
				clone.dispose();
			}
			let ownMaterial: Material | undefined;
			if (isTinted) {
				ownMaterial = first.material.clone();
				if (ownMaterial instanceof MeshStandardMaterial) {
					ownMaterial.color.set(0xff_ff_ff);
					ownMaterial.vertexColors = true;
				}
			}
			const merged = new Mesh(geometry, ownMaterial ?? first.material);
			merged.castShadow = first.castShadow;
			merged.receiveShadow = first.receiveShadow;
			frame.add(merged);
			const originals = placed.map(({ mesh }): Original => {
				const parent = mesh.parent ?? frame;
				parent.remove(mesh);
				return {
					...placementOf(mesh),
					mesh,
					parent,
					color:
						isTinted && isTintable(mesh.material)
							? mesh.material.color.clone()
							: undefined,
				};
			});
			const between = new Set(
				placed.flatMap((candidate) => candidate.between),
			);
			merges.push({
				frame,
				merged,
				originals,
				between: [...between].map((group) => placementOf(group)),
				ownMaterial,
			});
		}
	}

	const split = (merge: Merge): void => {
		const { frame, merged, originals, ownMaterial } = merge;
		frame.remove(merged);
		merged.geometry.dispose();
		ownMaterial?.dispose();
		for (const { mesh, parent } of originals) {
			parent.add(mesh);
		}
		merges.splice(merges.indexOf(merge), 1);
	};

	return {
		object,
		moving: instance.moving,
		update: (frame: EasterEggFrame) => {
			instance.update?.(frame);
			// Put back any merge whose parts have started moving.
			for (let i = merges.length - 1; i >= 0; i--) {
				if (isStale(merges[i])) {
					split(merges[i]);
				}
			}
		},
		unmerge: () => {
			while (merges.length > 0) {
				split(merges[0]);
			}
		},
	};
};
