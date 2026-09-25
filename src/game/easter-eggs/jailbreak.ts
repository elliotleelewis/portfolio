import {
	BoxGeometry,
	CapsuleGeometry,
	CircleGeometry,
	CylinderGeometry,
	Group,
	MathUtils,
	type Mesh,
	type MeshStandardMaterial,
	type Object3D,
	PlaneGeometry,
	SphereGeometry,
	TorusGeometry,
	Vector3,
} from 'three';

import { canvasTexture, joint, part, standard } from './parts';
import type { EasterEgg, EasterEggFrame } from './types';

// How close I get before the prisoner makes his break.
const triggerDistance = 50;
// Radius of the circle they run round, and how fast.
const circleRadius = 2.3;
const runSpeed = 4.6;
// How far round the circle the officer trails behind.
const chaseGap = 1.3;
const breakAt = 0.45;
const runAt = 1.2;

interface Runner {
	root: Group;
	body: Group;
	head: Group;
	arms: { shoulder: Group; elbow: Group; wrist: Group }[];
	legs: { hip: Group; knee: Group }[];
}

interface Outfit {
	skin: string;
	top: string;
	bottoms: string;
	shoes: string;
	// Torso radius: the prisoner's a bit stockier.
	build: number;
}

// A person, facing +z, with the joints needed to struggle, run and flail.
const buildRunner = (parent: Object3D, outfit: Outfit): Runner => {
	const skin = standard(outfit.skin);
	const top = standard(outfit.top, { roughness: 0.8 });
	const bottoms = standard(outfit.bottoms);
	const shoes = standard(outfit.shoes);
	const { build } = outfit;

	const root = joint(parent, [0, 0, 0]);
	const body = joint(root, [0, 0, 0]);
	const legs = [-1, 1].map((side) => {
		const hip = joint(body, [side * 0.11, 0.92, 0]);
		part(
			hip,
			new CapsuleGeometry(0.085, 0.3, 4, 10),
			bottoms,
			[0, -0.2, 0],
		);
		const knee = joint(hip, [0, -0.42, 0]);
		part(
			knee,
			new CapsuleGeometry(0.072, 0.32, 4, 10),
			bottoms,
			[0, -0.2, 0],
		);
		part(knee, new BoxGeometry(0.12, 0.09, 0.27), shoes, [0, -0.44, 0.04]);
		return { hip, knee };
	});

	part(
		body,
		new CylinderGeometry(build - 0.02, build - 0.03, 0.18, 16),
		bottoms,
		[0, 0.94, 0],
	);
	const torso = part(
		body,
		new CylinderGeometry(build, build - 0.02, 0.58, 18),
		top,
		[0, 1.2, 0],
	);
	torso.scale.z = 0.68;
	part(body, new SphereGeometry(build, 16, 8), top, [0, 1.46, 0]).scale.set(
		1,
		0.35,
		0.68,
	);

	const arms = [-1, 1].map((side) => {
		const shoulder = joint(body, [side * (build + 0.03), 1.45, 0]);
		part(
			shoulder,
			new CapsuleGeometry(0.072, 0.2, 4, 10),
			top,
			[0, -0.14, 0],
		);
		const elbow = joint(shoulder, [0, -0.29, 0]);
		part(
			elbow,
			new CapsuleGeometry(0.062, 0.18, 4, 10),
			top,
			[0, -0.12, 0],
		);
		const wrist = joint(elbow, [0, -0.26, 0]);
		part(
			wrist,
			new SphereGeometry(0.055, 10, 8),
			skin,
			[0, -0.05, 0],
		).scale.set(0.85, 1.1, 0.6);
		return { shoulder, elbow, wrist };
	});

	part(body, new CylinderGeometry(0.058, 0.064, 0.1, 12), skin, [0, 1.55, 0]);
	const head = joint(body, [0, 1.58, 0]);
	part(head, new SphereGeometry(0.122, 22, 16), skin, [0, 0.13, 0]).scale.set(
		0.95,
		1.1,
		1,
	);
	for (const side of [-1, 1]) {
		part(head, new SphereGeometry(0.028, 10, 8), skin, [
			side * 0.114,
			0.13,
			0,
		]).scale.set(0.5, 1, 0.8);
	}
	part(head, new SphereGeometry(0.02, 8, 6), skin, [0, 0.12, 0.125]);
	return { root, body, head, arms, legs };
};

