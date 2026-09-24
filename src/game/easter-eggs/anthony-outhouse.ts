import {
	BoxGeometry,
	CapsuleGeometry,
	CircleGeometry,
	CylinderGeometry,
	Group,
	MathUtils,
	type Object3D,
	Shape,
	ShapeGeometry,
	SphereGeometry,
	TorusGeometry,
} from 'three';

import { joint, part, standard } from './parts';
import { type EasterEgg, type EasterEggFrame } from './types';

// The outhouse is 1.4m square; its door faces +z (uphill, towards me).
const halfSize = 0.7;
const logRadius = 0.1;
const wallHeight = 2.2;
const doorWidth = 0.8;
const doorHeight = 1.95;
// How close I get before the door flies open.
const triggerDistance = 55;
// Where Anthony stands inside, and where he stops once he's stepped out.
const insideZ = -0.2;
const outsideZ = 1.25;

interface Anthony {
	root: Group;
	body: Group;
	head: Group;
	arms: { shoulder: Group; elbow: Group; wrist: Group }[];
	legs: Group[];
}

const buildOuthouse = (parent: Object3D): Group => {
	const bark = standard('#6b4a2f', { roughness: 0.95 });
	const barkDark = standard('#57391f', { roughness: 0.95 });
	const endGrain = standard('#b98f5f');
	const plank = standard('#8a6440', { roughness: 0.9 });
	const roof = standard('#4d3a2a', { roughness: 0.95 });
	const dark = standard('#1e1611');
	const paper = standard('#f4f2ec');

	const logs = Math.round(wallHeight / (logRadius * 2));
	const logGeometry = (length: number): CylinderGeometry =>
		new CylinderGeometry(logRadius, logRadius, length, 9);
	const addLog = (
		length: number,
		position: [number, number, number],
		isAlongX: boolean,
		index: number,
	): void => {
		const log = part(
			parent,
			logGeometry(length),
			index % 2 === 0 ? bark : barkDark,
			position,
		);
		log.rotation.set(
			isAlongX ? 0 : Math.PI / 2,
			0,
			isAlongX ? Math.PI / 2 : 0,
		);
	};

	// Log-cabin walls: the side walls sit half a log higher than the front
	// and back, so the corners interlock.
	for (let i = 0; i < logs; i++) {
		const y = logRadius + i * logRadius * 2;
		const overhang = 0.18;
		addLog(halfSize * 2 + overhang, [0, y, -halfSize], true, i);
		for (const side of [-1, 1]) {
			addLog(
				halfSize * 2 + overhang,
				[side * halfSize, y + logRadius, 0],
				false,
				i + 1,
			);
			// Front wall, either side of the door (and right across above it).
			if (y > doorHeight) {
				if (side === 1) {
					addLog(halfSize * 2 + overhang, [0, y, halfSize], true, i);
				}
			} else {
				const width = halfSize - doorWidth / 2;
				addLog(
					width + 0.09,
					[side * (doorWidth / 2 + width / 2), y, halfSize],
					true,
					i,
				);
			}
		}
	}
	// Sawn log ends on the front corners.
	const endGeometry = new CircleGeometry(logRadius * 0.9, 9);
	for (let i = 0; i < logs; i++) {
		for (const side of [-1, 1]) {
			part(parent, endGeometry, endGrain, [
				side * (halfSize + 0.09 - logRadius),
				logRadius + i * logRadius * 2,
				halfSize + 0.09 + 0.001,
			]);
		}
	}

	// Plank roof, sloping down to the back.
	const lid = part(
		parent,
		new BoxGeometry(halfSize * 2 + 0.5, 0.08, halfSize * 2 + 0.6),
		roof,
		[0, wallHeight + 0.22, 0],
	);
	lid.rotation.x = 0.16;

	// Inside: dark floor, the seat, a loo roll.
	part(
		parent,
		new BoxGeometry(halfSize * 2 - 0.1, 0.04, halfSize * 2 - 0.1),
		dark,
		[0, 0.02, 0],
	);
	part(parent, new BoxGeometry(1.1, 0.45, 0.5), plank, [0, 0.23, -0.4]);
	part(
		parent,
		new CylinderGeometry(0.14, 0.14, 0.01, 16),
		dark,
		[0, 0.46, -0.4],
	);
	part(
		parent,
		new CylinderGeometry(0.05, 0.05, 0.1, 12).rotateZ(Math.PI / 2),
		paper,
		[0.5, 0.8, -0.55],
	);

	// The door: planks and a Z brace, with the classic crescent moon, hinged
	// on its right-hand edge.
	const hinge = joint(parent, [doorWidth / 2, 0.03, halfSize + 0.1]);
	const door = joint(hinge, [-doorWidth / 2, 0, 0]);
	for (let i = 0; i < 4; i++) {
		part(
			door,
			new BoxGeometry(doorWidth / 4 - 0.008, doorHeight - 0.04, 0.04),
			plank,
			[
				-doorWidth / 2 + doorWidth / 8 + (i * doorWidth) / 4,
				doorHeight / 2,
				0,
			],
		);
	}
	for (const y of [0.35, doorHeight - 0.35]) {
		part(door, new BoxGeometry(doorWidth - 0.04, 0.1, 0.03), barkDark, [
			0,
			y,
			0.035,
		]);
	}
	const brace = part(
		door,
		new BoxGeometry(0.08, doorHeight - 0.8, 0.03),
		barkDark,
		[0, doorHeight / 2, 0.035],
	);
	brace.rotation.z = Math.atan2(doorWidth - 0.1, doorHeight - 0.8);
	const moon = new Shape();
	moon.absarc(0, 0, 0.08, Math.PI * 0.3, Math.PI * 1.7, false);
	moon.absarc(0.045, 0, 0.065, Math.PI * 1.55, Math.PI * 0.45, true);
	part(door, new ShapeGeometry(moon, 12), dark, [0, doorHeight - 0.2, 0.051]);
	// Handle.
	part(door, new BoxGeometry(0.03, 0.12, 0.04), barkDark, [
		-doorWidth / 2 + 0.08,
		1,
		0.05,
	]);

	return hinge;
};

