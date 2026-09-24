import {
	BackSide,
	BoxGeometry,
	CapsuleGeometry,
	CircleGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	MathUtils,
	type Mesh,
	type MeshStandardMaterial,
	type Object3D,
	SphereGeometry,
	TorusGeometry,
	Vector3,
} from 'three';

import { canvasTexture, joint, part, standard } from './parts';
import { type EasterEgg, type EasterEggFrame } from './types';

// How close I get before he goes into overdrive and lights it.
const triggerDistance = 65;
// The stove sits at the origin, door facing +z; Tyler crouches beside it,
// on its left, turned to the door.
const tylerX = -0.72;
const tylerZ = 0.5;
const tylerFacing = 1.9;
const stickCount = 8;
const stickLength = 0.5;
// Seconds per stick while I'm far off, and once he's in a hurry.
const stackInterval = 1;
const hurriedInterval = 0.3;
// After the trigger: when he strikes the light, and when it catches.
const lightAt = 1.1;
const catchAt = 1.9;
const emberCount = 18;
const smokeCount = 6;

interface Tyler {
	root: Group;
	body: Group;
	upper: Group;
	head: Group;
	arms: { shoulder: Group; elbow: Group; wrist: Group }[];
	legs: { hip: Group; knee: Group }[];
	smile: Mesh;
	shout: Mesh;
	stick: Mesh;
}

