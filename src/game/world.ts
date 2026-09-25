import {
	BufferAttribute,
	type BufferGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshLambertMaterial,
	PlaneGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Half-width of the part of the slope the player can roll over.
// The haze the mountainside fades into, and the sky behind it.
export const FOG_COLOR = new Color('#dde3e5');

export const LANE_HALF_WIDTH = 24;

// Length of each recycled strip of ground.
export const CHUNK_LENGTH = 120;

const chunkWidth = 200;

/**
 * Height of the terrain at a point, in slope-local coordinates. Gentle bumps
 * in the middle, rising into banks on either side.
 * @param x - Lateral position.
 * @param z - Position down the slope (negative is further down).
 * @returns The terrain height.
 */
export const terrainHeight = (x: number, z: number): number => {
	const bumps =
		0.12 * Math.sin(x * 0.21 + z * 0.13) +
		0.08 * Math.sin(x * 0.47 - z * 0.31) +
		0.06 * Math.sin(z * 0.73 + x * 0.11);
	const bank = Math.max(0, Math.abs(x) - LANE_HALF_WIDTH - 2);
	const rough =
		bank > 0
			? Math.sin(x * 0.17 + z * 0.09) * 1.5 + Math.sin(z * 0.23) * 1.2
			: 0;
	return (
		bumps +
		bank * bank * 0.035 +
		bank * 0.25 +
		rough * Math.min(1, bank / 8)
	);
};

const grass = new Color('#6d8448');
const scrub = new Color('#51683a');
const dirt = new Color('#8a7a5a');
const rock = new Color('#8b8f8c');

/**
 * Re-shapes a ground chunk so it continues the terrain around `centerZ`.
 * @param mesh - The chunk to re-shape.
 * @param centerZ - The chunk's new centre along the slope.
 */
export const shapeGroundChunk = (mesh: Mesh, centerZ: number): void => {
	mesh.position.z = centerZ;
	const geometry = mesh.geometry;
	const position = geometry.getAttribute('position');
	const color = geometry.getAttribute('color');
	const c = new Color();
	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i);
		const z = position.getZ(i) + centerZ;
		const y = terrainHeight(x, z);
		position.setY(i, y);
		const n = Math.sin(x * 1.3 + z * 0.7) * Math.sin(z * 1.1 - x * 0.4);
		c.copy(grass).lerp(scrub, (n + 1) / 2);
		if (n > 0.75) {
			c.lerp(dirt, 0.6);
		}
		const bank = Math.max(0, Math.abs(x) - LANE_HALF_WIDTH - 2);
		if (bank > 0) {
			c.lerp(rock, Math.min(0.7, bank / 30 + Math.max(0, n) * 0.3));
		}
		color.setXYZ(i, c.r, c.g, c.b);
	}
	position.needsUpdate = true;
	color.needsUpdate = true;
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();
};

/**
 * Creates a strip of ground. Its shape is set with {@link shapeGroundChunk}.
 * @param material - Shared ground material.
 * @param length - Length of the strip.
 * @returns The ground mesh.
 */
export const createGroundChunk = (
	material: MeshLambertMaterial,
	length = CHUNK_LENGTH,
): Mesh => {
	const geometry = new PlaneGeometry(
		chunkWidth,
		length,
		50,
		Math.round(length / 4),
	);
	geometry.rotateX(-Math.PI / 2);
	const colors = new Float32Array(
		geometry.getAttribute('position').count * 3,
	);
	geometry.setAttribute('color', new BufferAttribute(colors, 3));
	const mesh = new Mesh(geometry, material);
	mesh.receiveShadow = true;
	return mesh;
};

const paint = (geometry: BufferGeometry, color: string): BufferGeometry => {
	const c = new Color(color);
	const count = geometry.getAttribute('position').count;
	const colors = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		colors.set([c.r, c.g, c.b], i * 3);
	}
	geometry.setAttribute('color', new BufferAttribute(colors, 3));
	return geometry;
};

/**
 * Builds a conifer as a single geometry (trunk plus stacked cones), so each
 * tree costs one draw call.
 * @param tiers - Number of stacked cones.
 * @param height - Overall height.
 * @param radius - Radius of the lowest cone.
 * @returns The merged tree geometry.
 */