// A white glove with brown fingertips. The fingers point down -y, the palm
// faces +z.
const buildGlove = (parent: Object3D): void => {
	const glove = standard('#f6f6f3', { roughness: 0.8 });
	const tip = standard('#5b3a1d', { roughness: 0.9 });
	part(parent, new BoxGeometry(0.085, 0.09, 0.04), glove, [0, -0.045, 0]);
	part(
		parent,
		new CylinderGeometry(0.052, 0.045, 0.05, 10),
		glove,
		[0, 0.02, 0],
	);
	const fingerGeometry = new CapsuleGeometry(0.0115, 0.05, 3, 6);
	const tipGeometry = new SphereGeometry(0.0135, 8, 6);
	for (let i = 0; i < 4; i++) {
		const x = -0.03 + i * 0.02;
		const length = i === 0 || i === 3 ? 0.055 : 0.065;
		part(parent, fingerGeometry, glove, [
			x,
			-0.09 - length / 2,
			0,
		]).scale.y = length / 0.07;
		part(parent, tipGeometry, tip, [x, -0.095 - length, 0]);
	}
	const thumb = joint(parent, [-0.045, -0.035, 0.012]);
	thumb.rotation.z = -0.7;
	part(thumb, fingerGeometry, glove, [0, -0.035, 0]);
	part(thumb, tipGeometry, tip, [0, -0.07, 0]);
};

