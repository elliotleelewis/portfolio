import {
	CylinderGeometry,
	Group,
	IcosahedronGeometry,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	TorusGeometry,
} from 'three';

import { type EasterEggInstance, type EasterEggShowcase } from './easter-eggs';

// The caption for an easter egg I've not found yet.
export const MYSTERY_CAPTION = '?????';

// How the gallery frames a mystery: straight on, looking up at the "?".
export const MYSTERY_SHOWCASE: EasterEggShowcase = {
	caption: MYSTERY_CAPTION,
	camera: [0, 1.8, 6.5],
	target: [0, 1.55, 0],
};

// Puffs of cloud around the base: [x, y, z, size].
const puffs: [number, number, number, number][] = [
	[0, 0.3, 0, 0.6],
	[-0.65, 0.25, 0.15, 0.48],
	[0.7, 0.24, 0.1, 0.5],
	[-0.3, 0.4, -0.45, 0.45],
	[0.35, 0.38, -0.4, 0.48],
	[-1.1, 0.15, -0.2, 0.35],
	[1.15, 0.14, -0.15, 0.35],
	[-0.25, 0.2, 0.6, 0.38],
	[0.35, 0.18, 0.55, 0.35],
];

/**
 * A stand-in for an easter egg I've not found yet: a big "?" bobbing over a
 * bank of cloud.
 * @returns The mystery, to stand where the easter egg would be.
 */
export const createMystery = (): EasterEggInstance => {
	const root = new Group();

	const mark = new Group();
	const material = new MeshStandardMaterial({
		color: '#f8f1dc',
		emissive: '#f5c451',
		emissiveIntensity: 0.25,
		roughness: 0.5,
		flatShading: true,
	});
	// The hook: three quarters of a ring, from the left round the top and
	// down to the bottom middle.
	const hook = new Mesh(
		new TorusGeometry(0.42, 0.13, 8, 24, Math.PI * 1.5),
		material,
	);
	hook.rotation.z = -Math.PI / 2;
	hook.position.y = 2.12;
	const stem = new Mesh(new CylinderGeometry(0.13, 0.13, 0.36, 8), material);
	stem.position.y = 1.53;
	const dot = new Mesh(new SphereGeometry(0.15, 12, 8), material);
	dot.position.y = 1.12;
	for (const mesh of [hook, stem, dot]) {
		mesh.castShadow = true;
		mark.add(mesh);
	}
	root.add(mark);

	const cloud = new Group();
	const puffMaterial = new MeshStandardMaterial({
		color: '#ffffff',
		roughness: 1,
		flatShading: true,
		transparent: true,
		opacity: 0.92,
	});
	const puffGeometry = new IcosahedronGeometry(1, 1);
	for (const [x, y, z, size] of puffs) {
		const puff = new Mesh(puffGeometry, puffMaterial);
		puff.position.set(x, y, z);
		puff.scale.setScalar(size);
		puff.rotation.set(x, y, z);
		cloud.add(puff);
	}
	root.add(cloud);

	return {
		object: root,
		update: ({ time }) => {
			// Bob and sway, mostly facing whoever's looking.
			mark.position.y = Math.sin(time * 1.6) * 0.08;
			mark.rotation.y = Math.sin(time * 0.8) * 0.5;
			cloud.rotation.y = time * 0.08;
			for (const [i, puff] of cloud.children.entries()) {
				const [, y, , size] = puffs[i];
				puff.scale.setScalar(
					size * (1 + Math.sin(time * 0.9 + i) * 0.04),
				);
				puff.position.y = y + Math.sin(time * 0.7 + i * 1.3) * 0.04;
			}
		},
	};
};
