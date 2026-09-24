import {
	BoxGeometry,
	type CanvasTexture,
	CapsuleGeometry,
	CircleGeometry,
	CylinderGeometry,
	DoubleSide,
	Group,
	MathUtils,
	type Mesh,
	type Object3D,
	PlaneGeometry,
	RepeatWrapping,
	SphereGeometry,
	TorusGeometry,
	Vector3,
} from 'three';

import { canvasTexture, joint, part, standard } from './parts';
import { type EasterEgg, type EasterEggFrame } from './types';

// One dance beat, in seconds.
const beat = 0.42;
const cloudHeight = 3.3;
const billCount = 36;
const coinCount = 10;

// Where the flag's green meets the red, as a fraction round the torso
// (0 is the front, increasing towards his left): just right of centre
// from the front, as on the flag.
const flagSplit = 0.968;

// The Portugal flag wrapped all the way round a shirt: green on his right,
// red on his left, with the coat of arms on the join across his chest.
const flagTexture = (hasArms: boolean): CanvasTexture => {
	const texture = canvasTexture(512, 256, (context) => {
		const split = flagSplit * 512;
		context.fillStyle = '#d8262e';
		context.fillRect(0, 0, 512, 256);
		context.fillStyle = '#0a6a37';
		context.fillRect(256, 0, split - 256, 256);
		if (!hasArms) {
			return;
		}
		const outerShield = new Path2D(
			'M -20 86 L 20 86 L 20 120 Q 0 146 -20 120 Z',
		);
		const innerShield = new Path2D(
			'M -13 92 L 13 92 L 13 117 Q 0 135 -13 117 Z',
		);
		// Drawn either side of the wrap, so it isn't cut in half.
		for (const x of [split, split - 512]) {
			// Armillary sphere.
			context.strokeStyle = '#f5d000';
			context.lineWidth = 6;
			context.beginPath();
			context.ellipse(x, 110, 34, 38, 0, 0, Math.PI * 2);
			context.stroke();
			context.lineWidth = 4;
			context.beginPath();
			context.ellipse(x, 110, 34, 12, 0.35, 0, Math.PI * 2);
			context.stroke();
			// Shield: white, bordered in red, with the blue quinas.
			context.save();
			context.translate(x, 0);
			context.fillStyle = '#d8262e';
			context.fill(outerShield);
			context.fillStyle = '#ffffff';
			context.fill(innerShield);
			context.restore();
			context.fillStyle = '#1b3f93';
			for (const [dx, dy] of [
				[0, 97],
				[-7, 107],
				[0, 107],
				[7, 107],
				[0, 117],
			] as const) {
				context.fillRect(x + dx - 3, dy - 3, 6, 7);
			}
		}
	});
	texture.wrapS = RepeatWrapping;
	return texture;
};

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

interface Kevin {
	root: Group;
	body: Group;
	head: Group;
	arms: { shoulder: Group; elbow: Group }[];
	legs: { hip: Group; knee: Group }[];
}

