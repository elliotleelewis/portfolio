import {
	Bone,
	BufferAttribute,
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	Group,
	Material,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	Quaternion,
	Skeleton,
	SkinnedMesh,
	Sphere,
	Uint16BufferAttribute,
	Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { withBudget } from '../draw-budget';

import { disposeObject } from './parts';
import type { EasterEggFrame, EasterEggInstance } from './types';

/**
 * An easter egg with its parts merged, so it takes far fewer draw calls.
 */
export interface MergedEasterEgg extends EasterEggInstance {
	// Puts every part back as it was built, separate.
	unmerge: () => void;
	// Breaks it into its parts, still drawn together, for flinging about once
	// it's smashed. After this, it's empty.
	shatter: () => Shattered;
}

/**
 * A smashed easter egg's parts, each a piece that can be moved (and spun,
 * and shrunk) on its own, though most are drawn together.
 */
export interface Shattered {
	// Holds the pieces, beside where the easter egg was.
	object: Object3D;
	// One for each mesh the easter egg was built with, in the order they
	// were, where it is now.
	pieces: Object3D[];
	// Frees everything, once the pieces are done with.
	dispose: () => void;
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
// goes back, how it was placed, whether it moves on its own, and (if its
// colour went into the merge) what colour it was.
interface Original extends Placement {
	mesh: Mesh<BufferGeometry, Material>;
	parent: Object3D;
	isMoving: boolean;
	color: Color | undefined;
}

// Parts merged into one mesh, under the easter egg or the one thing they all
// move with. Parts merged by colour draw with a material of the merge's own,
// which goes when it does.
interface Merge {
	home: Object3D;
	merged: Mesh;
	originals: Original[];
	// How many of the merged geometry's vertices are each original's, in
	// order.
	counts: number[];
	// The still groups between the parts and what they move with, as they
	// were.
	between: Placement[];
	ownMaterial: Material | undefined;
}

// A part that can be merged, and what it moves with.
interface Candidate {
	mesh: Mesh<BufferGeometry, Material>;
	// The part itself if it moves on its own, or else the nearest group above
	// it that does, or the easter egg itself.
	frame: Object3D;
	// The still groups in between.
	between: Object3D[];
	isMoving: boolean;
}

// A part, and where it is in what its merge goes in.
interface Placed extends Candidate {
	matrix: Matrix4;
}

// The bone that parts merged across moving things ride on, for one of those
// things: on the group (or the easter egg), or in a moving part's place,
// copying it.
interface Anchor {
	bone: Bone;
	follows: Object3D;
	isPart: boolean;
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
 * Whether something is showing: it and everything above it in the easter
 * egg.
 * @param object - The thing.
 * @param root - The easter egg.
 * @returns True if it's showing.
 */
const isShown = (object: Object3D | null, root: Object3D): boolean => {
	for (let node = object; node && node !== root; node = node.parent) {
		if (!node.visible) {
			return false;
		}
	}
	return true;
};

/**
 * What a part moves with: itself, if the easter egg moves it, or else the
 * nearest group above it that the easter egg moves (or the easter egg
 * itself), and the still groups in between.
 * @param mesh - The part.
 * @param root - The easter egg.
 * @param moving - What the easter egg moves.
 * @returns What it moves with, or undefined if it's hidden, so it's never
 * drawn.
 */
const placeMerge = (
	mesh: Mesh<BufferGeometry, Material>,
	root: Object3D,
	moving: ReadonlySet<Object3D>,
): Candidate | undefined => {
	if (!isShown(mesh.parent, root)) {
		return undefined;
	}
	if (moving.has(mesh)) {
		return { mesh, frame: mesh, between: [], isMoving: true };
	}
	const between: Object3D[] = [];
	let frame = mesh.parent;
	while (frame && frame !== root && !moving.has(frame)) {
		between.push(frame);
		frame = frame.parent;
	}
	return frame ? { mesh, frame, between, isMoving: false } : undefined;
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
 * Whether a merged-away part has changed since it was merged: moved, turned,
 * resized or hidden (unless it moves on its own, which its bone keeps up
 * with), or changed colour.
 * @param original - The part, and how it was placed.
 * @returns True if it has changed.
 */
const hasChanged = (original: Original): boolean => {
	const { mesh, color, isMoving } = original;
	return (
		(!isMoving && hasMoved(original)) ||
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
 * Where something is in something else that holds it.
 * @param home - What holds it.
 * @param object - The thing.
 * @returns Its placement in what holds it.
 */
const within = (home: Object3D, object: Object3D): Matrix4 =>
	new Matrix4().copy(home.matrixWorld).invert().multiply(object.matrixWorld);

/**
 * How a merged mesh places the vertices of one part now: in the world,
 * from the merged geometry's own space.
 * @param merged - The merged mesh, up to date.
 * @param vertex - One of the part's vertices.
 * @returns How its vertices are placed.
 */
const placingOf = (merged: Mesh, vertex: number): Matrix4 => {
	const skinIndex: unknown = merged.geometry.getAttribute('skinIndex');
	if (
		!(merged instanceof SkinnedMesh) ||
		!(skinIndex instanceof BufferAttribute)
	) {
		return merged.matrixWorld.clone();
	}
	const bone = skinIndex.getX(vertex);
	const { bones, boneInverses } = merged.skeleton;
	return new Matrix4()
		.multiplyMatrices(bones[bone].matrixWorld, boneInverses[bone])
		.multiply(merged.bindMatrix);
};

/**
 * Puts each part of a geometry wholly on a bone of its own.
 * @param geometry - The geometry.
 * @param counts - How many vertices each part has, in order.
 * @param first - The first part's bone's place in the skeleton.
 */
const onBones = (
	geometry: BufferGeometry,
	counts: readonly number[],
	first: number,
): void => {
	const { count } = geometry.getAttribute('position');
	const indices = new Uint16Array(count * 4);
	const weights = new Float32Array(count * 4);
	let vertex = 0;
	for (const [part, partCount] of counts.entries()) {
		for (let i = 0; i < partCount; i++, vertex++) {
			indices[vertex * 4] = first + part;
			weights[vertex * 4] = 1;
		}
	}
	const skinIndex: unknown = geometry.getAttribute('skinIndex');
	const skinWeight: unknown = geometry.getAttribute('skinWeight');
	// Written over in place, if it has them, so nothing's left behind on the
	// GPU.
	if (
		skinIndex instanceof Uint16BufferAttribute &&
		skinWeight instanceof Float32BufferAttribute
	) {
		skinIndex.set(indices);
		skinWeight.set(weights);
		skinIndex.needsUpdate = true;
		skinWeight.needsUpdate = true;
		return;
	}
	geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
	geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
};

/**
 * Puts a geometry wholly on one bone.
 * @param geometry - The geometry.
 * @param bone - The bone's place in the skeleton.
 * @returns The geometry.
 */
const onBone = (geometry: BufferGeometry, bone: number): BufferGeometry => {
	const { count } = geometry.getAttribute('position');
	const indices = new Uint16Array(count * 4);
	const weights = new Float32Array(count * 4);
	for (let i = 0; i < count; i++) {
		indices[i * 4] = bone;
		weights[i * 4] = 1;
	}
	geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
	geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
	return geometry;
};

/**
 * Merges an easter egg's parts that share a material into as few meshes as
 * it can, so it takes far fewer draw calls. Plain parts whose materials
 * differ only in colour merge too, with their colours in the geometry.
 *
 * Parts that all move with one thing (the same moving group, or nothing but
 * the easter egg) merge into a plain mesh on it. Parts that move with
 * different things (the joints of a rig, a shower of notes) merge into one
 * skinned mesh, each part on a bone that follows what it moves with, and
 * shrinks away to nothing while that's hidden.
 *
 * If anything it hasn't said it moves does move (or a part merged by colour
 * changes colour), the merge it's in is put back, after the update and
 * before anything is drawn, so it still looks right.
 * @param instance - The easter egg, just created.
 * @param reach - How far from its middle any part of it ever goes, so a
 * skinned mesh can still be left undrawn out of view. Without it, they're
 * always drawn.
 * @returns The easter egg, merged.
 */
export const mergeParts = (
	instance: EasterEggInstance,
	reach?: number,
): MergedEasterEgg => {
	const { object } = instance;
	const moving = new Set(instance.moving);
	object.updateMatrixWorld(true);
	// Every mesh it's built with, in order, merged or not.
	const built: Object3D[] = [];
	object.traverse((child) => {
		if (child instanceof Mesh) {
			built.push(child);
		}
	});

	// Group the parts by what they'd need to share.
	const groups = new Map<string, Candidate[]>();
	object.traverse((child) => {
		if (!child.parent || !isMergeable(child)) {
			return;
		}
		const candidate = placeMerge(child, object, moving);
		if (!candidate) {
			return;
		}
		const key = mergeKey(child);
		groups.set(key, [...(groups.get(key) ?? []), candidate]);
	});

	// Where each part is in what its merge goes in: the one thing they all
	// move with, or else the easter egg. A mirrored one can't merge: its
	// faces would turn inside out.
	const plans: { home: Object3D; placed: Placed[]; isSkinned: boolean }[] =
		[];
	for (const candidates of groups.values()) {
		const kept = candidates.filter(
			({ mesh }) => within(object, mesh).determinant() > 0,
		);
		const frames = new Set(kept.map(({ frame }) => frame));
		const isSkinned = frames.size > 1;
		const home = !isSkinned && kept.length > 0 ? kept[0].frame : object;
		const placed = kept
			.map((candidate) => ({
				...candidate,
				matrix: within(home, candidate.mesh),
			}))
			.filter(({ matrix }) => matrix.determinant() > 0);
		if (placed.length > 1) {
			plans.push({ home, placed, isSkinned });
		}
	}

	// A bone for everything skinned parts move with.
	const anchors = new Map<Object3D, Anchor>();
	for (const { placed, isSkinned } of plans) {
		for (const { frame, mesh, isMoving } of placed) {
			if (!isSkinned || anchors.has(frame)) {
				continue;
			}
			const bone = new Bone();
			if (isMoving) {
				mesh.parent?.add(bone);
			} else {
				frame.add(bone);
			}
			anchors.set(frame, { bone, follows: frame, isPart: isMoving });
		}
	}

	/**
	 * Moves each bone to follow what it's for, shrinking it to nothing while
	 * that's hidden.
	 */
	const follow = (): void => {
		for (const { bone, follows, isPart } of anchors.values()) {
			if (isPart) {
				bone.position.copy(follows.position);
				bone.quaternion.copy(follows.quaternion);
				bone.scale.copy(follows.scale);
			} else {
				bone.scale.setScalar(1);
			}
			if (!isShown(bone.parent, object) || (isPart && !follows.visible)) {
				bone.scale.setScalar(0);
			}
		}
	};
	follow();
	object.updateMatrixWorld(true);
	const bones: Bone[] = [];
	for (const { bone } of anchors.values()) {
		bones.push(bone);
	}
	const skeleton = bones.length > 0 ? new Skeleton(bones) : undefined;

	const merges: Merge[] = [];
	for (const { home, placed, isSkinned } of plans) {
		const meshes = placed.map(({ mesh }) => mesh);
		const [first] = meshes;
		// Parts that share a material keep it. Parts that only look alike get
		// their colours in the geometry, and a white copy of it.
		const isTinted = meshes.some(
			(mesh) => mesh.material !== first.material,
		);
		const geometries = placed.map(({ mesh, matrix, frame }) => {
			const geometry = placedGeometry(mesh, matrix, isTinted);
			const anchor = anchors.get(frame);
			return isSkinned && anchor
				? onBone(geometry, bones.indexOf(anchor.bone))
				: geometry;
		});
		const geometry = mergeGeometries(geometries);
		const counts = geometries.map(
			(clone) => clone.getAttribute('position').count,
		);
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
		const material = ownMaterial ?? first.material;
		const merged =
			isSkinned && skeleton
				? new SkinnedMesh(geometry, material)
				: new Mesh(geometry, material);
		merged.castShadow = first.castShadow;
		merged.receiveShadow = first.receiveShadow;
		home.add(merged);
		if (skeleton && merged instanceof SkinnedMesh) {
			merged.bind(skeleton);
			// Its parts move about, so the bounds it was built with don't hold:
			// it's bounded by how far they can go instead.
			if (reach === undefined) {
				merged.frustumCulled = false;
			} else {
				merged.boundingSphere = new Sphere(new Vector3(), reach);
			}
		}
		const originals = placed.map(({ mesh, isMoving }): Original => {
			const parent = mesh.parent ?? home;
			parent.remove(mesh);
			return {
				...placementOf(mesh),
				mesh,
				parent,
				isMoving,
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
			home,
			merged,
			originals,
			counts,
			between: [...between].map((group) => placementOf(group)),
			ownMaterial,
		});
	}

	const removeAnchors = (): void => {
		for (const { bone } of anchors.values()) {
			bone.removeFromParent();
		}
		anchors.clear();
		skeleton?.dispose();
	};

	const split = (merge: Merge): void => {
		const { home, merged, originals, ownMaterial } = merge;
		home.remove(merged);
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
			// Put back any merge whose parts have changed unexpectedly.
			for (let i = merges.length - 1; i >= 0; i--) {
				if (isStale(merges[i])) {
					split(merges[i]);
				}
			}
			follow();
		},
		unmerge: () => {
			while (merges.length > 0) {
				split(merges[0]);
			}
			removeAnchors();
		},
		shatter: () => {
			object.updateWorldMatrix(true, true);
			const shards = withBudget(new Group(), 'easter egg');
			(object.parent ?? object).add(shards);
			shards.updateMatrixWorld(true);
			const toShards = new Matrix4().copy(shards.matrixWorld).invert();
			const pieceOf = new Map<Object3D, Object3D>();
			const bones: Bone[] = [];
			// Where each bone's part's vertices are drawn now, from the merged
			// geometry's space.
			const placings: Matrix4[] = [];
			const hidden: Bone[] = [];
			const skins: SkinnedMesh[] = [];
			const consumed: Mesh[] = [];
			// Each merged part on a bone of its own, where the part is, so it
			// spins about its own middle.
			for (const { merged, originals, counts } of merges) {
				let vertex = 0;
				const first = bones.length;
				for (const [i, { mesh, parent }] of originals.entries()) {
					mesh.updateMatrix();
					const bone = new Bone();
					new Matrix4()
						.multiplyMatrices(toShards, parent.matrixWorld)
						.multiply(mesh.matrix)
						.decompose(bone.position, bone.quaternion, bone.scale);
					if (!mesh.visible || !isShown(parent, object)) {
						hidden.push(bone);
					}
					shards.add(bone);
					bones.push(bone);
					placings.push(placingOf(merged, vertex));
					pieceOf.set(mesh, bone);
					consumed.push(mesh);
					vertex += counts[i];
				}
				onBones(merged.geometry, counts, first);
				merged.removeFromParent();
				const skin = new SkinnedMesh(merged.geometry, merged.material);
				skin.castShadow = merged.castShadow;
				skin.receiveShadow = merged.receiveShadow;
				// The pieces fly all over.
				skin.frustumCulled = false;
				shards.add(skin);
				skins.push(skin);
			}
			// So each part's vertices start where they're drawn now.
			shards.updateMatrixWorld(true);
			const inverses = bones.map((bone, i) =>
				new Matrix4()
					.copy(bone.matrixWorld)
					.invert()
					.multiply(placings[i]),
			);
			for (const bone of hidden) {
				bone.scale.setScalar(0);
			}
			const shattered = new Skeleton(bones, inverses);
			for (const skin of skins) {
				skin.bind(shattered, new Matrix4());
			}
			merges.length = 0;
			removeAnchors();
			// Anything left unmerged flies off as it is.
			for (const mesh of built) {
				if (!pieceOf.has(mesh)) {
					shards.attach(mesh);
				}
			}
			return {
				object: shards,
				pieces: built.map((mesh) => pieceOf.get(mesh) ?? mesh),
				dispose: () => {
					disposeObject(shards);
					for (const mesh of consumed) {
						disposeObject(mesh);
					}
					shattered.dispose();
				},
			};
		},
	};
};
