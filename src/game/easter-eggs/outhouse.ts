import {
	CircleGeometry,
	CylinderGeometry,
	Group,
	MathUtils,
	type Object3D,
	Shape,
	ShapeGeometry,
} from 'three';

import { m } from '../../paraglide/messages';
import { foldedBox } from '../look/shapes';
import { surface } from '../look/surfaces';
import { OCCUPANT } from '../people/cast';
import { type Person, createPerson, personMaterial } from '../people/person';

import { joint, part } from './parts';
import type { EasterEgg, EasterEggFrame } from './types';

// The outhouse is 1.4m square; its door faces +z (uphill, towards me).
const halfSize = 0.7;
const logRadius = 0.1;
const wallHeight = 2.2;
const doorWidth = 0.8;
const doorHeight = 1.95;
// How close I get before the door flies open.
const triggerDistance = 55;
// Where the occupant stands inside, and where he stops once he's stepped out.
const insideZ = -0.2;
const outsideZ = 1.25;

// The occupant, and his arms and legs, his right (-x) first.
interface Occupant {
	person: Person;
	arms: { shoulder: Group; elbow: Group }[];
	legs: Group[];
}

const buildOuthouse = (parent: Object3D): Group => {
	const bark = surface('#6b4a2f');
	const barkDark = surface('#57391f');
	const endGrain = surface('#b98f5f');
	const plank = surface('#8a6440');
	const roof = surface('#4d3a2a');
	const dark = surface('#1e1611');
	const paper = surface('#f4f2ec');

	const logs = Math.round(wallHeight / (logRadius * 2));
	const logGeometry = (length: number): CylinderGeometry =>
		new CylinderGeometry(logRadius, logRadius, length, 7);
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
	const endGeometry = new CircleGeometry(logRadius * 0.9, 7);
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
		foldedBox(halfSize * 2 + 0.5, 0.08, halfSize * 2 + 0.6),
		roof,
		[0, wallHeight + 0.22, 0],
	);
	lid.rotation.x = 0.16;

	// Inside: dark floor, the seat, a loo roll.
	part(
		parent,
		foldedBox(halfSize * 2 - 0.1, 0.04, halfSize * 2 - 0.1),
		dark,
		[0, 0.02, 0],
	);
	part(parent, foldedBox(1.1, 0.45, 0.5), plank, [0, 0.23, -0.4]);
	part(
		parent,
		new CylinderGeometry(0.14, 0.14, 0.01, 9),
		dark,
		[0, 0.46, -0.4],
	);
	part(
		parent,
		new CylinderGeometry(0.05, 0.05, 0.1, 7).rotateZ(Math.PI / 2),
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
			foldedBox(doorWidth / 4 - 0.008, doorHeight - 0.04, 0.04),
			plank,
			[
				-doorWidth / 2 + doorWidth / 8 + (i * doorWidth) / 4,
				doorHeight / 2,
				0,
			],
		);
	}
	for (const y of [0.35, doorHeight - 0.35]) {
		part(door, foldedBox(doorWidth - 0.04, 0.1, 0.03), barkDark, [
			0,
			y,
			0.035,
		]);
	}
	const brace = part(
		door,
		foldedBox(0.08, doorHeight - 0.8, 0.03),
		barkDark,
		[0, doorHeight / 2, 0.035],
	);
	brace.rotation.z = Math.atan2(doorWidth - 0.1, doorHeight - 0.8);
	const moon = new Shape();
	moon.absarc(0, 0, 0.08, Math.PI * 0.3, Math.PI * 1.7, false);
	moon.absarc(0.045, 0, 0.065, Math.PI * 1.55, Math.PI * 0.45, true);
	part(door, new ShapeGeometry(moon, 12), dark, [0, doorHeight - 0.2, 0.051]);
	// Handle.
	part(door, foldedBox(0.03, 0.12, 0.04), barkDark, [
		-doorWidth / 2 + 0.08,
		1,
		0.05,
	]);

	return hinge;
};

// The occupant, stepping out to look at his gloves.
const buildOccupant = (parent: Object3D): Occupant => {
	const person = createPerson(OCCUPANT, personMaterial());
	person.root.position.z = insideZ;
	parent.add(person.root);
	return {
		person,
		arms: [
			{ shoulder: person.rightArm, elbow: person.rightForearm },
			{ shoulder: person.leftArm, elbow: person.leftForearm },
		],
		legs: [person.rightLeg, person.leftLeg],
	};
};

export const OUTHOUSE: EasterEgg = {
	id: 'outhouse',
	clearingRadius: 12,
	footprint: { halfWidth: halfSize + 0.2, halfDepth: halfSize + 0.2 },
	gallery: {
		caption: m.egg_outhouse(),
		camera: [2.4, 1.9, 5.4],
		target: [0, 1.2, 0.6],
	},
	create: () => {
		const root = new Group();
		const hinge = buildOuthouse(root);
		const occupant = buildOccupant(root);

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
			const { person } = occupant;
			person.root.position.z = MathUtils.lerp(insideZ, outsideZ, step);
			const isWalking = step > 0 && step < 1;
			const stride = isWalking ? Math.sin(t * 13) : 0;
			for (const [i, leg] of occupant.legs.entries()) {
				leg.rotation.x = stride * (i === 0 ? 0.45 : -0.45);
			}
			person.body.position.y = isWalking ? -Math.abs(stride) * 0.03 : 0;

			// ...then stop, bring both hands up and take a good look at them.
			const inspect = MathUtils.smootherstep(t, 1.15, 1.65);
			const turn = Math.sin(t * 2.6);
			for (const [i, { shoulder, elbow }] of occupant.arms.entries()) {
				const side = i === 0 ? -1 : 1;
				// Up in front of his face, which his short arms only reach across.
				shoulder.rotation.set(
					MathUtils.lerp(stride * -0.4 * side, -1.3, inspect),
					0,
					side * MathUtils.lerp(0.08, -0.7, inspect),
				);
				// Palms up, then twisted over to check the backs.
				elbow.rotation.set(
					MathUtils.lerp(-0.1, -0.9, inspect),
					inspect * side * (0.6 + turn * 0.9),
					0,
				);
			}
			person.head.rotation.set(
				MathUtils.lerp(0, 0.25, inspect),
				inspect * turn * 0.15,
				inspect * Math.sin(t * 1.3) * 0.12,
			);
		};
		const moving = [hinge, ...occupant.person.joints];
		return { object: root, update, moving };
	},
};