// Tyler: a heathered oatmeal beanie over wavy dark hair, light stubble, a
// black quarter-zip, a silver chain and a black backpack.
const buildTyler = (parent: Object3D): Tyler => {
	const skin = standard('#f0c9ae');
	const hair = standard('#2e1e15', { roughness: 0.6 });
	const stubble = standard('#3a281c', { transparent: true, opacity: 0.3 });
	const fleece = standard('#17181a', { roughness: 0.9 });
	const joggers = standard('#2b2d31');
	const boots = standard('#4b3a2c');
	const strap = standard('#26272b');
	const chain = standard('#d9dcdf', { metalness: 0.9, roughness: 0.25 });
	const eye = standard('#2f4f6f');
	const brow = standard('#2e1e15');
	const mouth = standard('#6e3432');
	const beanie = standard('#ffffff', {
		roughness: 1,
		map: canvasTexture(128, 64, (context) => {
			// Heathered knit: oatmeal flecked with light and dark.
			context.fillStyle = '#c9b6a2';
			context.fillRect(0, 0, 128, 64);
			for (let i = 0; i < 700; i++) {
				context.fillStyle = i % 3 === 0 ? '#e8ddd0' : '#a8927d';
				context.fillRect((i * 37) % 128, (i * 23) % 64, 2, 3);
			}
			// Ribbing.
			context.fillStyle = 'rgba(0, 0, 0, 0.06)';
			for (let x = 0; x < 128; x += 4) {
				context.fillRect(x, 0, 1, 64);
			}
		}),
	});

	const root = joint(parent, [0, 0, 0]);
	const body = joint(root, [0, 0, 0]);
	const legs = [-1, 1].map((side) => {
		const hip = joint(body, [side * 0.11, 0.92, 0]);
		part(hip, new CapsuleGeometry(0.08, 0.3, 4, 10), joggers, [0, -0.2, 0]);
		const knee = joint(hip, [0, -0.42, 0]);
		part(
			knee,
			new CapsuleGeometry(0.07, 0.32, 4, 10),
			joggers,
			[0, -0.2, 0],
		);
		part(knee, new BoxGeometry(0.12, 0.1, 0.27), boots, [0, -0.44, 0.04]);
		return { hip, knee };
	});
	part(
		body,
		new CylinderGeometry(0.2, 0.19, 0.16, 16),
		joggers,
		[0, 0.94, 0],
	);

	const upper = joint(body, [0, 0.95, 0]);
	const torso = part(
		upper,
		new CylinderGeometry(0.22, 0.2, 0.56, 16),
		fleece,
		[0, 0.26, 0],
	);
	torso.scale.z = 0.66;
	part(
		upper,
		new SphereGeometry(0.22, 16, 8),
		fleece,
		[0, 0.51, 0],
	).scale.set(1, 0.35, 0.66);
	// Quarter-zip collar, zip, chain.
	const collar = part(
		upper,
		new CylinderGeometry(0.075, 0.09, 0.08, 14, 1, true),
		fleece,
		[0, 0.57, 0],
	);
	collar.scale.z = 0.9;
	part(
		upper,
		new BoxGeometry(0.008, 0.2, 0.008),
		standard('#56585c'),
		[0, 0.44, 0.148],
	);
	const necklace = part(
		upper,
		new TorusGeometry(0.07, 0.004, 6, 18),
		chain,
		[0, 0.54, 0.05],
	);
	necklace.rotation.x = Math.PI / 2 - 0.9;
	// Backpack and straps.
	part(upper, new BoxGeometry(0.34, 0.42, 0.15), strap, [0, 0.28, -0.22]);
	for (const side of [-1, 1]) {
		part(upper, new BoxGeometry(0.05, 0.44, 0.02), strap, [
			side * 0.13,
			0.3,
			0.146,
		]);
	}

	const arms = [-1, 1].map((side) => {
		const shoulder = joint(upper, [side * 0.245, 0.5, 0]);
		part(
			shoulder,
			new CapsuleGeometry(0.068, 0.2, 4, 10),
			fleece,
			[0, -0.14, 0],
		);
		const elbow = joint(shoulder, [0, -0.29, 0]);
		part(
			elbow,
			new CapsuleGeometry(0.058, 0.18, 4, 10),
			fleece,
			[0, -0.12, 0],
		);
		const wrist = joint(elbow, [0, -0.26, 0]);
		part(
			wrist,
			new SphereGeometry(0.052, 10, 8),
			skin,
			[0, -0.04, 0],
		).scale.set(0.85, 1.1, 0.6);
		return { shoulder, elbow, wrist };
	});
	// The stick he's carrying to the pile.
	const stick = part(
		arms[1]?.wrist ?? upper,
		new CylinderGeometry(0.022, 0.026, stickLength, 6),
		standard('#6a4b2f', { roughness: 0.95 }),
		[0, -0.06, 0],
	);
	stick.rotation.x = Math.PI / 2;

	part(upper, new CylinderGeometry(0.052, 0.058, 0.1, 12), skin, [0, 0.6, 0]);
	const head = joint(upper, [0, 0.63, 0]);
	part(head, new SphereGeometry(0.118, 22, 16), skin, [0, 0.13, 0]).scale.set(
		0.9,
		1.14,
		1,
	);
	for (const side of [-1, 1]) {
		part(head, new SphereGeometry(0.027, 10, 8), skin, [
			side * 0.106,
			0.13,
			0,
		]).scale.set(0.5, 1, 0.8);
		part(head, new SphereGeometry(0.012, 8, 6), eye, [
			side * 0.042,
			0.145,
			0.105,
		]).scale.y = 0.75;
		part(head, new BoxGeometry(0.05, 0.011, 0.012), brow, [
			side * 0.043,
			0.178,
			0.107,
		]).rotation.z = side * -0.06;
	}
	part(head, new SphereGeometry(0.019, 8, 6), skin, [0, 0.12, 0.121]);
	// A calm, closed smile; swapped for a shout when it catches.
	const smile = part(
		head,
		new BoxGeometry(0.05, 0.008, 0.008),
		mouth,
		[0, 0.083, 0.112],
	);
	const shout = part(
		head,
		new CircleGeometry(0.026, 14),
		mouth,
		[0, 0.078, 0.114],
	);
	shout.scale.y = 1.2;
	shout.visible = false;
	const jaw = part(
		head,
		new SphereGeometry(
			0.112,
			18,
			10,
			-Math.PI * 0.1,
			Math.PI * 1.2,
			Math.PI * 0.55,
			Math.PI * 0.4,
		),
		stubble,
		[0, 0.13, 0.004],
	);
	jaw.scale.set(0.93, 1.14, 1);
	jaw.castShadow = false;

	// Wavy dark hair escaping the beanie: a fringe, the sides, the nape.
	const lock = new CapsuleGeometry(0.013, 0.1, 3, 6);
	for (const [x, y, z, pitch, tilt] of [
		// Fringe, falling over his forehead from under the cuff.
		[-0.06, 0.165, 0.103, -0.35, 0.45],
		[-0.03, 0.16, 0.112, -0.3, 0.2],
		[0.005, 0.162, 0.113, -0.3, -0.15],
		[0.04, 0.165, 0.106, -0.35, -0.4],
		// Over the ears.
		[-0.106, 0.12, 0.02, 0, 0.12],
		[0.106, 0.12, 0.02, 0, -0.12],
		// Curling out at the nape.
		[-0.08, 0.08, -0.085, 0.4, 0.35],
		[0, 0.07, -0.105, 0.45, 0],
		[0.08, 0.08, -0.085, 0.4, -0.35],
	] as const) {
		const piece = part(head, lock, hair, [x, y, z]);
		piece.rotation.set(pitch, 0, tilt);
	}
	// The beanie, with a folded cuff and a little tag.
	const crown = part(
		head,
		new SphereGeometry(0.132, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
		beanie,
		[0, 0.19, -0.005],
	);
	crown.scale.set(0.97, 1.05, 1.03);
	const cuff = part(
		head,
		new CylinderGeometry(0.133, 0.135, 0.07, 22),
		beanie,
		[0, 0.195, -0.005],
	);
	cuff.scale.set(0.98, 1, 1.04);
	cuff.rotation.x = -0.08;
	part(
		head,
		new BoxGeometry(0.004, 0.025, 0.02),
		standard('#141414'),
		[0.131, 0.2, -0.02],
	);

	return { root, body, upper, head, arms, legs, smile, shout, stick };
};

// A black cast-iron cabin wood stove on a slate hearth, with a stovepipe
// chimney. Its door faces +z, hinged on the right.
const buildStove = (
	parent: Object3D,
): {
	sticks: Mesh[];
	door: Group;
	flameGroup: Group;
	flames: Mesh[];
	glass: MeshStandardMaterial;
	glow: MeshStandardMaterial;
	spark: Mesh;
	embers: { mesh: Mesh; age: number; drift: Vector3 }[];
	smoke: { mesh: Mesh; material: MeshStandardMaterial; age: number }[];
	chimneyTop: number;
} => {
	const iron = standard('#1b1c1e', { metalness: 0.55, roughness: 0.55 });
	const ironDark = standard('#101112', { metalness: 0.4, roughness: 0.7 });
	// Only its inside faces, so it doesn't hide the fire from the front.
	const firebox = standard('#0b0908', { roughness: 1, side: BackSide });
	const steel = standard('#b9bec4', { metalness: 0.9, roughness: 0.3 });
	const slate = standard('#4a4f55', { roughness: 0.9 });
	const wood = standard('#6a4b2f', { roughness: 0.95 });
	const woodLight = standard('#8b6843', { roughness: 0.95 });

	// Slate hearth pad.
	part(parent, new BoxGeometry(1.1, 0.04, 1.1), slate, [0, 0.02, 0.1]);

	// Legs, then the firebox: panels round an opening at the front.
	for (const x of [-0.24, 0.24]) {
		for (const z of [-0.19, 0.19]) {
			part(parent, new BoxGeometry(0.06, 0.18, 0.06), iron, [x, 0.13, z]);
		}
	}
	const width = 0.62;
	const height = 0.56;
	const depth = 0.5;
	const bottom = 0.22;
	const middle = bottom + height / 2;
	const panel = (
		size: [number, number, number],
		position: [number, number, number],
	): void => {
		part(parent, new BoxGeometry(...size), iron, position);
	};
	panel([width, 0.04, depth], [0, bottom, 0]);
	panel([width, 0.04, depth], [0, bottom + height, 0]);
	panel([width, height, 0.04], [0, middle, -depth / 2]);
	panel([0.04, height, depth], [-width / 2, middle, 0]);
	panel([0.04, height, depth], [width / 2, middle, 0]);
	// Front frame round the door opening.
	const openingWidth = 0.38;
	const openingHeight = 0.3;
	const openingY = middle - 0.02;
	const side = (width - openingWidth) / 2;
	for (const x of [-1, 1]) {
		panel(
			[side, height, 0.04],
			[x * (width / 2 - side / 2), middle, depth / 2],
		);
	}
	panel(
		[openingWidth, openingY - openingHeight / 2 - bottom, 0.04],
		[0, (bottom + openingY - openingHeight / 2) / 2, depth / 2],
	);
	panel(
		[openingWidth, bottom + height - openingY - openingHeight / 2, 0.04],
		[0, (bottom + height + openingY + openingHeight / 2) / 2, depth / 2],
	);
	// Sooty lining inside.
	part(
		parent,
		new BoxGeometry(width - 0.06, height - 0.06, depth - 0.06),
		firebox,
		[0, middle, -0.005],
	).scale.z = 0.98;
	// Cast-iron details: a lipped top plate, ribs down the sides.
	part(parent, new BoxGeometry(width + 0.06, 0.035, depth + 0.06), ironDark, [
		0,
		bottom + height + 0.035,
		0,
	]);
	for (const x of [-1, 1]) {
		for (let i = 0; i < 3; i++) {
			part(parent, new BoxGeometry(0.02, height - 0.1, 0.03), ironDark, [
				x * (width / 2 + 0.01),
				middle,
				-0.15 + i * 0.15,
			]);
		}
	}

	// Logs, fed in one at a time.
	const logGeometry = new CylinderGeometry(0.03, 0.034, 0.44, 7);
	const sticks = Array.from({ length: stickCount }, (_, i) => {
		const layer = Math.floor(i / 4);
		const log = part(parent, logGeometry, i % 3 === 0 ? woodLight : wood, [
			-0.15 + (i % 4) * 0.1,
			bottom + 0.05 + layer * 0.06,
			-0.02 + (layer % 2) * 0.04,
		]);
		log.rotation.set(Math.PI / 2, 0, (i % 2) * 0.15);
		log.visible = false;
		return log;
	});

	// Flames in the firebox, hidden until it catches.
	const flameGroup = joint(parent, [0, bottom + 0.1, 0]);
	flameGroup.scale.setScalar(0.001);
	const flames = (
		[
			['#ff4d00', 0.07, 0.3, 0.85, 0.12, 5],
			['#ff9a1a', 0.05, 0.24, 0.9, 0.08, 4],
			['#ffe066', 0.035, 0.16, 0.95, 0.03, 3],
		] as const
	).flatMap(([color, radius, flameHeight, opacity, spread, count]) => {
		const material = standard(color, {
			emissive: color,
			emissiveIntensity: 1.8,
			transparent: true,
			opacity,
			depthWrite: false,
		});
		const geometry = new ConeGeometry(
			radius,
			flameHeight,
			7,
			1,
			true,
		).translate(0, flameHeight / 2, 0);
		return Array.from({ length: count }, (_, i) => {
			const tongue = part(flameGroup, geometry, material, [
				-spread + ((i + 0.5) / count) * spread * 2,
				0,
				(i % 2) * 0.05 - 0.02,
			]);
			tongue.castShadow = false;
			return tongue;
		});
	});

	// The door: a glass window and a steel handle. Swings open to the right.
	const door = joint(parent, [
		openingWidth / 2 + 0.01,
		openingY,
		depth / 2 + 0.03,
	]);
	// A frame round the window, so you can see into the firebox.
	const doorWidth = openingWidth + 0.04;
	const doorHeight = openingHeight + 0.04;
	const bar = 0.06;
	for (const y of [-1, 1]) {
		part(door, new BoxGeometry(doorWidth, bar, 0.025), iron, [
			-doorWidth / 2,
			y * (doorHeight / 2 - bar / 2),
			0,
		]);
	}
	for (const x of [0, 1]) {
		part(door, new BoxGeometry(bar, doorHeight - bar * 2, 0.025), iron, [
			-bar / 2 - x * (doorWidth - bar),
			0,
			0,
		]);
	}
	// Smoked glass: see-through, so the flames show, with a warm tint once
	// it's burning.
	const glass = standard('#2a1a10', {
		emissive: '#ff6a10',
		emissiveIntensity: 0,
		roughness: 0.1,
		metalness: 0.2,
		transparent: true,
		opacity: 0.45,
		depthWrite: false,
	});
	part(
		door,
		new BoxGeometry(openingWidth - 0.06, openingHeight - 0.06, 0.006),
		glass,
		[-(openingWidth + 0.04) / 2, 0, 0.013],
	).castShadow = false;
	part(door, new CylinderGeometry(0.012, 0.012, 0.12, 8), steel, [
		-openingWidth - 0.005,
		0,
		0.035,
	]);

	// Stovepipe chimney, a damper handle, and a rain cap on top.
	const pipeTop = 2.7;
	const pipeBottom = bottom + height + 0.05;
	part(
		parent,
		new CylinderGeometry(0.075, 0.075, pipeTop - pipeBottom, 16),
		iron,
		[0, (pipeTop + pipeBottom) / 2, -0.1],
	);
	for (const y of [pipeBottom + 0.02, pipeBottom + 0.7, pipeBottom + 1.4]) {
		part(parent, new CylinderGeometry(0.082, 0.082, 0.03, 16), ironDark, [
			0,
			y,
			-0.1,
		]);
	}
	part(parent, new BoxGeometry(0.2, 0.015, 0.015), steel, [
		0.08,
		pipeBottom + 0.35,
		-0.1,
	]);
	part(parent, new ConeGeometry(0.16, 0.1, 16), ironDark, [
		0,
		pipeTop + 0.1,
		-0.1,
	]);
	for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
		part(parent, new BoxGeometry(0.012, 0.08, 0.012), ironDark, [
			Math.cos(angle) * 0.07,
			pipeTop + 0.03,
			-0.1 + Math.sin(angle) * 0.07,
		]);
	}

	// Warm light spilling out onto the hearth.
	const glowMaterial = standard('#ff7a1a', {
		emissive: '#ff6a00',
		emissiveIntensity: 1,
		transparent: true,
		opacity: 0,
		depthWrite: false,
	});
	const glow = part(
		parent,
		new CircleGeometry(0.35, 20),
		glowMaterial,
		[0, 0.045, 0.45],
	);
	glow.rotation.x = -Math.PI / 2;
	glow.castShadow = false;
	glow.receiveShadow = false;

	// The spark as he lights it, just inside the door.
	const spark = part(
		parent,
		new SphereGeometry(0.03, 8, 6),
		standard('#fff2a8', { emissive: '#ffd24d', emissiveIntensity: 3 }),
		[0, bottom + 0.1, 0.12],
	);
	spark.castShadow = false;
	spark.visible = false;

	// Sparks and smoke out of the top of the chimney.
	const emberGeometry = new BoxGeometry(0.02, 0.02, 0.02);
	const emberMaterial = standard('#ffb347', {
		emissive: '#ff7a00',
		emissiveIntensity: 2,
	});
	const embers = Array.from({ length: emberCount }, (_, i) => {
		const mesh = part(parent, emberGeometry, emberMaterial, [0, 0, 0]);
		mesh.castShadow = false;
		mesh.visible = false;
		return {
			mesh,
			age: (i / emberCount) * 1.6,
			drift: new Vector3(
				MathUtils.randFloatSpread(0.5),
				MathUtils.randFloat(0.6, 1.1),
				MathUtils.randFloatSpread(0.5),
			),
		};
	});
	const puff = new SphereGeometry(0.09, 8, 6);
	const smoke = Array.from({ length: smokeCount }, (_, i) => {
		const material = standard('#9ea3a8', {
			transparent: true,
			opacity: 0,
			depthWrite: false,
		});
		const mesh = part(parent, puff, material, [0, 0, 0]);
		mesh.castShadow = false;
		return { mesh, material, age: (i / smokeCount) * 3 };
	});

	// Spare logs piled up beside him.
	const spareGeometry = new CylinderGeometry(0.03, 0.034, 0.5, 7);
	for (let i = 0; i < 6; i++) {
		const spare = part(
			parent,
			spareGeometry,
			i % 2 === 0 ? wood : woodLight,
			[
				tylerX - 0.05 + (i % 3) * 0.075,
				0.035 + Math.floor(i / 3) * 0.06,
				1.15,
			],
		);
		spare.rotation.set(0, 0, Math.PI / 2);
	}

	return {
		sticks,
		door,
		flameGroup,
		flames,
		glass,
		glow: glowMaterial,
		spark,
		embers,
		smoke,
		chimneyTop: pipeTop + 0.15,
	};
};

