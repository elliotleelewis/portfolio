import {
	type CanvasTexture,
	CylinderGeometry,
	DoubleSide,
	Group,
	IcosahedronGeometry,
	MathUtils,
	type Mesh,
	type Object3D,
	PlaneGeometry,
	Vector3,
} from 'three';

import { m } from '../../paraglide/messages';
import { surface } from '../look/surfaces';
import { DANCER } from '../people/cast';
import { type Person, createPerson, personMaterial } from '../people/person';

import { canvasTexture, joint, part } from './parts';
import type { EasterEgg, EasterEggFrame } from './types';

// One dance beat, in seconds.
const beat = 0.42;
const cloudHeight = 3.3;
const billCount = 36;
const coinCount = 10;

// Canadian banknotes, in their denominations' colours.
const notes = [
	{ value: '5', color: '#3a7cc2' },
	{ value: '10', color: '#8756a6' },
	{ value: '20', color: '#3d8c53' },
	{ value: '50', color: '#c3413c' },
	{ value: '100', color: '#ad773c' },
] as const;

const noteTexture = (value: string, color: string): CanvasTexture =>
	canvasTexture(128, 60, (context) => {
		context.fillStyle = color;
		context.fillRect(0, 0, 128, 60);
		context.strokeStyle = 'rgba(255, 255, 255, 0.55)';
		context.lineWidth = 3;
		context.strokeRect(4, 4, 120, 52);
		// The clear polymer window.
		context.fillStyle = 'rgba(235, 245, 250, 0.85)';
		context.fillRect(88, 8, 22, 44);
		// Portrait oval.
		context.fillStyle = 'rgba(255, 255, 255, 0.3)';
		context.beginPath();
		context.ellipse(56, 30, 14, 18, 0, 0, Math.PI * 2);
		context.fill();
		context.fillStyle = '#ffffff';
		context.font = 'bold 22px system-ui, sans-serif';
		context.textBaseline = 'top';
		context.fillText(value, 10, 8);
		context.font = 'bold 9px system-ui, sans-serif';
		context.fillText('CANADA', 10, 44);
	});

// The dancer, and his arms and legs, his right (-x) first.
interface Dancer {
	person: Person;
	arms: { shoulder: Group; elbow: Group }[];
	legs: { hip: Group; knee: Group }[];
}

/**
 * Builds the dancer.
 * @param parent - What he dances in.
 * @returns Him.
 */
const buildDancer = (parent: Object3D): Dancer => {
	const person = createPerson(DANCER, personMaterial());
	parent.add(person.root);
	return {
		person,
		arms: [
			{ shoulder: person.rightArm, elbow: person.rightForearm },
			{ shoulder: person.leftArm, elbow: person.leftForearm },
		],
		legs: [
			{ hip: person.rightLeg, knee: person.rightShin },
			{ hip: person.leftLeg, knee: person.leftShin },
		],
	};
};

const buildCloud = (parent: Object3D): Group => {
	const cloud = joint(parent, [0, cloudHeight, 0]);
	const white = surface('#f4f6f7');
	const grey = surface('#c9ced3');
	for (const [x, y, z, r] of [
		[0, 0.1, 0, 0.42],
		[-0.42, 0, 0.05, 0.32],
		[0.42, 0.02, -0.04, 0.34],
		[-0.18, 0.28, -0.1, 0.3],
		[0.22, 0.25, 0.12, 0.28],
		[0, -0.02, 0.28, 0.26],
	] as const) {
		part(cloud, new IcosahedronGeometry(r, 1), white, [
			x,
			y,
			z,
		]).castShadow = false;
	}
	// A darker, flat underside.
	const base = part(
		cloud,
		new CylinderGeometry(0.7, 0.62, 0.12, 9),
		grey,
		[0, -0.12, 0],
	);
	base.castShadow = false;
	return cloud;
};

interface Money {
	mesh: Mesh;
	isCoin: boolean;
	position: Vector3;
	spin: Vector3;
	phase: number;
	// How long it's been lying on the ground, if it has landed.
	landed: number | undefined;
	rest: number;
}

