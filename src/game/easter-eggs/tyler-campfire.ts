import {
	BoxGeometry,
	CapsuleGeometry,
	CircleGeometry,
	ConeGeometry,
	CylinderGeometry,
	DodecahedronGeometry,
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
// The fire sits at the origin; Tyler crouches behind it, facing +z.
const tylerZ = -0.75;
const stickCount = 12;
const stickLength = 0.75;
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

// A teepee of sticks, a ring of stones, the fire and its sparks & smoke.
const buildFire = (
	parent: Object3D,
): {
	sticks: Mesh[];
	flameGroup: Group;
	flames: Mesh[];
	glow: MeshStandardMaterial;
	spark: Mesh;
	embers: { mesh: Mesh; age: number; drift: Vector3 }[];
	smoke: { mesh: Mesh; material: MeshStandardMaterial; age: number }[];
} => {
	const wood = standard('#6a4b2f', { roughness: 0.95 });
	const woodLight = standard('#8b6843', { roughness: 0.95 });
	const stone = standard('#8a8d8f', { roughness: 1 });
	const stoneDark = standard('#6f7274', { roughness: 1 });

	// Stones round the fire pit.
	const rock = new DodecahedronGeometry(0.1, 0);
	for (let i = 0; i < 11; i++) {
		const angle = (i / 11) * Math.PI * 2;
		const mesh = part(parent, rock, i % 2 === 0 ? stone : stoneDark, [
			Math.cos(angle) * 0.46,
			0.05,
			Math.sin(angle) * 0.46,
		]);
		mesh.scale.set(1, 0.6, 1.1);
		mesh.rotation.y = angle * 3;
	}

	// The teepee, stick by stick.
	const stickGeometry = new CylinderGeometry(0.022, 0.026, stickLength, 6);
	const lean = Math.asin(0.22 / stickLength);
	const sticks = Array.from({ length: stickCount }, (_, i) => {
		const angle = (i / stickCount) * Math.PI * 2 + (i % 2) * 0.2;
		const pivot = joint(parent, [0, 0, 0]);
		pivot.rotation.y = angle;
		const mesh = part(
			pivot,
			stickGeometry,
			i % 3 === 0 ? woodLight : wood,
			[
				0.22 - Math.sin(lean) * (stickLength / 2),
				Math.cos(lean) * (stickLength / 2),
				0,
			],
		);
		mesh.rotation.z = lean;
		mesh.visible = false;
		return mesh;
	});

	// Spare sticks piled up beside him.
	for (let i = 0; i < 5; i++) {
		const spare = part(
			parent,
			stickGeometry,
			i % 2 === 0 ? wood : woodLight,
			[
				0.85 + (i % 2) * 0.05,
				0.03 + Math.floor(i / 2) * 0.045,
				-0.6 + i * 0.03,
			],
		);
		spare.rotation.set(Math.PI / 2, 0, 0.3 + i * 0.1);
	}

	// Flames: tongues of fire in three layers, each flickering on its own.
	// Hidden until it catches.
	const flameGroup = joint(parent, [0, 0.04, 0]);
	flameGroup.scale.setScalar(0.001);
	const flames = (
		[
			['#ff4d00', 0.11, 0.55, 0.8, 0.13, 6],
			['#ff9a1a', 0.08, 0.45, 0.85, 0.08, 5],
			['#ffe066', 0.055, 0.32, 0.9, 0.03, 3],
		] as const
	).flatMap(([color, radius, height, opacity, spread, count]) => {
		const material = standard(color, {
			emissive: color,
			emissiveIntensity: 1.6,
			transparent: true,
			opacity,
			depthWrite: false,
		});
		const geometry = new ConeGeometry(radius, height, 7, 1, true).translate(
			0,
			height / 2,
			0,
		);
		return Array.from({ length: count }, (_, i) => {
			const angle = (i / count) * Math.PI * 2;
			const tongue = part(flameGroup, geometry, material, [
				Math.cos(angle) * spread,
				0,
				Math.sin(angle) * spread,
			]);
			tongue.castShadow = false;
			tongue.rotation.set(
				Math.sin(angle) * 0.2,
				0,
				-Math.cos(angle) * 0.2,
			);
			return tongue;
		});
	});
	const glowMaterial = standard('#ff7a1a', {
		emissive: '#ff6a00',
		emissiveIntensity: 1,
		transparent: true,
		opacity: 0,
		depthWrite: false,
	});
	const glow = part(
		parent,
		new CircleGeometry(0.75, 24),
		glowMaterial,
		[0, 0.015, 0],
	);
	glow.rotation.x = -Math.PI / 2;
	glow.castShadow = false;
	glow.receiveShadow = false;

	// The spark as he lights it.
	const spark = part(
		parent,
		new SphereGeometry(0.03, 8, 6),
		standard('#fff2a8', { emissive: '#ffd24d', emissiveIntensity: 3 }),
		[0.05, 0.06, -0.18],
	);
	spark.castShadow = false;
	spark.visible = false;

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
				MathUtils.randFloatSpread(0.4),
				MathUtils.randFloat(0.8, 1.4),
				MathUtils.randFloatSpread(0.4),
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

	return {
		sticks,
		flameGroup,
		flames,
		glow: glowMaterial,
		spark,
		embers,
		smoke,
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

export const TYLER_CAMPFIRE: EasterEgg = {
	id: 'tyler-campfire',
	clearingRadius: 12,
	footprint: { halfWidth: 0.9, halfDepth: 1.2 },
	create: () => {
		const root = new Group();
		const fire = buildFire(root);
		const tyler = buildTyler(root);
		tyler.root.position.z = tylerZ;
		const [leftArm, rightArm] = tyler.arms;

		let triggeredAt: number | undefined;
		// Sticks placed so far, and how far through placing the next one.
		let placed = 3;
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

			// Stacking: grab a stick from the pile, lean it on the teepee.
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
							3 + Math.ceil((t / lightAt) * stickCount),
						),
					);
				}
				const isDone = placed >= stickCount;
				const reach = isDone ? 0 : Math.sin(progress * Math.PI);
				crouch(tyler, 1);
				// Right arm swings from the pile (his right) to the teepee.
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
				// It's lit! Leap up, arms in the air, and shout about it.
				fire.spark.visible = false;
				const up = MathUtils.smootherstep(t, catchAt, catchAt + 0.35);
				crouch(tyler, 1 - up);
				const c = t - catchAt;
				tyler.root.position.y = up * Math.abs(Math.sin(c * 6)) * 0.28;
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

			// The fire itself.
			const burn =
				t < catchAt
					? 0
					: MathUtils.smootherstep(t, catchAt, catchAt + 0.8);
			fire.flameGroup.scale.setScalar(Math.max(0.001, burn));
			for (const [i, flame] of fire.flames.entries()) {
				flame.scale.y =
					1 +
					Math.sin(time * (11 + (i % 5) * 3) + i) * 0.22 +
					Math.sin(time * (27 + (i % 3) * 7) + i * 2) * 0.12;
			}
			fire.flameGroup.rotation.y = time * 0.8;
			fire.glow.opacity = burn * (0.18 + Math.sin(time * 17) * 0.04);
			for (const ember of fire.embers) {
				ember.mesh.visible = burn > 0.3;
				ember.age = (ember.age + dt) % 1.6;
				const k = ember.age / 1.6;
				ember.mesh.position.set(
					ember.drift.x * k + Math.sin(time * 4 + k * 9) * 0.05,
					0.2 + ember.drift.y * k,
					ember.drift.z * k,
				);
				ember.mesh.scale.setScalar(1 - k);
			}
			for (const puff of fire.smoke) {
				puff.age = (puff.age + dt) % 3;
				const k = puff.age / 3;
				puff.mesh.position.set(
					Math.sin(k * 5) * 0.15,
					0.8 + k * 2.2,
					0.2 + k * 0.6,
				);
				puff.mesh.scale.setScalar(0.6 + k * 2.4);
				puff.material.opacity = burn * 0.35 * (1 - k);
			}
		};
		return { object: root, update };
	},
};