// Crouched down at the fire: knees bent, leaning in.
const crouch = (tyler: Tyler, amount: number): void => {
	for (const { hip, knee } of tyler.legs) {
		hip.rotation.x = -1.3 * amount;
		knee.rotation.x = 1.9 * amount;
	}
	tyler.body.position.y = -0.4 * amount;
	tyler.upper.rotation.x = 0.55 * amount;
};

export const TYLER_WOOD_STOVE: EasterEgg = {
	id: 'tyler-wood-stove',
	clearingRadius: 12,
	footprint: { halfWidth: 1, halfDepth: 0.9 },
	gallery: {
		caption: 'Man make fire',
		camera: [1.4, 1.9, 4.4],
		target: [-0.25, 1, 0.2],
	},
	create: () => {
		const root = new Group();
		const fire = buildStove(root);
		const tyler = buildTyler(root);
		tyler.root.position.set(tylerX, 0, tylerZ);
		tyler.root.rotation.y = tylerFacing;
		const [leftArm, rightArm] = tyler.arms;

		let triggeredAt: number | undefined;
		// Sticks placed so far, and how far through placing the next one.
		let placed = 2;
		let progress = 0;
		const update = ({ time, dt, player }: EasterEggFrame): void => {
			const distance = Math.hypot(player.x, player.z);
			if (
				triggeredAt === undefined &&
				player.z > 0 &&
				distance < triggerDistance
			) {
				triggeredAt = time;
			}
			const t = triggeredAt === undefined ? -1 : time - triggeredAt;

			// Stacking: grab a log from the pile, feed it into the stove.
			if (t < lightAt) {
				const interval = t < 0 ? stackInterval : hurriedInterval;
				progress += dt / interval;
				if (progress >= 1) {
					progress -= 1;
					placed = Math.min(stickCount, placed + 1);
				}
				// Once he's in a hurry, make sure it's done in time.
				if (t >= 0) {
					placed = Math.max(
						placed,
						Math.min(
							stickCount,
							2 + Math.ceil((t / lightAt) * stickCount),
						),
					);
				}
				const isDone = placed >= stickCount;
				const reach = isDone ? 0 : Math.sin(progress * Math.PI);
				crouch(tyler, 1);
				// Right arm swings from the pile (his right) to the door.
				rightArm.shoulder.rotation.set(
					-1 - reach * 0.3,
					0,
					MathUtils.lerp(0.9, 0.1, progress),
				);
				rightArm.elbow.rotation.set(-0.6, 0, 0);
				leftArm.shoulder.rotation.set(-0.9 + reach * 0.2, 0, -0.2);
				leftArm.elbow.rotation.set(-0.7, 0, 0);
				tyler.stick.visible = !isDone && progress < 0.85;
				tyler.head.rotation.set(
					0.35,
					MathUtils.lerp(-0.5, 0, progress),
					0,
				);
			} else if (t < catchAt) {
				// Crouched right down, striking a light at the base.
				crouch(tyler, 1.1);
				tyler.stick.visible = false;
				const strike = Math.sin((t - lightAt) * 30);
				rightArm.shoulder.rotation.set(-1.25, 0, 0.15);
				rightArm.elbow.rotation.set(-0.3 + strike * 0.2, 0, 0);
				leftArm.shoulder.rotation.set(-1.2, 0, -0.15);
				leftArm.elbow.rotation.set(-0.35, 0, 0);
				tyler.head.rotation.set(0.6, 0, 0);
				fire.spark.visible = strike > 0.3;
			} else {
				// It's lit! Leap up, arms in the air, and shout about it, turning
				// round to face me.
				fire.spark.visible = false;
				const up = MathUtils.smootherstep(t, catchAt, catchAt + 0.35);
				crouch(tyler, 1 - up);
				const c = t - catchAt;
				tyler.root.position.y = up * Math.abs(Math.sin(c * 6)) * 0.28;
				tyler.root.rotation.y = MathUtils.lerp(tylerFacing, 0.5, up);
				for (const [i, arm] of tyler.arms.entries()) {
					const side = i === 0 ? -1 : 1;
					const pump = Math.sin(c * 12 + i * Math.PI) * 0.25;
					arm.shoulder.rotation.set(0, 0, side * (2.6 + pump) * up);
					arm.elbow.rotation.set(0, 0, side * 0.5 * up);
				}
				tyler.head.rotation.set(-0.35 * up, Math.sin(c * 3) * 0.3, 0);
				tyler.smile.visible = false;
				tyler.shout.visible = true;
			}
			for (const [i, stick] of fire.sticks.entries()) {
				stick.visible = i < placed;
			}

			// The door stands open while he loads it, then swings shut once
			// it's going.
			const shut = MathUtils.smootherstep(t, catchAt + 0.5, catchAt + 1);
			fire.door.rotation.y = MathUtils.lerp(1.9, 0, shut);

			// The fire itself, glowing through the door's window.
			const burn =
				t < catchAt
					? 0
					: MathUtils.smootherstep(t, catchAt, catchAt + 0.8);
			const flicker =
				0.85 + Math.sin(time * 17) * 0.1 + Math.sin(time * 41) * 0.05;
			fire.flameGroup.scale.setScalar(Math.max(0.001, burn));
			for (const [i, flame] of fire.flames.entries()) {
				flame.scale.y =
					1 +
					Math.sin(time * (11 + (i % 5) * 3) + i) * 0.22 +
					Math.sin(time * (27 + (i % 3) * 7) + i * 2) * 0.12;
			}
			fire.glass.emissiveIntensity = burn * 0.45 * flicker;
			fire.glow.opacity = burn * 0.14 * flicker;
			for (const ember of fire.embers) {
				ember.mesh.visible = burn > 0.3;
				ember.age = (ember.age + dt) % 1.6;
				const k = ember.age / 1.6;
				ember.mesh.position.set(
					ember.drift.x * k + Math.sin(time * 4 + k * 9) * 0.05,
					fire.chimneyTop + ember.drift.y * k,
					-0.1 + ember.drift.z * k,
				);
				ember.mesh.scale.setScalar(1 - k);
			}
			for (const puff of fire.smoke) {
				puff.age = (puff.age + dt) % 3;
				const k = puff.age / 3;
				puff.mesh.position.set(
					Math.sin(k * 5) * 0.15 + k * 0.4,
					fire.chimneyTop + k * 1.8,
					-0.1 + k * 0.3,
				);
				puff.mesh.scale.setScalar(0.5 + k * 2.4);
				puff.material.opacity = burn * 0.4 * (1 - k);
			}
		};
		return { object: root, update };
	},
};
