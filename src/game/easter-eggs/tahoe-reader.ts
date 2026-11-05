import {
	CylinderGeometry,
	DoubleSide,
	Group,
	MathUtils,
	type Object3D,
	Shape,
	ShapeGeometry,
} from 'three';

import { m } from '../../paraglide/messages';
import { roundedBox } from '../look/shapes';
import { surface } from '../look/surfaces';
import { READER } from '../people/cast';
import { type Person, createPerson, personMaterial } from '../people/person';

import { joint, part } from './parts';
import type { EasterEgg, EasterEggFrame } from './types';

// How high the boot's floor is, which the reader sits on the edge of.
const bootHeight = 1.06;
// How far up his hips are as he stands (`BONES` in people/person.ts).
const hipHeight = 0.72;
const readerZ = 2.45;

/**
 * The reader, sitting on the edge of the boot with his nose in a book.
 * @param parent - What he sits in.
 * @returns Him, and the page he turns.
 */
const buildReader = (parent: Object3D): { person: Person; page: Group } => {
	const person = createPerson(READER, personMaterial());
	// Right on the edge, so his short legs clear the bumper.
	person.root.position.set(0, bootHeight - hipHeight, readerZ);
	parent.add(person.root);
	// Sitting: thighs out over the bumper, shins hanging down.
	for (const leg of [person.leftLeg, person.rightLeg]) {
		leg.rotation.x = -Math.PI / 2;
	}
	// Arms bent to hold the book up by its edges, under his chin.
	for (const [arm, forearm, side] of [
		[person.rightArm, person.rightForearm, -1],
		[person.leftArm, person.leftForearm, 1],
	] as const) {
		arm.rotation.set(-0.65, 0, side * -0.9);
		forearm.rotation.x = -1.45;
	}

	// The book: two covers open in a V, with a page that turns.
	const cover = surface('#2f5d8a');
	const paper = surface('#faf6ea', 'matte', { side: DoubleSide });
	const book = joint(person.chest, [0, 0.22, 0.4]);
	book.rotation.x = -0.75;
	// Big enough for his big paper hands.
	book.scale.setScalar(1.3);
	const coverGeometry = roundedBox(0.14, 0.2, 0.01);
	const pageGeometry = roundedBox(0.13, 0.19, 0.012);
	for (const side of [-1, 1]) {
		const half = joint(book, [0, 0, 0]);
		half.rotation.y = side * -0.3;
		part(half, coverGeometry, cover, [side * 0.07, 0, -0.008]);
		part(half, pageGeometry, paper, [side * 0.066, 0, 0.004]);
	}
	const page = joint(book, [0, 0, 0.012]);
	const leaf = part(
		page,
		roundedBox(0.125, 0.18, 0.002),
		paper,
		[0.063, 0, 0],
	);
	leaf.castShadow = false;
	return { person, page };
};