export const MONEY_RAIN: EasterEgg = {
	id: 'money-rain',
	clearingRadius: 10.5,
	footprint: { halfWidth: 0.5, halfDepth: 0.5 },
	gallery: {
		caption: m.egg_money_rain(),
		camera: [1.6, 2.3, 6],
		target: [0, 1.7, 0],
	},
	create: () => {
		const root = new Group();
		const dancer = buildDancer(root);
		const cloud = buildCloud(root);

		// The money: a flurry of notes, plus the odd loonie.
		const noteGeometry = new PlaneGeometry(0.23, 0.108);
		const noteMaterials = notes.map(({ value, color }) =>
			surface('#ffffff', 'satin', {
				map: noteTexture(value, color),
				side: DoubleSide,
			}),
		);
		const loonie = new CylinderGeometry(0.045, 0.045, 0.01, 7);
		const loonieMaterial = surface('#d6a83a', 'metal');
		const respawn = (money: Money, height: number): void => {
			const angle = Math.random() * Math.PI * 2;
			const radius = Math.sqrt(Math.random()) * 0.65;
			money.position.set(
				Math.cos(angle) * radius,
				height,
				Math.sin(angle) * radius,
			);
			money.landed = undefined;
			money.rest = MathUtils.randFloat(1.5, 4);
		};
		const money: Money[] = Array.from(
			{ length: billCount + coinCount },
			(_, i) => {
				const isCoin = i >= billCount;
				const mesh = part(
					root,
					isCoin ? loonie : noteGeometry,
					isCoin
						? loonieMaterial
						: (noteMaterials[i % noteMaterials.length] ??
								loonieMaterial),
					[0, 0, 0],
				);
				mesh.castShadow = false;
				const item: Money = {
					mesh,
					isCoin,
					position: new Vector3(),
					spin: new Vector3(
						MathUtils.randFloatSpread(6),
						MathUtils.randFloatSpread(3),
						MathUtils.randFloatSpread(6),
					),
					phase: Math.random() * 10,
					landed: undefined,
					rest: 0,
				};
				// Start mid-shower.
				respawn(item, MathUtils.randFloat(0.1, cloudHeight - 0.2));
				return item;
			},
		);

		let pointing = 0;
		const update = ({ time, dt, player }: EasterEggFrame): void => {
			const beats = time / beat;
			const bar = Math.floor(beats / 8);
			const inBar = beats - bar * 8;
			const bounce = Math.abs(Math.sin(beats * Math.PI));

			// When I'm close he turns to point at me with both hands.
			const distance = Math.hypot(player.x, player.z);
			pointing = MathUtils.lerp(
				pointing,
				distance < 16 ? 1 : 0,
				1 - Math.exp(-5 * dt),
			);

			// Hop on every beat, hips swinging.
			dancer.person.body.position.y = bounce * 0.12;
			// Every other bar ends with a full spin.
			const spin =
				bar % 2 === 1
					? MathUtils.smootherstep(inBar, 6, 8) * Math.PI * 2
					: 0;
			dancer.person.root.rotation.y = MathUtils.lerp(
				Math.sin(beats * Math.PI) * 0.35 + spin,
				Math.atan2(player.x, player.z),
				pointing,
			);
			dancer.person.body.rotation.z = Math.sin(beats * Math.PI) * 0.12;

			// Knees up, alternating.
			for (const [i, { hip, knee }] of dancer.legs.entries()) {
				const lift = Math.max(0, Math.sin((beats + i) * Math.PI));
				hip.rotation.x = -1.1 * lift;
				knee.rotation.x = 1.4 * lift;
				hip.rotation.z = (i === 0 ? -1 : 1) * 0.1;
			}

			// Raise the roof: arms pumping overhead, alternating.
			for (const [i, { shoulder, elbow }] of dancer.arms.entries()) {
				const side = i === 0 ? -1 : 1;
				const pump = Math.sin((beats + i) * Math.PI);
				const up = 2.5 + pump * 0.35;
				shoulder.rotation.set(
					MathUtils.lerp(0, -1.45, pointing),
					0,
					side * MathUtils.lerp(up, 0.25, pointing),
				);
				elbow.rotation.set(
					0,
					0,
					side *
						MathUtils.lerp(
							0.5 + Math.max(0, pump) * 1.1,
							0,
							pointing,
						),
				);
			}
			dancer.person.head.rotation.set(
				-0.15 + bounce * 0.12,
				0,
				Math.sin(beats * Math.PI * 0.5) * 0.25,
			);

			// The cloud bobs along, just above him.
			cloud.position.y = cloudHeight + Math.sin(time * 1.3) * 0.08;
			cloud.rotation.y = Math.sin(time * 0.4) * 0.2;

			// Money flutters down, settles, then goes back up for another go.
			for (const item of money) {
				const { mesh, position } = item;
				if (item.landed === undefined) {
					const sway = Math.sin(time * 2.4 + item.phase);
					position.y -= (item.isCoin ? 2.6 : 0.9 + sway * 0.25) * dt;
					position.x += Math.cos(time * 1.7 + item.phase) * 0.25 * dt;
					position.z += sway * 0.2 * dt;
					mesh.rotation.x += item.spin.x * dt;
					mesh.rotation.y += item.spin.y * dt;
					mesh.rotation.z += item.spin.z * dt;
					if (position.y <= 0.01) {
						position.y = 0.006 + Math.random() * 0.01;
						item.landed = 0;
						// Lying flat, at a random angle.
						const angle = Math.random() * Math.PI * 2;
						if (item.isCoin) {
							mesh.rotation.set(0, angle, 0);
						} else {
							mesh.rotation.set(-Math.PI / 2, 0, angle);
						}
					}
				} else {
					item.landed += dt;
					if (item.landed > item.rest) {
						respawn(item, cloudHeight - 0.15);
					}
				}
				mesh.position.copy(position);
			}
		};
		const moving = [
			...dancer.person.joints,
			cloud,
			...money.map(({ mesh }) => mesh),
		];
		return { object: root, update, moving };
	},
};