const face = (
	head: Object3D,
	{
		hair,
		isGrinning,
		isBearded = false,
	}: { hair: MeshStandardMaterial; isGrinning: boolean; isBearded?: boolean },
): void => {
	const dark = standard('#1b1411');
	for (const side of [-1, 1]) {
		part(head, new SphereGeometry(0.012, 8, 6), dark, [
			side * 0.043,
			0.148,
			0.107,
		]).scale.y = 0.6;
		part(head, new BoxGeometry(0.052, 0.014, 0.012), hair, [
			side * 0.043,
			0.18,
			0.11,
		]).rotation.z = side * -0.1;
	}
	const mouth = part(
		head,
		new CircleGeometry(isGrinning ? 0.034 : 0.026, 14, Math.PI, Math.PI),
		standard('#6e3432'),
		// Out in front of a beard, if there is one.
		[0, 0.083, isBearded ? 0.127 : 0.113],
	);
	mouth.scale.y = isGrinning ? 0.5 : 0.35;
	mouth.rotation.x = -0.25;
};

// The prisoner: short dark hair, spiky at the front; a full dark beard; a maroon
// hooded long-sleeve and khakis. (The officer's taken his backpack.)
const buildPrisoner = (parent: Object3D): Runner => {
	const prisoner = buildRunner(parent, {
		skin: '#cf9a74',
		top: '#6b1f2c',
		bottoms: '#b8a68b',
		shoes: '#3b3b3e',
		build: 0.25,
	});
	const hair = standard('#1c1411', { roughness: 0.5 });
	const beard = standard('#1f1612', { roughness: 0.95 });
	const { head, body } = prisoner;
	face(head, { hair, isGrinning: true, isBearded: true });

	// Full, neatly trimmed beard and moustache.
	const beardShell = part(
		head,
		new SphereGeometry(
			0.122,
			20,
			12,
			-Math.PI * 0.1,
			Math.PI * 1.2,
			Math.PI * 0.55,
			Math.PI * 0.38,
		),
		beard,
		[0, 0.13, 0.004],
	);
	beardShell.scale.set(0.97, 1.14, 1.04);
	part(head, new BoxGeometry(0.085, 0.02, 0.018), beard, [0, 0.1, 0.128]);

	// Short, wet-look hair with a spiky fringe.
	const crown = part(
		head,
		new SphereGeometry(0.128, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.44),
		hair,
		[0, 0.155, -0.006],
	);
	crown.scale.set(0.98, 1.08, 1.04);
	crown.rotation.x = -0.2;
	const spike = new CylinderGeometry(0, 0.018, 0.06, 5);
	for (let i = -3; i <= 3; i++) {
		const piece = part(head, spike, hair, [i * 0.024, 0.235, 0.098]);
		piece.rotation.set(2.1, 0, i * 0.1);
	}

	// Maroon hooded top: hood behind the neck, a little white logo.
	const hood = part(
		body,
		new TorusGeometry(0.1, 0.055, 8, 16),
		standard('#6b1f2c', { roughness: 0.8 }),
		[0, 1.52, -0.04],
	);
	hood.rotation.x = Math.PI / 2 + 0.3;
	hood.scale.set(1.2, 1, 1);
	part(
		body,
		new BoxGeometry(0.06, 0.015, 0.006),
		standard('#e9e6f2'),
		[0.12, 1.36, 0.172],
	);
	return prisoner;
};