// Anthony: slicked-back dark hair down to his collar, a huge grin, stubble,
// a navy half-zip windbreaker with white piping over a grey tee and a
// silver chain.
const buildAnthony = (parent: Object3D): Anthony => {
	const skin = standard('#d7a17c');
	const hair = standard('#211611', { roughness: 0.5 });
	const stubble = standard('#2a1c14', { transparent: true, opacity: 0.35 });
	const jacket = standard('#1e2a4c', { roughness: 0.45 });
	const piping = standard('#e9ecef');
	const collar = standard('#3f6d77');
	const tee = standard('#8b8e8d');
	const chain = standard('#d9dcdf', { metalness: 0.9, roughness: 0.25 });
	const trousers = standard('#34373d');
	const trainers = standard('#eeeeec');
	const dark = standard('#1b1411');
	const teeth = standard('#f7f3e8');
	const mouth = standard('#6e3432');

	const root = joint(parent, [0, 0, insideZ]);
	const body = joint(root, [0, 0, 0]);

	const legs = [-1, 1].map((side) => {
		const hip = joint(body, [side * 0.1, 0.92, 0]);
		part(
			hip,
			new CapsuleGeometry(0.078, 0.74, 4, 10),
			trousers,
			[0, -0.44, 0],
		);
		part(
			hip,
			new BoxGeometry(0.12, 0.09, 0.27),
			trainers,
			[0, -0.88, 0.04],
		);
		return hip;
	});

	// Windbreaker.
	part(
		body,
		new CylinderGeometry(0.19, 0.19, 0.18, 16),
		jacket,
		[0, 0.95, 0],
	);
	const torso = part(
		body,
		new CylinderGeometry(0.22, 0.19, 0.58, 16),
		jacket,
		[0, 1.2, 0],
	);
	torso.scale.z = 0.64;
	part(body, new SphereGeometry(0.22, 16, 8), jacket, [0, 1.46, 0]).scale.set(
		1,
		0.35,
		0.64,
	);
	// Half-zip, open at the neck: teal collar, grey tee, chain.
	part(body, new BoxGeometry(0.012, 0.3, 0.012), piping, [0, 1.25, 0.14]);
	part(body, new BoxGeometry(0.09, 0.06, 0.015), tee, [0, 1.49, 0.115]);
	const neckband = part(
		body,
		new TorusGeometry(0.075, 0.025, 8, 16),
		collar,
		[0, 1.5, 0.01],
	);
	neckband.rotation.x = Math.PI / 2 - 0.2;
	neckband.scale.set(1.1, 1, 1);
	const necklace = part(
		body,
		new TorusGeometry(0.06, 0.004, 6, 18),
		chain,
		[0, 1.47, 0.07],
	);
	necklace.rotation.x = Math.PI / 2 - 0.9;

	// Arms, with white piping down the sleeves.
	const arms = [-1, 1].map((side) => {
		const shoulder = joint(body, [side * 0.245, 1.45, 0]);
		part(
			shoulder,
			new CapsuleGeometry(0.068, 0.22, 4, 10),
			jacket,
			[0, -0.15, 0],
		);
		part(shoulder, new BoxGeometry(0.01, 0.28, 0.01), piping, [
			side * 0.066,
			-0.15,
			0,
		]);
		const elbow = joint(shoulder, [0, -0.3, 0]);
		part(
			elbow,
			new CapsuleGeometry(0.058, 0.2, 4, 10),
			jacket,
			[0, -0.13, 0],
		);
		const wrist = joint(elbow, [0, -0.28, 0]);
		buildGlove(wrist);
		return { shoulder, elbow, wrist };
	});

	// Neck & head.
	part(body, new CylinderGeometry(0.052, 0.058, 0.1, 12), skin, [0, 1.55, 0]);
	const head = joint(body, [0, 1.58, 0]);
	part(head, new SphereGeometry(0.12, 22, 16), skin, [0, 0.13, 0]).scale.set(
		0.93,
		1.13,
		1,
	);
	for (const side of [-1, 1]) {
		part(head, new SphereGeometry(0.028, 10, 8), skin, [
			side * 0.112,
			0.13,
			0,
		]).scale.set(0.5, 1, 0.8);
		// Grinning, crinkled eyes and thick dark brows.
		part(head, new SphereGeometry(0.012, 8, 6), dark, [
			side * 0.043,
			0.148,
			0.106,
		]).scale.y = 0.55;
		part(head, new BoxGeometry(0.055, 0.014, 0.012), hair, [
			side * 0.043,
			0.183,
			0.108,
		]).rotation.z = side * -0.1;
	}
	part(head, new SphereGeometry(0.019, 8, 6), skin, [0, 0.12, 0.124]);
	// A big, toothy smile.
	const grin = part(
		head,
		new CircleGeometry(0.042, 16, Math.PI, Math.PI),
		mouth,
		[0, 0.087, 0.109],
	);
	grin.scale.y = 0.7;
	grin.rotation.x = -0.25;
	const smile = part(
		head,
		new CircleGeometry(0.039, 16, Math.PI, Math.PI),
		teeth,
		[0, 0.087, 0.1105],
	);
	smile.scale.y = 0.42;
	smile.rotation.x = -0.25;
	// Stubble and a light moustache.
	const jaw = part(
		head,
		new SphereGeometry(
			0.114,
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
	jaw.scale.set(0.95, 1.13, 1);
	jaw.castShadow = false;
	part(head, new BoxGeometry(0.07, 0.012, 0.01), stubble, [0, 0.1, 0.113]);

	// Slicked-back hair, long at the back and over the ears.
	const crown = part(
		head,
		new SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
		hair,
		[0, 0.15, -0.01],
	);
	crown.scale.set(1, 1.05, 1.05);
	// Tipped back, so it's swept off his forehead.
	crown.rotation.x = -0.6;
	const back = part(
		head,
		new CapsuleGeometry(0.11, 0.16, 6, 12),
		hair,
		[0, 0.03, -0.065],
	);
	back.scale.set(1.15, 1, 0.6);
	const lockGeometry = new CapsuleGeometry(0.035, 0.16, 4, 8);
	for (const side of [-1, 1]) {
		const lock = part(head, lockGeometry, hair, [side * 0.112, 0.1, -0.02]);
		lock.rotation.z = side * 0.12;
	}

	return { root, body, head, arms, legs };
};

export const ANTHONY_OUTHOUSE: EasterEgg = {
	id: 'anthony-outhouse',
	clearingRadius: 12,
	footprint: { halfWidth: halfSize + 0.2, halfDepth: halfSize + 0.2 },
	gallery: {
		name: 'Anthony',
		caption: 'Fresh out of the log cabin loo',
		camera: [2.4, 1.9, 5.4],
		target: [0, 1.2, 0.6],
	},
	create: () => {
		const root = new Group();
		const hinge = buildOuthouse(root);
		const anthony = buildAnthony(root);

		let openedAt: number | undefined;
		const update = ({ time, player }: EasterEggFrame): void => {
			const distance = Math.hypot(player.x, player.z);
			if (
				openedAt === undefined &&
				player.z > 0 &&
				distance < triggerDistance
			) {
				openedAt = time;
			}
			if (openedAt === undefined) {
				// Something's rattling in there.
				hinge.rotation.y =
					distance < triggerDistance + 25
						? Math.max(0, Math.sin(time * 38)) * 0.04
						: 0;
				return;
			}
			const t = time - openedAt;

			// SLAM: the door flies open, bounces off its stop and settles.
			if (t < 0.18) {
				hinge.rotation.y = 1.95 * (t / 0.18) ** 2;
			} else {
				const bounce =
					Math.exp(-(t - 0.18) * 7) * Math.sin((t - 0.18) * 22);
				hinge.rotation.y = 1.85 - Math.abs(bounce) * 0.35;
			}

			// Step out...
			const step = MathUtils.smootherstep(t, 0.35, 1.15);
			anthony.root.position.z = MathUtils.lerp(insideZ, outsideZ, step);
			const isWalking = step > 0 && step < 1;
			const stride = isWalking ? Math.sin(t * 13) : 0;
			for (const [i, leg] of anthony.legs.entries()) {
				leg.rotation.x = stride * (i === 0 ? 0.45 : -0.45);
			}
			anthony.body.position.y = isWalking ? -Math.abs(stride) * 0.03 : 0;

			// ...then stop, bring both hands up and take a good look at them.
			const inspect = MathUtils.smootherstep(t, 1.15, 1.65);
			const turn = Math.sin(t * 2.6);
			for (const [
				i,
				{ shoulder, elbow, wrist },
			] of anthony.arms.entries()) {
				const side = i === 0 ? -1 : 1;
				shoulder.rotation.set(
					MathUtils.lerp(stride * -0.4 * side, -0.55, inspect),
					0,
					side * MathUtils.lerp(0.08, -0.12, inspect),
				);
				elbow.rotation.x = MathUtils.lerp(-0.1, -1.75, inspect);
				// Palms up to the face, then flipped over to check the backs.
				wrist.rotation.set(
					inspect * -0.4,
					inspect * side * (0.6 + turn * 0.9),
					0,
				);
			}
			anthony.head.rotation.set(
				MathUtils.lerp(0, 0.4, inspect),
				inspect * turn * 0.15,
				inspect * Math.sin(t * 1.3) * 0.12,
			);
		};
		return { object: root, update };
	},
};