// Kevin: short dark hair, faded at the sides; trimmed moustache and goatee;
// the widest grin; a gold chain; and a Portugal-flag tee.
const buildKevin = (parent: Object3D): Kevin => {
	const skin = standard('#e8bf9f');
	const hair = standard('#2a1d16', { roughness: 0.8 });
	const fade = standard('#2a1d16', { transparent: true, opacity: 0.55 });
	const stubble = standard('#2a1d16', { transparent: true, opacity: 0.4 });
	const shirt = standard('#ffffff', { map: flagTexture(true) });
	const shoulderShirt = standard('#ffffff', { map: flagTexture(false) });
	const green = standard('#0a6a37');
	const red = standard('#d8262e');
	const gold = standard('#d8b04a', { metalness: 0.9, roughness: 0.3 });
	const joggers = standard('#2f3238');
	const trainers = standard('#f0f0ee');
	const dark = standard('#1b1411');
	const teeth = standard('#f7f3e8');
	const mouth = standard('#6e3432');
	// Line the sphere's texture up with the cylinder's (the sphere's front is
	// a quarter of the way round its texture).
	if (shoulderShirt.map) {
		shoulderShirt.map.offset.x = -0.25;
	}

	const root = joint(parent, [0, 0, 0]);
	const body = joint(root, [0, 0, 0]);

	const legs = [-1, 1].map((side) => {
		const hip = joint(body, [side * 0.1, 0.92, 0]);
		part(
			hip,
			new CapsuleGeometry(0.078, 0.34, 4, 10),
			joggers,
			[0, -0.2, 0],
		);
		const knee = joint(hip, [0, -0.42, 0]);
		part(
			knee,
			new CapsuleGeometry(0.07, 0.34, 4, 10),
			joggers,
			[0, -0.2, 0],
		);
		part(
			knee,
			new BoxGeometry(0.12, 0.09, 0.27),
			trainers,
			[0, -0.44, 0.04],
		);
		return { hip, knee };
	});

	// Portugal-flag tee.
	part(
		body,
		new CylinderGeometry(0.19, 0.19, 0.16, 16),
		joggers,
		[0, 0.94, 0],
	);
	const torso = part(
		body,
		new CylinderGeometry(0.22, 0.19, 0.58, 24),
		shirt,
		[0, 1.2, 0],
	);
	torso.scale.z = 0.64;
	part(
		body,
		new SphereGeometry(0.22, 24, 12),
		shoulderShirt,
		[0, 1.46, 0],
	).scale.set(1, 0.35, 0.64);
	const necklace = part(
		body,
		new TorusGeometry(0.07, 0.005, 6, 18),
		gold,
		[0, 1.49, 0.05],
	);
	necklace.rotation.x = Math.PI / 2 - 0.9;

	// Arms: red sleeve on his left, green on his right.
	const arms = [-1, 1].map((side) => {
		const shoulder = joint(body, [side * 0.245, 1.45, 0]);
		part(
			shoulder,
			new CylinderGeometry(0.072, 0.066, 0.22, 12),
			side === 1 ? red : green,
			[0, -0.09, 0],
		);
		part(
			shoulder,
			new CapsuleGeometry(0.052, 0.14, 4, 10),
			skin,
			[0, -0.22, 0],
		);
		const elbow = joint(shoulder, [0, -0.3, 0]);
		part(
			elbow,
			new CapsuleGeometry(0.048, 0.2, 4, 10),
			skin,
			[0, -0.12, 0],
		);
		part(elbow, new SphereGeometry(0.056, 10, 8), skin, [0, -0.29, 0]);
		return { shoulder, elbow };
	});

	// Neck & head.
	part(body, new CylinderGeometry(0.055, 0.06, 0.1, 12), skin, [0, 1.55, 0]);
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
		part(head, new SphereGeometry(0.012, 8, 6), dark, [
			side * 0.043,
			0.148,
			0.106,
		]).scale.y = 0.5;
		part(head, new BoxGeometry(0.05, 0.013, 0.012), hair, [
			side * 0.043,
			0.182,
			0.108,
		]).rotation.z = side * -0.12;
	}
	part(head, new SphereGeometry(0.019, 8, 6), skin, [0, 0.12, 0.124]);
	// The biggest grin.
	const grin = part(
		head,
		new CircleGeometry(0.044, 16, Math.PI, Math.PI),
		mouth,
		[0, 0.085, 0.109],
	);
	grin.scale.y = 0.72;
	grin.rotation.x = -0.25;
	const smile = part(
		head,
		new CircleGeometry(0.041, 16, Math.PI, Math.PI),
		teeth,
		[0, 0.085, 0.1105],
	);
	smile.scale.y = 0.4;
	smile.rotation.x = -0.25;
	// Moustache & goatee, over stubble.
	part(head, new BoxGeometry(0.08, 0.014, 0.012), hair, [0, 0.098, 0.112]);
	for (const side of [-1, 1]) {
		part(head, new BoxGeometry(0.012, 0.05, 0.012), hair, [
			side * 0.043,
			0.07,
			0.106,
		]);
	}
	part(
		head,
		new SphereGeometry(0.03, 12, 8),
		hair,
		[0, 0.03, 0.09],
	).scale.set(1.1, 0.8, 0.6);
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

	// Faded sides (the sphere leaves a gap for his face), textured top.
	const sides = part(
		head,
		new SphereGeometry(
			0.123,
			20,
			12,
			Math.PI * 0.85,
			Math.PI * 1.3,
			0,
			Math.PI * 0.55,
		),
		fade,
		[0, 0.13, -0.005],
	);
	sides.scale.set(0.95, 1.14, 1.02);
	sides.castShadow = false;
	const top = part(
		head,
		new SphereGeometry(0.115, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.32),
		hair,
		[0, 0.19, 0.005],
	);
	top.scale.set(0.95, 1.2, 1.02);
	const tuft = new BoxGeometry(0.04, 0.022, 0.05);
	for (const [x, z, tilt] of [
		[-0.04, 0.07, 0.2],
		[0, 0.08, 0],
		[0.04, 0.07, -0.2],
		[-0.02, 0.02, 0.1],
		[0.03, 0.03, -0.1],
	] as const) {
		const piece = part(head, tuft, hair, [x, 0.268, z]);
		piece.rotation.set(-0.25, 0, tilt);
	}

	return { root, body, head, arms, legs };
};