// A police officer: navy uniform, hi-vis vest, peaked cap with a chequered
// band, and a big moustache.
const buildOfficer = (parent: Object3D): Runner => {
	const officer = buildRunner(parent, {
		skin: '#efc3a2',
		top: '#1d2a44',
		bottoms: '#15181f',
		shoes: '#0d0d0d',
		build: 0.23,
	});
	const hair = standard('#6b4a33');
	const { head, body } = officer;
	face(head, { hair, isGrinning: false });
	part(head, new BoxGeometry(0.1, 0.028, 0.02), hair, [0, 0.1, 0.118]);

	// Peaked cap.
	const navy = standard('#18233b');
	const black = standard('#0e0e10', { roughness: 0.3 });
	const band = standard('#ffffff', {
		map: canvasTexture(128, 16, (context) => {
			for (let x = 0; x < 128; x += 8) {
				for (let y = 0; y < 16; y += 8) {
					context.fillStyle =
						(x + y) % 16 === 0 ? '#111111' : '#f2f2f2';
					context.fillRect(x, y, 8, 8);
				}
			}
		}),
	});
	part(
		head,
		new CylinderGeometry(0.135, 0.125, 0.07, 20, 1, true),
		band,
		[0, 0.24, 0],
	);
	part(
		head,
		new CylinderGeometry(0.155, 0.135, 0.05, 20),
		navy,
		[0, 0.295, 0],
	);
	const peak = part(
		head,
		new CylinderGeometry(
			0.11,
			0.11,
			0.012,
			20,
			1,
			false,
			-Math.PI / 2,
			Math.PI,
		),
		black,
		[0, 0.21, 0.085],
	);
	peak.rotation.x = 0.25;
	part(
		head,
		new BoxGeometry(0.03, 0.03, 0.01),
		standard('#d9b84a', {
			metalness: 0.8,
			roughness: 0.3,
		}),
		[0, 0.265, 0.14],
	);

	// Hi-vis vest with POLICE across the back.
	const vest = standard('#c9e23a', { roughness: 0.6 });
	const reflective = standard('#dfe3e6', { metalness: 0.6, roughness: 0.25 });
	const vestBody = part(
		body,
		new CylinderGeometry(0.245, 0.225, 0.46, 18, 1, true),
		vest,
		[0, 1.22, 0],
	);
	vestBody.scale.z = 0.7;
	for (const y of [1.08, 1.18]) {
		const stripe = part(
			body,
			new CylinderGeometry(0.248, 0.244, 0.035, 18, 1, true),
			reflective,
			[0, y, 0],
		);
		stripe.scale.z = 0.71;
	}
	const label = part(
		body,
		new PlaneGeometry(0.3, 0.08),
		standard('#ffffff', {
			transparent: true,
			map: canvasTexture(256, 64, (context) => {
				context.fillStyle = '#10131a';
				context.font = 'bold 44px system-ui, sans-serif';
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				context.fillText('POLICE', 128, 34);
			}),
		}),
		[0, 1.34, -0.176],
	);
	label.rotation.y = Math.PI;
	label.castShadow = false;
	// Duty belt.
	part(
		body,
		new CylinderGeometry(0.225, 0.225, 0.06, 18),
		black,
		[0, 0.98, 0],
	);
	part(body, new BoxGeometry(0.06, 0.12, 0.08), black, [0.24, 0.94, 0.02]);
	return officer;
};

interface Link {
	mesh: Mesh;
	velocity: Vector3;
	spin: Vector3;
}

// Running pose: arms pumping, knees driving, leaning into it.
const run = (runner: Runner, phase: number, lean: number): void => {
	const stride = Math.sin(phase);
	for (const [i, { hip, knee }] of runner.legs.entries()) {
		const s = i === 0 ? stride : -stride;
		hip.rotation.x = -s * 0.8 - 0.1;
		knee.rotation.x = 0.4 + Math.max(0, s) * 0.9;
	}
	runner.body.rotation.x = lean;
	runner.body.position.y = Math.abs(Math.cos(phase)) * 0.06;
};

