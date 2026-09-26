import {
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	Material,
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

// A part taken out of the scene and drawn as part of a merged mesh, and how
// it was placed (and, if its colour went into the merge, what colour it was)
// when it was merged.
interface Original {
	mesh: Mesh<BufferGeometry, Material>;
	position: Vector3;
	quaternion: Quaternion;
	scale: Vector3;
	isVisible: boolean;
	color: Color | undefined;
}

// Parts merged into one mesh, alongside them under their parent. Parts
// merged by colour draw with a material of the merge's own, which goes when
// it does.
interface Merge {
	parent: Object3D;
	merged: Mesh;
	originals: Original[];
	ownMaterial: Material | undefined;
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
 * material and nothing attached to it, showing, and not mirrored.
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
	Object.keys(object.geometry.morphAttributes).length === 0 &&
	object.matrix.determinant() > 0;

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
 * since it was merged.
 * @param original - The part, and how it was placed.
 * @returns True if it has changed.
 */
const hasChanged = (original: Original): boolean => {
	const { mesh, position, quaternion, scale, isVisible, color } = original;
	return (
		!mesh.position.equals(position) ||
		!mesh.quaternion.equals(quaternion) ||
		!mesh.scale.equals(scale) ||
		mesh.visible !== isVisible ||
		(color !== undefined &&
			(!isTintable(mesh.material) || !mesh.material.color.equals(color)))
	);
};

/**
 * A copy of a part's geometry, moved into place in its parent, and coloured
 * like its material if the merge takes its colour.
 * @param mesh - The part.
 * @param isTinted - Whether to colour it.
 * @returns The copy.
 */
const placedGeometry = (
	mesh: Mesh<BufferGeometry, Material>,
	isTinted: boolean,
): BufferGeometry => {
	const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
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
 * Merges an easter egg's parts that share a parent and a material into one
 * mesh each, so the easter egg takes far fewer draw calls. A merged mesh
 * stays under the same parent, so it still moves with it. Plain parts whose
 * materials differ only in colour merge too, with their colours in the
 * geometry.
 *
 * Some easter eggs move single parts about (a chain link flying off, a
 * spark). After every update, any merged-away part that has changed (or
 * whose colour has) is put back, along with the rest of its merge, before
 * anything is drawn.
 * @param instance - The easter egg, just created.
 * @returns The easter egg, merged.
 */
export const mergeStill = (instance: EasterEggInstance): MergedEasterEgg => {
	const { object } = instance;
	object.updateMatrixWorld(true);

	// Group the parts by parent, then by what they'd need to share.
	const byParent = new Map<
		Object3D,
		Map<string, Mesh<BufferGeometry, Material>[]>
	>();
	object.traverse((child) => {
		if (!child.parent || !isMergeable(child)) {
			return;
		}
		child.updateMatrix();
		const groups =
			byParent.get(child.parent) ??
			new Map<string, Mesh<BufferGeometry, Material>[]>();
		byParent.set(child.parent, groups);
		const key = mergeKey(child);
		groups.set(key, [...(groups.get(key) ?? []), child]);
	});

	const merges: Merge[] = [];
	for (const [parent, groups] of byParent) {
		for (const meshes of groups.values()) {
			if (meshes.length < 2) {
				continue;
			}
			const [first] = meshes;
			// Parts that share a material keep it. Parts that only look alike
			// get their colours in the geometry, and a white copy of it.
			const isTinted = meshes.some(
				(mesh) => mesh.material !== first.material,
			);
			const placed = meshes.map((mesh) => placedGeometry(mesh, isTinted));
			const geometry = mergeGeometries(placed);
			for (const clone of placed) {
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
			parent.add(merged);
			const originals = meshes.map((mesh) => {
				parent.remove(mesh);
				return {
					mesh,
					position: mesh.position.clone(),
					quaternion: mesh.quaternion.clone(),
					scale: mesh.scale.clone(),
					isVisible: mesh.visible,
					color:
						isTinted && isTintable(mesh.material)
							? mesh.material.color.clone()
							: undefined,
				};
			});
			merges.push({ parent, merged, originals, ownMaterial });
		}
	}

	const split = (merge: Merge): void => {
		const { parent, merged, originals, ownMaterial } = merge;
		parent.remove(merged);
		merged.geometry.dispose();
		ownMaterial?.dispose();
		for (const { mesh } of originals) {
			parent.add(mesh);
		}
		merges.splice(merges.indexOf(merge), 1);
	};

	return {
		object,
		update: (frame: EasterEggFrame) => {
			instance.update?.(frame);
			// Put back any part that's started moving on its own.
			for (let i = merges.length - 1; i >= 0; i--) {
				if (
					merges[i].originals.some((original) => hasChanged(original))
				) {
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
