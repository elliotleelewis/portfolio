import {
	type BufferGeometry,
	CanvasTexture,
	CapsuleGeometry,
	Group,
	type Material,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	Sprite,
	SpriteMaterial,
} from 'three';

/**
Height of a bear's middle above the ground when on all fours.
 */
export const BEAR_STANDING_HEIGHT = 0.74;

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
	// The same badge, pinned to the edge of the view (so a constant size).
	pin: SpriteMaterial;
	geometries: Record<
		| 'body'
		| 'hump'
		| 'head'
		| 'snout'
		| 'ear'
		| 'nose'
		| 'glint'
		| 'leg'
		| 'paw',
		BufferGeometry
	>;
}

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

/**
 * Creates the geometry and materials shared by every bear in a game.
 * @returns The shared parts.
 */
export const createBearParts = (): BearParts => {
	const badge = alertTexture();
	return {
		fur: new MeshStandardMaterial({ color: '#1f1b19', roughness: 0.95 }),
		muzzle: new MeshStandardMaterial({ color: '#8a6a4c', roughness: 0.9 }),
		nose: new MeshStandardMaterial({ color: '#0b0b0b', roughness: 0.4 }),
		glint: new MeshStandardMaterial({
			color: '#ffffff',
			emissive: '#ffffff',
			emissiveIntensity: 0.4,
		}),
		alert: new SpriteMaterial({ map: badge, depthTest: false }),
		pin: new SpriteMaterial({
			map: badge,
			depthTest: false,
			sizeAttenuation: false,
		}),
		geometries: {
			body: new SphereGeometry(1, 18, 12),
			hump: new SphereGeometry(0.36, 14, 10),
			head: new SphereGeometry(0.27, 16, 12),
			snout: new SphereGeometry(0.13, 12, 8),
			ear: new SphereGeometry(0.08, 8, 6),
			nose: new SphereGeometry(0.05, 8, 6),
			glint: new SphereGeometry(0.028, 6, 4),
			leg: new CapsuleGeometry(0.12, 0.42, 4, 8),
			paw: new SphereGeometry(0.13, 10, 6),
		},
	};
};

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
		x: number,
		y: number,
		z: number,
	): Mesh => {
		const mesh = new Mesh(geometry, material);
		mesh.position.set(x, y, z);
		mesh.castShadow = true;
		parent.add(mesh);
		return mesh;
	};

	const pose = new Group();
	add(pose, geometries.body, fur, 0, 0, 0).scale.set(0.42, 0.44, 0.78);
	add(pose, geometries.hump, fur, 0, 0.14, 0.42);

	const head = new Group();
	head.position.set(0, 0.2, 0.86);
	add(head, geometries.head, fur, 0, 0, 0).scale.set(0.95, 0.88, 1);
	add(head, geometries.snout, muzzle, 0, -0.07, 0.25).scale.set(
		0.85,
		0.75,
		1.2,
	);
	add(head, geometries.nose, nose, 0, -0.02, 0.4);
	for (const side of [-1, 1]) {
		add(head, geometries.ear, fur, side * 0.17, 0.22, -0.04);
		add(head, geometries.glint, glint, side * 0.1, 0.08, 0.22);
	}
	pose.add(head);

	const legs = [
		[0.22, 0.46],
		[-0.22, 0.46],
		[0.22, -0.46],
		[-0.22, -0.46],
	].map(([x = 0, z = 0]) => {
		const leg = new Group();
		leg.position.set(x, -0.12, z);
		add(leg, geometries.leg, fur, 0, -0.3, 0);
		add(leg, geometries.paw, fur, 0, -0.52, 0.04).scale.set(1, 0.6, 1.3);
		pose.add(leg);
		return leg;
	});

	const sprite = new Sprite(alert);
	sprite.scale.setScalar(0.9);
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
	parts.pin.dispose();
	for (const material of [parts.fur, parts.muzzle, parts.nose, parts.glint]) {
		material.dispose();
	}
};
