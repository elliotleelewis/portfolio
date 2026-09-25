import {
	BufferAttribute,
	Color,
	Group,
	Mesh,
	MeshLambertMaterial,
	PlaneGeometry,
} from 'three';

import { GALLERY_SPACING } from './gallery';
import { createTreeGeometry } from './world';

// How many trees to scatter around the row (before leaving it open).
const treeCount = 260;

/**
 * The clearing the easter eggs stand in: flat along the row, gently rolling
 * elsewhere.
 * @param count - How many easter eggs are in the row.
 * @returns The ground.
 */
export const createGalleryGround = (count: number): Mesh => {
	const geometry = new PlaneGeometry(
		count * GALLERY_SPACING + 200,
		240,
		90,
		60,
	);
	geometry.rotateX(-Math.PI / 2);
	geometry.translate(((count - 1) * GALLERY_SPACING) / 2, 0, -40);
	const position = geometry.getAttribute('position');
	const colors = new Float32Array(position.count * 3);
	const grass = new Color('#6d8448');
	const scrub = new Color('#51683a');
	const c = new Color();
	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i);
		const z = position.getZ(i);
		// Flat where the easter eggs stand; gently rolling elsewhere.
		const bumps = Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.3);
		position.setY(i, z < -12 || z > 16 ? bumps * 0.6 - 0.05 : -0.02);
		const n = Math.sin(x * 1.3 + z * 0.7) * Math.sin(z * 1.1 - x * 0.4);
		c.copy(grass).lerp(scrub, (n + 1) / 2);
		colors.set([c.r, c.g, c.b], i * 3);
	}
	geometry.setAttribute('color', new BufferAttribute(colors, 3));
	geometry.computeVertexNormals();
	const mesh = new Mesh(
		geometry,
		new MeshLambertMaterial({ vertexColors: true, flatShading: true }),
	);
	mesh.receiveShadow = true;
	return mesh;
};

/**
 * Forest behind and around the row, leaving each easter egg (and the
 * camera's path) in the open. Always the same trees, in the same places.
 * @param count - How many easter eggs are in the row.
 * @returns The trees.
 */
export const createGalleryTrees = (count: number): Group => {
	const group = new Group();
	const geometries = [
		createTreeGeometry(6, 8, 1.5),
		createTreeGeometry(5, 6.5, 1.7),
		createTreeGeometry(8, 11, 1.4),
	];
	const materials = ['#ffffff', '#dfe8d4', '#c9d6c2'].map(
		(color) =>
			new MeshLambertMaterial({
				color,
				vertexColors: true,
				flatShading: true,
			}),
	);
	const end = (count - 1) * GALLERY_SPACING;
	let seed = 11;
	const random = (): number => {
		seed = (seed * 16_807) % 2_147_483_647;
		return (seed - 1) / 2_147_483_646;
	};
	for (let i = 0; i < treeCount; i++) {
		const x = -40 + random() * (end + 80);
		const z = -70 + random() * 110;
		const isNearRow = z > -9 && z < 14;
		const isNearEnd = x < -8 || x > end + 8;
		// Keep the row itself (and the camera's path) open, save for a few
		// trees between easter eggs.
		if (isNearRow && !isNearEnd) {
			const gap = Math.abs(
				((x + GALLERY_SPACING / 2) % GALLERY_SPACING) -
					GALLERY_SPACING / 2,
			);
			if (gap < GALLERY_SPACING / 2 - 1.5 || z > 0) {
				continue;
			}
		}
		const tree = new Mesh(
			geometries[i % geometries.length],
			materials[i % materials.length],
		);
		tree.position.set(x, -0.1, z);
		tree.scale.setScalar(0.8 + random() * 0.5);
		tree.rotation.y = random() * Math.PI * 2;
		tree.castShadow = true;
		group.add(tree);
	}
	return group;
};