export const createTreeGeometry = (
	tiers: number,
	height: number,
	radius: number,
): BufferGeometry => {
	const parts: BufferGeometry[] = [
		paint(
			new CylinderGeometry(0.1, 0.2, height * 0.35, 6).translate(
				0,
				height * 0.175,
				0,
			),
			'#5a4230',
		),
	];
	const greens = ['#2f4f2a', '#3b5d30', '#456a36', '#3e6233'];
	const start = height * 0.2;
	const step = (height - start) / (tiers + 0.6);
	for (let i = 0; i < tiers; i++) {
		const r = radius * (1 - i / (tiers + 0.5));
		const h = step * 1.9;
		const cone = new ConeGeometry(r, h, 7);
		cone.translate(0, start + i * step + h / 2, 0);
		cone.rotateY(i * 0.9);
		parts.push(paint(cone, greens[i % greens.length] ?? '#3b5d30'));
	}
	const merged = mergeGeometries(parts);
	for (const part of parts) {
		part.dispose();
	}
	return merged;
};

/**
 * Builds a ring of hazy, snow-capped peaks that stays on the horizon.
 * @param fogColor - Colour the peaks fade toward with distance.
 * @returns A group of mountains centred on the origin.
 */
export const createMountains = (fogColor: Color): Group => {
	const group = new Group();
	const material = new MeshLambertMaterial({
		color: '#aeb6ba',
		vertexColors: true,
		flatShading: true,
		fog: false,
	});
	const rock = new Color('#59636b');
	const forest = new Color('#2c4631');
	const snow = new Color('#f4f6f7');
	const c = new Color();
	let seed = 7;
	const random = (): number => {
		seed = (seed * 16_807) % 2_147_483_647;
		return (seed - 1) / 2_147_483_646;
	};

	const peaks: [angle: number, distance: number, height: number][] = [];
	for (let i = 0; i < 26; i++) {
		peaks.push([
			(i / 26) * Math.PI * 2 + random() * 0.2,
			480 + random() * 260,
			150 + random() * 150,
		]);
	}
	// Big ridges either side of the opening shot, like the photo.
	peaks.push([Math.PI * 0.64, 420, 330], [Math.PI * 0.36, 560, 300]);

	const createPeak = (
		radius: number,
		height: number,
		haze: number,
	): BufferGeometry => {
		const geometry = new ConeGeometry(radius, height, 14, 8);
		const position = geometry.getAttribute('position');
		const phase = random() * 10;
		const colors = new Float32Array(position.count * 3);
		for (let i = 0; i < position.count; i++) {
			const x = position.getX(i);
			const z = position.getZ(i);
			const t = position.getY(i) / height + 0.5;
			// Ridges and gullies; a function of angle so the seam stays closed.
			const theta = Math.atan2(z, x);
			const ridges =
				1 +
				0.14 * Math.sin(3 * theta + phase) +
				0.08 * Math.sin(7 * theta + phase * 2) * (1 - t);
			position.setX(i, x * ridges);
			position.setZ(i, z * ridges);
			const noise = Math.sin(theta * 5 + phase + t * 9) * 0.08;
			if (t + noise > 0.86) {
				c.copy(snow);
			} else if (t + noise < 0.55) {
				c.copy(forest);
			} else {
				c.copy(rock);
			}
			c.lerp(fogColor, haze + t * 0.15);
			colors.set([c.r, c.g, c.b], i * 3);
		}
		geometry.setAttribute('color', new BufferAttribute(colors, 3));
		geometry.rotateY(random() * Math.PI);
		return geometry;
	};

	// Each mountain is a massif: a main summit flanked by lower shoulders.
	const parts: BufferGeometry[] = [];
	for (const [angle, distance, height] of peaks) {
		const haze = Math.min(0.6, 0.1 + distance / 1800);
		const radius = Math.min(
			height * (0.8 + random() * 0.4),
			distance * 0.45,
		);
		const x = Math.cos(angle) * distance;
		const z = -Math.sin(angle) * distance;
		// Perpendicular to the line of sight, so shoulders widen the skyline.
		const sideX = Math.sin(angle);
		const sideZ = Math.cos(angle);
		for (const [offset, scale] of [
			[0, 1],
			[-0.6, 0.55 + random() * 0.2],
			[0.65, 0.5 + random() * 0.25],
		] as const) {
			const h = height * scale;
			parts.push(
				createPeak(radius * (0.6 + scale * 0.4), h, haze).translate(
					x + sideX * radius * offset,
					h / 2 - 150,
					z + sideZ * radius * offset,
				),
			);
		}
	}
	const geometry = mergeGeometries(parts);
	for (const part of parts) {
		part.dispose();
	}
	geometry.computeVertexNormals();
	group.add(new Mesh(geometry, material));
	return group;
};