// A black Chevy Tahoe with the liftgate up, parked with its boot facing +z.
const buildTahoe = (parent: Object3D): void => {
	const paint = surface('#0c0e11', 'gloss');
	const trim = surface('#161616');
	const glass = surface('#1a2530', 'gloss');
	const chrome = surface('#c7ccd1', 'metal');
	const interior = surface('#2c2c2f');
	const rubber = surface('#141414');
	const tail = surface('#b0131c', 'satin', { emissive: '#6a0a10' });
	const headlight = surface('#f5f2e6', 'gloss', { emissive: '#bfb9a4' });
	const gold = surface('#d6a93a', 'metal');

	// Body.
	part(parent, roundedBox(2.02, 0.66, 5.2), paint, [0, 0.68, 0]);
	part(parent, roundedBox(2, 0.3, 1.6), paint, [0, 1.16, -1.8]);
	part(parent, roundedBox(1.94, 0.08, 3.6), paint, [0, 2, 0.8]);
	for (const side of [-1, 1]) {
		part(parent, roundedBox(0.06, 0.36, 3.6), paint, [
			side * 0.98,
			1.18,
			0.8,
		]);
		part(parent, roundedBox(0.04, 0.6, 3.3), glass, [
			side * 0.97,
			1.66,
			0.75,
		]);
		for (const z of [-0.2, 1.1]) {
			part(parent, roundedBox(0.07, 0.62, 0.12), paint, [
				side * 0.97,
				1.66,
				z,
			]);
		}
		// D-pillar with the tall Tahoe tail lights.
		part(parent, roundedBox(0.12, 1, 0.14), paint, [
			side * 0.94,
			1.5,
			2.54,
		]);
		part(parent, roundedBox(0.08, 0.5, 0.05), tail, [
			side * 0.93,
			1.3,
			2.62,
		]);
		// Headlights & mirrors.
		part(parent, roundedBox(0.36, 0.12, 0.05), headlight, [
			side * 0.72,
			1.06,
			-2.61,
		]);
		part(parent, roundedBox(0.22, 0.14, 0.08), paint, [
			side * 1.08,
			1.5,
			-0.95,
		]);
	}
	const windshield = part(
		parent,
		roundedBox(1.9, 0.82, 0.05),
		glass,
		[0, 1.64, -1.22],
	);
	windshield.rotation.x = 0.5;
	part(parent, roundedBox(1.6, 0.34, 0.05), trim, [0, 0.95, -2.61]);
	part(parent, roundedBox(1.6, 0.06, 0.06), chrome, [0, 1, -2.63]);
	part(parent, roundedBox(2.04, 0.2, 0.28), trim, [0, 0.46, 2.6]);
	part(parent, roundedBox(2.04, 0.2, 0.28), trim, [0, 0.46, -2.6]);

	// Cargo area, visible through the open boot.
	part(parent, roundedBox(1.86, 0.04, 1.3), interior, [0, 1.02, 1.95]);
	part(parent, roundedBox(1.8, 0.6, 0.14), interior, [0, 1.32, 1.3]);
	part(parent, roundedBox(1.86, 0.02, 3.4), interior, [0, 1.95, 0.8]);

	// Liftgate, swung up on its roof hinge.
	const hinge = joint(parent, [0, 2, 2.6]);
	hinge.rotation.x = -1.95;
	part(hinge, roundedBox(1.9, 1, 0.07), paint, [0, -0.5, 0]);
	part(hinge, roundedBox(1.6, 0.44, 0.02), glass, [0, -0.3, 0.045]);
	const bowtie = new Shape();
	for (const [i, [x, y]] of (
		[
			[-0.14, 0.02],
			[-0.05, 0.02],
			[-0.05, 0.045],
			[0.05, 0.045],
			[0.05, 0.02],
			[0.14, 0.02],
			[0.12, -0.02],
			[0.05, -0.02],
			[0.05, -0.045],
			[-0.05, -0.045],
			[-0.05, -0.02],
			[-0.12, -0.02],
		] as const
	).entries()) {
		if (i === 0) {
			bowtie.moveTo(x, y);
		} else {
			bowtie.lineTo(x, y);
		}
	}
	part(hinge, new ShapeGeometry(bowtie), gold, [0, -0.65, 0.037]);

	// Roof rails.
	for (const side of [-1, 1]) {
		part(parent, roundedBox(0.05, 0.05, 3.2), trim, [
			side * 0.8,
			2.07,
			0.8,
		]);
	}

	// Wheels.
	const tyre = new CylinderGeometry(0.42, 0.42, 0.3, 20).rotateZ(Math.PI / 2);
	const hub = new CylinderGeometry(0.24, 0.24, 0.32, 16).rotateZ(Math.PI / 2);
	for (const x of [-0.95, 0.95]) {
		for (const z of [-1.7, 1.7]) {
			part(parent, tyre, rubber, [x, 0.42, z]);
			part(parent, hub, chrome, [x, 0.42, z]);
		}
	}
};

export const TAHOE_READER: EasterEgg = {
	id: 'tahoe-reader',
	clearingRadius: 13.5,
	footprint: { halfWidth: 1.1, halfDepth: 2.7 },
	gallery: {
		caption: m.egg_tahoe_reader(),
		camera: [3.4, 2.3, 7.4],
		target: [0, 1.2, 1.3],
	},
	create: () => {
		const root = new Group();
		buildTahoe(root);
		const reader = buildReader(root);
		const { person } = reader;

		let lookUp = 0;
		const update = ({ time, dt, player }: EasterEggFrame): void => {
			// Glance up from the book as I roll past.
			const distance = Math.hypot(player.x, player.z);
			const target = distance < 28 ? 1 : 0;
			lookUp = MathUtils.lerp(lookUp, target, 1 - Math.exp(-4 * dt));
			const yaw = Math.atan2(player.x, Math.max(1, player.z - readerZ));
			person.head.rotation.set(
				MathUtils.lerp(0.4, -0.15, lookUp),
				MathUtils.clamp(yaw, -0.9, 0.9) * lookUp,
				0,
			);
			person.chest.rotation.x = MathUtils.lerp(0.14, 0.02, lookUp);

			// Turn a page every few seconds (right page over to the left).
			const turn = MathUtils.smootherstep(time % 5, 4.3, 4.9);
			reader.page.rotation.y = -0.3 - turn * (Math.PI - 0.6);

			// Swing the legs.
			for (const [i, shin] of [
				person.leftShin,
				person.rightShin,
			].entries()) {
				shin.rotation.x =
					Math.PI / 2 - 0.3 + Math.sin(time * 2 + i * Math.PI) * 0.18;
			}
		};
		const moving = [...person.joints, reader.page];
		return { object: root, update, moving };
	},
};