export const JAILBREAK: EasterEgg = {
	id: 'jailbreak',
	clearingRadius: 12,
	footprint: { halfWidth: circleRadius + 0.4, halfDepth: circleRadius + 0.4 },
	gallery: {
		caption: 'Slipping the cuffs',
		camera: [2.6, 3.2, 7.8],
		target: [0, 0.9, 0],
	},
	create: () => {
		const root = new Group();
		const prisoner = buildPrisoner(root);
		const officer = buildOfficer(root);
		const prisonerStart = new Vector3(0.35, 0, 0);
		const officerStart = new Vector3(-0.45, 0, 0.1);
		prisoner.root.position.copy(prisonerStart);
		officer.root.position.copy(officerStart);
		officer.root.rotation.y = 0.35;

		// Handcuffs: a cuff on each wrist, three links between them.
		const steel = standard('#c5cbd1', { metalness: 0.9, roughness: 0.25 });
		for (const { wrist } of prisoner.arms) {
			const cuff = part(
				wrist,
				new TorusGeometry(0.05, 0.011, 8, 16),
				steel,
				[0, -0.02, 0],
			);
			cuff.rotation.x = Math.PI / 2;
		}
		const linkGeometry = new TorusGeometry(0.018, 0.005, 6, 10);
		const links: Link[] = Array.from({ length: 3 }, () => {
			const mesh = part(root, linkGeometry, steel, [0, 0, 0]);
			mesh.castShadow = false;
			return { mesh, velocity: new Vector3(), spin: new Vector3() };
		});

		let triggeredAt: number | undefined;
		let prisonerAngle = 0;
		let isSnapped = false;
		const update = ({ time, dt, player }: EasterEggFrame): void => {
			const distance = Math.hypot(player.x, player.z);
			if (
				triggeredAt === undefined &&
				player.z > 0 &&
				distance < triggerDistance
			) {
				triggeredAt = time;
				prisonerAngle = Math.atan2(prisonerStart.z, prisonerStart.x);
			}
			const t = triggeredAt === undefined ? -1 : time - triggeredAt;

			if (t < breakAt) {
				// Cuffed, hands behind his back, straining against them.
				const strain =
					t < 0 ? Math.sin(time * 3) * 0.05 : Math.sin(t * 40) * 0.12;
				for (const [
					i,
					{ shoulder, elbow, wrist },
				] of prisoner.arms.entries()) {
					const side = i === 0 ? -1 : 1;
					shoulder.rotation.set(
						0.4 + strain,
						0,
						side * (0.1 + strain),
					);
					// Forearms folded in behind him, wrists together.
					elbow.rotation.set(0.35, 0, side * -1.45);
					wrist.rotation.set(0, 0, 0);
				}
				prisoner.head.rotation.set(0.1, Math.sin(time * 0.7) * 0.3, 0);
				// The chain hangs between his wrists.
				root.updateMatrixWorld(true);
				const [left, right] = prisoner.arms.map(({ wrist }) =>
					root.worldToLocal(wrist.getWorldPosition(new Vector3())),
				);
				for (const [i, { mesh }] of links.entries()) {
					mesh.position.lerpVectors(left, right, (i + 1) / 4);
					mesh.position.y -= 0.03;
					mesh.rotation.set(0, i % 2 === 0 ? 0 : Math.PI / 2, 0);
				}
				// The officer stands by, hands on hips.
				for (const [i, { shoulder, elbow }] of officer.arms.entries()) {
					const side = i === 0 ? -1 : 1;
					shoulder.rotation.set(0, 0, side * 0.5);
					elbow.rotation.set(-0.3, 0, side * -1.6);
				}
				return;
			}

			// SNAP: the chain breaks and the links fly.
			if (!isSnapped) {
				isSnapped = true;
				for (const link of links) {
					link.velocity.set(
						MathUtils.randFloatSpread(3),
						MathUtils.randFloat(2.5, 4),
						MathUtils.randFloat(-2, -0.5),
					);
					link.spin.set(
						MathUtils.randFloatSpread(20),
						MathUtils.randFloatSpread(20),
						MathUtils.randFloatSpread(20),
					);
				}
			}
			for (const link of links) {
				const { mesh, velocity, spin } = link;
				if (mesh.position.y > 0.01) {
					velocity.y -= 9.8 * dt;
					mesh.position.addScaledVector(velocity, dt);
					mesh.rotation.x += spin.x * dt;
					mesh.rotation.y += spin.y * dt;
					mesh.rotation.z += spin.z * dt;
				} else {
					mesh.position.y = 0.005;
					mesh.rotation.set(Math.PI / 2, 0, 0);
				}
			}

			if (t < runAt) {
				// Arms flung up in triumph; the officer leaps back.
				const fling = MathUtils.smootherstep(
					t,
					breakAt,
					breakAt + 0.15,
				);
				for (const [
					i,
					{ shoulder, elbow },
				] of prisoner.arms.entries()) {
					const side = i === 0 ? -1 : 1;
					shoulder.rotation.set(
						0,
						0,
						side * MathUtils.lerp(0.3, 2.6, fling),
					);
					elbow.rotation.set(0, 0, side * 0.3);
				}
				prisoner.head.rotation.set(-0.2, 0, 0);
				const startle = MathUtils.smootherstep(
					t,
					breakAt,
					breakAt + 0.2,
				);
				officer.body.rotation.x = -0.25 * startle;
				for (const [i, { shoulder, elbow }] of officer.arms.entries()) {
					const side = i === 0 ? -1 : 1;
					shoulder.rotation.set(
						-0.6 * startle,
						0,
						side * 1.4 * startle,
					);
					elbow.rotation.set(-0.8 * startle, 0, 0);
				}
				return;
			}

			// Round and round they go.
			const running = t - runAt;
			prisonerAngle += (runSpeed / circleRadius) * dt;
			const officerAngle = prisonerAngle - chaseGap;
			const ease = MathUtils.smootherstep(running, 0, 0.6);
			for (const [runner, angle, start] of [
				[prisoner, prisonerAngle, prisonerStart],
				[officer, officerAngle, officerStart],
			] as const) {
				const x = Math.cos(angle) * circleRadius;
				const z = Math.sin(angle) * circleRadius;
				runner.root.position.set(
					MathUtils.lerp(start.x, x, ease),
					0,
					MathUtils.lerp(start.z, z, ease),
				);
				// Facing along the circle.
				runner.root.rotation.y = Math.atan2(
					-Math.sin(angle),
					Math.cos(angle),
				);
				run(runner, time * 13 + (runner === officer ? 1.3 : 0), 0.22);
			}

			// The prisoner pumps his arms and keeps checking over his shoulder.
			for (const [i, { shoulder, elbow }] of prisoner.arms.entries()) {
				const side = i === 0 ? -1 : 1;
				shoulder.rotation.set(
					Math.sin(time * 13) * side * 0.9,
					0,
					side * 0.2,
				);
				elbow.rotation.set(-1.3, 0, 0);
			}
			prisoner.head.rotation.set(
				0,
				Math.sin(time * 2.2) > 0 ? 1.1 : 0.15,
				0,
			);
			prisoner.body.rotation.z = 0.12;

			// The officer reaches out for him, hand on his hat.
			const [officerLeft, officerRight] = officer.arms;
			officerLeft.shoulder.rotation.set(-1.45, 0, -0.1);
			officerLeft.elbow.rotation.set(
				-0.1 + Math.sin(time * 9) * 0.1,
				0,
				0,
			);
			officerRight.shoulder.rotation.set(0, 0, 2.3);
			officerRight.elbow.rotation.set(0, 0, 1.7);
			officer.body.rotation.z = 0.12;
			officer.head.rotation.set(-0.1, 0, 0);
		};
		return { object: root, update };
	},
};