const buildCloud = (parent: Object3D): Group => {
	const cloud = joint(parent, [0, cloudHeight, 0]);
	const white = standard('#f4f6f7', { roughness: 1 });
	const grey = standard('#c9ced3', { roughness: 1 });
	for (const [x, y, z, r] of [
		[0, 0.1, 0, 0.42],
		[-0.42, 0, 0.05, 0.32],
		[0.42, 0.02, -0.04, 0.34],
		[-0.18, 0.28, -0.1, 0.3],
		[0.22, 0.25, 0.12, 0.28],
		[0, -0.02, 0.28, 0.26],
	] as const) {
		part(cloud, new SphereGeometry(r, 14, 10), white, [
			x,
			y,
			z,
		]).castShadow = false;
	}
	// A darker, flat underside.
	const base = part(
		cloud,
		new CylinderGeometry(0.7, 0.62, 0.12, 16),
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

export const KEVIN_MONEY_RAIN: EasterEgg = {
	id: 'kevin-money-rain',
	clearingRadius: 7,
	footprint: { halfWidth: 0.5, halfDepth: 0.5 },
	create: () => {
		const root = new Group();
		const kevin = buildKevin(root);
		const cloud = buildCloud(root);

		// The money: a flurry of notes, plus the odd loonie.
		const noteGeometry = new PlaneGeometry(0.23, 0.108);
		const noteMaterials = notes.map(({ value, color }) =>
			standard('#ffffff', {
				map: noteTexture(value, color),
				side: DoubleSide,
				roughness: 0.6,
			}),
		);
		const loonie = new CylinderGeometry(0.045, 0.045, 0.01, 11);
		const loonieMaterial = standard('#d6a83a', {
			metalness: 0.85,
			roughness: 0.3,
		});
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
			kevin.body.position.y = bounce * 0.12;
			// Every other bar ends with a full spin.
			const spin =
				bar % 2 === 1
					? MathUtils.smootherstep(inBar, 6, 8) * Math.PI * 2
					: 0;
			kevin.root.rotation.y = MathUtils.lerp(
				Math.sin(beats * Math.PI) * 0.35 + spin,
				Math.atan2(player.x, player.z),
				pointing,
			);
			kevin.body.rotation.z = Math.sin(beats * Math.PI) * 0.12;

			// Knees up, alternating.
			for (const [i, { hip, knee }] of kevin.legs.entries()) {
				const lift = Math.max(0, Math.sin((beats + i) * Math.PI));
				hip.rotation.x = -1.1 * lift;
				knee.rotation.x = 1.4 * lift;
				hip.rotation.z = (i === 0 ? -1 : 1) * 0.1;
			}

			// Raise the roof: arms pumping overhead, alternating.
			for (const [i, { shoulder, elbow }] of kevin.arms.entries()) {
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
			kevin.head.rotation.set(
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
		return { object: root, update };
	},
};
