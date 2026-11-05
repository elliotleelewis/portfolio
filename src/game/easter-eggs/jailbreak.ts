import {
	Group,
	MathUtils,
	type Mesh,
	type Object3D,
	PlaneGeometry,
	TorusGeometry,
	Vector3,
} from 'three';

import { m } from '../../paraglide/messages';
import { surface } from '../look/surfaces';
import { OFFICER, PRISONER } from '../people/cast';
import {
	type Person,
	type PersonSpec,
	createPerson,
	personMaterial,
} from '../people/person';

import { canvasTexture, part } from './parts';
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

// A runner, and their arms and legs, their right (-x) first.
interface Runner {
	person: Person;
	arms: { shoulder: Group; elbow: Group; hand: Object3D }[];
	legs: { hip: Group; knee: Group }[];
}

/**
 * Builds someone to struggle, run and flail.
 * @param parent - What they stand in.
 * @param spec - How they look.
 * @returns Them.
 */
const buildRunner = (parent: Object3D, spec: PersonSpec): Runner => {
	const person = createPerson(spec, personMaterial());
	parent.add(person.root);
	return {
		person,
		arms: [
			{
				shoulder: person.rightArm,
				elbow: person.rightForearm,
				hand: person.rightHand,
			},
			{
				shoulder: person.leftArm,
				elbow: person.leftForearm,
				hand: person.leftHand,
			},
		],
		legs: [
			{ hip: person.rightLeg, knee: person.rightShin },
			{ hip: person.leftLeg, knee: person.leftShin },
		],
	};
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
	runner.person.body.rotation.x = lean;
	runner.person.body.position.y = Math.abs(Math.cos(phase)) * 0.06;
};

export const JAILBREAK: EasterEgg = {
	id: 'jailbreak',
	clearingRadius: 12,
	footprint: { halfWidth: circleRadius + 0.4, halfDepth: circleRadius + 0.4 },
	gallery: {
		caption: m.egg_jailbreak(),
		camera: [2.6, 3.2, 7.8],
		target: [0, 0.9, 0],
	},
	create: () => {
		const root = new Group();
		const prisoner = buildRunner(root, PRISONER);
		const officer = buildRunner(root, OFFICER);
		// POLICE across the officer's back.
		const label = part(
			officer.person.chest,
			new PlaneGeometry(0.3, 0.08),
			surface('#ffffff', 'matte', {
				transparent: true,
				map: canvasTexture(256, 64, (context) => {
					context.fillStyle = '#10131a';
					context.font = 'bold 44px system-ui, sans-serif';
					context.textAlign = 'center';
					context.textBaseline = 'middle';
					context.fillText('POLICE', 128, 34);
				}),
			}),
			[0, 0.21, -0.255],
		);
		label.rotation.y = Math.PI;
		label.castShadow = false;
		const prisonerStart = new Vector3(0.35, 0, 0);
		const officerStart = new Vector3(-0.45, 0, 0.1);
		prisoner.person.root.position.copy(prisonerStart);
		officer.person.root.position.copy(officerStart);
		officer.person.root.rotation.y = 0.35;

		// Handcuffs: a cuff on each wrist, three links between them.
		const steel = surface('#c5cbd1', 'metal');
		for (const { hand } of prisoner.arms) {
			const cuff = part(
				hand,
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
					{ shoulder, elbow },
				] of prisoner.arms.entries()) {
					const side = i === 0 ? -1 : 1;
					shoulder.rotation.set(
						0.4 + strain,
						0,
						side * (0.1 + strain),
					);
					// Forearms folded in behind him, wrists together.
					elbow.rotation.set(0.35, 0, side * -1.45);
				}
				prisoner.person.head.rotation.set(
					0.1,
					Math.sin(time * 0.7) * 0.3,
					0,
				);
				// The chain hangs between his wrists.
				root.updateMatrixWorld(true);
				const [left, right] = prisoner.arms.map(({ hand }) =>
					root.worldToLocal(hand.getWorldPosition(new Vector3())),
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
				prisoner.person.head.rotation.set(-0.2, 0, 0);
				const startle = MathUtils.smootherstep(
					t,
					breakAt,
					breakAt + 0.2,
				);
				officer.person.body.rotation.x = -0.25 * startle;
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
				runner.person.root.position.set(
					MathUtils.lerp(start.x, x, ease),
					0,
					MathUtils.lerp(start.z, z, ease),
				);
				// Facing along the circle.
				runner.person.root.rotation.y = Math.atan2(
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
			prisoner.person.head.rotation.set(
				0,
				Math.sin(time * 2.2) > 0 ? 1.1 : 0.15,
				0,
			);
			prisoner.person.body.rotation.z = 0.12;

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
			officer.person.body.rotation.z = 0.12;
			officer.person.head.rotation.set(-0.1, 0, 0);
		};
		const moving = [
			...prisoner.person.joints,
			...officer.person.joints,
			...links.map(({ mesh }) => mesh),
		];
		return { object: root, update, moving };
	},
};
