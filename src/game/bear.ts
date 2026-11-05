import {
	type BufferGeometry,
	CanvasTexture,
	CylinderGeometry,
	Group,
	IcosahedronGeometry,
	type Material,
	Matrix4,
	Mesh,
	Quaternion,
	Sprite,
	SpriteMaterial,
	Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { fold, steadyRandom } from './look/paper';
import { surface } from './look/surfaces';

/**
Height of a bear's middle above the ground when on all fours.
 */
export const BEAR_STANDING_HEIGHT = 0.74;

/**
 * Size of the "!" over a bear that has spotted me.
 */
export const BEAR_ALERT_SIZE = 0.9;

/**
 * Distance from a tree trunk's axis to a climbing bear's middle.
 */
export const BEAR_TRUNK_OFFSET = 0.58;

export interface Bear {
	/**
	Positioned on the slope; yaw sets which way the bear faces.
	 */
	root: Group;
	/**
	Pitches the whole body: 0 on all fours, -π/2 hugging a trunk.
	 */
	pose: Group;
	head: Group;
	/**
	Front-left, front-right, back-left, back-right.
	 */
	legs: Group[];
	/**
	A "!" shown when the bear spots me.
	 */
	alert: Sprite;
}

export interface BearParts {
	fur: Material;
	muzzle: Material;
	nose: Material;
	glint: Material;
	alert: SpriteMaterial;
	// Each part of a bear that moves as one and shares a material is a single
	// geometry, so it's a single draw call.
	geometries: Record<
		'body' | 'head' | 'snout' | 'nose' | 'glints' | 'leg',
		BufferGeometry
	>;
}

// A piece of a bear's geometry, and where it sits in its part.
interface Piece {
	geometry: BufferGeometry;
	at: [number, number, number];
	scale?: [number, number, number];
}

/**
 * Joins pieces of a bear into one geometry, each moved into place. Frees
 * the pieces.
 * @param pieces - The pieces.
 * @returns The joined geometry.
 */
const join = (...pieces: Piece[]): BufferGeometry => {
	const matrix = new Matrix4();
	const placed = pieces.map(({ geometry, at, scale = [1, 1, 1] }) =>
		(geometry.index
			? geometry.toNonIndexed()
			: geometry.clone()
		).applyMatrix4(
			matrix.compose(
				new Vector3(...at),
				new Quaternion(),
				new Vector3(...scale),
			),
		),
	);
	const joined = mergeGeometries(placed);
	for (const geometry of [...placed, ...pieces.map((p) => p.geometry)]) {
		geometry.dispose();
	}
	// Folded as paper, each fold a little lighter or darker: more than most
	// paper, so it shows on black fur.
	return fold(joined, [1, 1, 1], 0.14, folds);
};

// Where the bears' folds' shades come from: the same for every bear.
const folds = steadyRandom(9);

const alertTexture = (): CanvasTexture => {
	const canvas = document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 64;
	const context = canvas.getContext('2d');
	if (context) {
		context.fillStyle = '#dc2626';
		context.beginPath();
		context.arc(32, 32, 28, 0, Math.PI * 2);
		context.fill();
		context.fillStyle = '#ffffff';
		context.font = 'bold 44px system-ui, sans-serif';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText('!', 32, 35);
	}
	return new CanvasTexture(canvas);
};

// Coloured by their folds, as well as their paper.
const paper = { vertexColors: true };

/**
 * Creates the geometry and materials shared by every bear in a game: folded
 * paper, its balls faceted (80 faces for the body and head, 20 for the
 * rest) and its legs six-sided (models/README.md, "The style").
 * @returns The shared parts.
 */
export const createBearParts = (): BearParts => ({
	fur: surface('#1f1b19', 'matte', paper),
	muzzle: surface('#8a6a4c', 'matte', paper),
	// Wet.
	nose: surface('#0b0b0b', 'gloss', paper),
	glint: surface('#ffffff', 'gloss', {
		...paper,
		emissive: '#ffffff',
		emissiveIntensity: 0.4,
	}),
	alert: new SpriteMaterial({ map: alertTexture(), depthTest: false }),
	geometries: {
		body: join(
			{
				geometry: new IcosahedronGeometry(1, 1),
				at: [0, 0, 0],
				scale: [0.42, 0.44, 0.78],
			},
			{ geometry: new IcosahedronGeometry(0.36, 1), at: [0, 0.14, 0.42] },
		),
		head: join(
			{
				geometry: new IcosahedronGeometry(0.27, 1),
				at: [0, 0, 0],
				scale: [0.95, 0.88, 1],
			},
			...[-1, 1].map((side): Piece => ({
				geometry: new IcosahedronGeometry(0.08),
				at: [side * 0.17, 0.22, -0.04],
			})),
		),
		snout: join({
			geometry: new IcosahedronGeometry(0.13),
			at: [0, -0.07, 0.25],
			scale: [0.85, 0.75, 1.2],
		}),
		nose: join({
			geometry: new IcosahedronGeometry(0.05),
			at: [0, -0.02, 0.4],
		}),
		glints: join(
			...[-1, 1].map((side): Piece => ({
				geometry: new IcosahedronGeometry(0.028),
				at: [side * 0.1, 0.08, 0.22],
			})),
		),
		leg: join(
			{
				// Down to the ground, flat-footed.
				geometry: new CylinderGeometry(0.12, 0.11, 0.6, 6),
				at: [0, -0.33, 0],
			},
			{
				geometry: new IcosahedronGeometry(0.13),
				at: [0, -0.56, 0.04],
				scale: [1, 0.6, 1.3],
			},
		),
	},
});

/**
 * Builds a low-poly black bear, facing +z, centred on its belly.
 * @param parts - Shared geometry and materials, from {@link createBearParts}.
 * @returns The bear rig.
 */
export const createBear = (parts: BearParts): Bear => {
	const { fur, muzzle, nose, glint, alert, geometries } = parts;
	const add = (
		parent: Group,
		geometry: BufferGeometry,
		material: Material,
	): void => {
		const mesh = new Mesh(geometry, material);
		mesh.castShadow = true;
		parent.add(mesh);
	};

	const pose = new Group();
	add(pose, geometries.body, fur);

	const head = new Group();
	head.position.set(0, 0.2, 0.86);
	add(head, geometries.head, fur);
	add(head, geometries.snout, muzzle);
	add(head, geometries.nose, nose);
	add(head, geometries.glints, glint);
	pose.add(head);

	const legs = [
		[0.22, 0.46],
		[-0.22, 0.46],
		[0.22, -0.46],
		[-0.22, -0.46],
	].map(([x = 0, z = 0]) => {
		const leg = new Group();
		leg.position.set(x, -0.12, z);
		add(leg, geometries.leg, fur);
		pose.add(leg);
		return leg;
	});

	const sprite = new Sprite(alert);
	sprite.scale.setScalar(BEAR_ALERT_SIZE);
	sprite.visible = false;
	sprite.renderOrder = 10;

	const root = new Group();
	root.add(pose, sprite);
	return { root, pose, head, legs, alert: sprite };
};

/**
 * Frees the shared bear parts that aren't reachable as meshes in a scene
 * (each bear may draw with its own copies of the materials).
 * @param parts - The shared parts.
 */
export const disposeBearParts = (parts: BearParts): void => {
	parts.alert.map?.dispose();
	parts.alert.dispose();
	for (const material of [parts.fur, parts.muzzle, parts.nose, parts.glint]) {
		material.dispose();
	}
};
