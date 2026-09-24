import {
	BoxGeometry,
	CapsuleGeometry,
	CircleGeometry,
	CylinderGeometry,
	DoubleSide,
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

// Jake: long wavy brown hair, round glasses, stubble, a stonewashed denim
// jacket over a white band tee, and his nose in a book.
const buildJake = (
	parent: Object3D,
): { head: Group; page: Group; upper: Group; knees: Group[] } => {
	const skin = standard('#e9c1a4');
	const hair = standard('#4e3120', { roughness: 0.95 });
	const stubble = standard('#5a3d29', { transparent: true, opacity: 0.55 });
	const mouth = standard('#6e3a33');
	const denim = standard('#91abc9');
	const denimDark = standard('#6f8db0');
	const jeans = standard('#2b2e35');
	const tee = standard('#f1eee8');
	const print = standard('#b3262e');
	const printDark = standard('#1d1b1c');
	const frames = standard('#cbb893', { roughness: 0.4 });
	const dark = standard('#2a211c');
	const shoes = standard('#1c1c1e');
	const cover = standard('#2f5d8a');
	const paper = standard('#faf6ea', { side: DoubleSide });

	// Hips, sitting on the edge of the boot.
	const hips = joint(parent, [0, 0, 0]);
	part(hips, new BoxGeometry(0.34, 0.14, 0.26), jeans, [0, 0.02, 0]);
	const thighGeometry = new CapsuleGeometry(0.075, 0.32, 4, 10);
	const shinGeometry = new CapsuleGeometry(0.066, 0.34, 4, 10);
	const shoeGeometry = new BoxGeometry(0.11, 0.08, 0.25);
	const knees = [-1, 1].map((side) => {
		const thigh = joint(hips, [side * 0.1, 0, 0.02]);
		part(thigh, thighGeometry, jeans, [0, 0, 0.2]).rotation.x = Math.PI / 2;
		// Legs dangle over the bumper, swinging a little.
		const knee = joint(thigh, [0, 0, 0.42]);
		part(knee, shinGeometry, jeans, [0, -0.22, 0]);
		part(knee, shoeGeometry, shoes, [0, -0.45, 0.05]);
		return knee;
	});

	// Upper body leans in towards the book.
	const upper = joint(hips, [0, 0.06, 0]);
	upper.rotation.x = 0.14;
	const jacket = part(
		upper,
		new CylinderGeometry(0.21, 0.18, 0.5, 14),
		denim,
		[0, 0.27, 0],
	);
	jacket.scale.z = 0.66;
	part(upper, new SphereGeometry(0.21, 14, 8), denim, [0, 0.5, 0]).scale.set(
		1,
		0.35,
		0.66,
	);
	// Open jacket: the tee (and its print) shows down the front.
	part(upper, new BoxGeometry(0.15, 0.44, 0.02), tee, [0, 0.3, 0.125]);
	part(upper, new BoxGeometry(0.11, 0.13, 0.01), print, [0, 0.33, 0.137]);
	part(
		upper,
		new BoxGeometry(0.11, 0.03, 0.012),
		printDark,
		[0, 0.41, 0.137],
	);
	for (const side of [-1, 1]) {
		part(upper, new BoxGeometry(0.035, 0.4, 0.02), denimDark, [
			side * 0.09,
			0.3,
			0.128,
		]);
		part(upper, new BoxGeometry(0.08, 0.07, 0.015), denimDark, [
			side * 0.13,
			0.36,
			0.12,
		]);
	}

	// Arms, bent to hold the book up.
	const upperArmGeometry = new CapsuleGeometry(0.06, 0.2, 4, 10);
	const forearmGeometry = new CapsuleGeometry(0.052, 0.18, 4, 10);
	const handGeometry = new SphereGeometry(0.045, 10, 8);
	for (const side of [-1, 1]) {
		const shoulder = joint(upper, [side * 0.23, 0.49, 0]);
		shoulder.rotation.set(-0.45, 0, side * -0.28);
		part(shoulder, upperArmGeometry, denim, [0, -0.14, 0]);
		const elbow = joint(shoulder, [0, -0.28, 0]);
		elbow.rotation.x = -1.35;
		part(elbow, forearmGeometry, denim, [0, -0.11, 0]);
		part(elbow, handGeometry, skin, [0, -0.25, 0]);
	}

	// The book: two covers open in a V, with a page that turns.
	const book = joint(upper, [0, 0.3, 0.33]);
	book.rotation.x = -0.75;
	const coverGeometry = new BoxGeometry(0.14, 0.2, 0.01);
	const pageGeometry = new BoxGeometry(0.13, 0.19, 0.012);
	for (const side of [-1, 1]) {
		const half = joint(book, [0, 0, 0]);
		half.rotation.y = side * -0.3;
		part(half, coverGeometry, cover, [side * 0.07, 0, -0.008]);
		part(half, pageGeometry, paper, [side * 0.066, 0, 0.004]);
	}
	const page = joint(book, [0, 0, 0.012]);
	const leaf = part(
		page,
		new BoxGeometry(0.125, 0.18, 0.002),
		paper,
		[0.063, 0, 0],
	);
	leaf.castShadow = false;

	// Neck & head.
	part(upper, new CylinderGeometry(0.05, 0.056, 0.1, 10), skin, [0, 0.58, 0]);
	const head = joint(upper, [0, 0.61, 0]);
	part(head, new SphereGeometry(0.115, 20, 16), skin, [0, 0.13, 0]).scale.set(
		0.92,
		1.12,
		1,
	);
	// Stubbly beard.
	const beard = part(
		head,
		new SphereGeometry(
			0.108,
			18,
			10,
			-Math.PI * 0.1,
			Math.PI * 1.2,
			Math.PI * 0.55,
			Math.PI * 0.4,
		),
		stubble,
		[0, 0.125, 0.008],
	);
	beard.scale.set(0.95, 1.12, 1);
	beard.castShadow = false;
	part(head, new BoxGeometry(0.06, 0.01, 0.01), stubble, [0, 0.1, 0.11]);
	// Big open grin & eyes.
	const grin = part(
		head,
		new CircleGeometry(0.03, 14, Math.PI, Math.PI),
		mouth,
		[0, 0.085, 0.109],
	);
	grin.scale.y = 0.7;
	grin.rotation.x = -0.25;
	const teeth = part(
		head,
		new CircleGeometry(0.027, 14, Math.PI, Math.PI),
		tee,
		[0, 0.085, 0.1105],
	);
	teeth.scale.y = 0.3;
	teeth.rotation.x = -0.25;
	const eyeGeometry = new SphereGeometry(0.011, 8, 6);
	for (const side of [-1, 1]) {
		part(head, eyeGeometry, dark, [side * 0.04, 0.14, 0.104]);
		// Round glasses.
		part(head, new TorusGeometry(0.031, 0.005, 6, 18), frames, [
			side * 0.043,
			0.14,
			0.114,
		]);
		part(head, new BoxGeometry(0.005, 0.005, 0.11), frames, [
			side * 0.085,
			0.15,
			0.06,
		]);
	}
	part(head, new BoxGeometry(0.024, 0.005, 0.005), frames, [0, 0.145, 0.116]);

	// Long, wavy hair: a centre parting, down past the shoulders.
	const crown = part(
		head,
		new SphereGeometry(0.125, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
		hair,
		[0, 0.15, -0.008],
	);
	crown.scale.set(0.98, 1.1, 1.05);
	const back = part(
		head,
		new CapsuleGeometry(0.12, 0.32, 6, 12),
		hair,
		[0, -0.02, -0.07],
	);
	back.scale.set(1.25, 1, 0.55);
	const strandGeometry = new CapsuleGeometry(0.042, 0.34, 4, 8);
	for (const side of [-1, 1]) {
		// Strands fall either side of the face and down over the shoulders.
		for (const [i, [x, z, tilt]] of [
			[0.125, -0.01, 0.06],
			[0.135, -0.05, 0.12],
			[0.15, 0.02, 0.22],
		].entries()) {
			const strand = part(head, strandGeometry, hair, [
				side * x,
				-0.04 - i * 0.04,
				z,
			]);
			strand.rotation.set((i - 1) * 0.12, 0, side * tilt);
		}
	}

	return { head, page, upper, knees };
};

// A black Chevy Tahoe with the liftgate up, parked with its boot facing +z.
const buildTahoe = (parent: Object3D): void => {
	const paint = standard('#0c0e11', { metalness: 0.55, roughness: 0.32 });
	const trim = standard('#161616');
	const glass = standard('#1a2530', { metalness: 0.3, roughness: 0.08 });
	const chrome = standard('#c7ccd1', { metalness: 0.9, roughness: 0.25 });
	const interior = standard('#2c2c2f');
	const rubber = standard('#141414', { roughness: 0.95 });
	const tail = standard('#b0131c', {
		emissive: '#6a0a10',
		roughness: 0.4,
	});
	const headlight = standard('#f5f2e6', {
		emissive: '#bfb9a4',
		roughness: 0.3,
	});
	const gold = standard('#d6a93a', { metalness: 0.7, roughness: 0.3 });

	// Body.
	part(parent, new BoxGeometry(2.02, 0.66, 5.2), paint, [0, 0.68, 0]);
	part(parent, new BoxGeometry(2, 0.3, 1.6), paint, [0, 1.16, -1.8]);
	part(parent, new BoxGeometry(1.94, 0.08, 3.6), paint, [0, 2, 0.8]);
	for (const side of [-1, 1]) {
		part(parent, new BoxGeometry(0.06, 0.36, 3.6), paint, [
			side * 0.98,
			1.18,
			0.8,
		]);
		part(parent, new BoxGeometry(0.04, 0.6, 3.3), glass, [
			side * 0.97,
			1.66,
			0.75,
		]);
		for (const z of [-0.2, 1.1]) {
			part(parent, new BoxGeometry(0.07, 0.62, 0.12), paint, [
				side * 0.97,
				1.66,
				z,
			]);
		}
		// D-pillar with the tall Tahoe tail lights.
		part(parent, new BoxGeometry(0.12, 1, 0.14), paint, [
			side * 0.94,
			1.5,
			2.54,
		]);
		part(parent, new BoxGeometry(0.08, 0.5, 0.05), tail, [
			side * 0.93,
			1.3,
			2.62,
		]);
		// Headlights & mirrors.
		part(parent, new BoxGeometry(0.36, 0.12, 0.05), headlight, [
			side * 0.72,
			1.06,
			-2.61,
		]);
		part(parent, new BoxGeometry(0.22, 0.14, 0.08), paint, [
			side * 1.08,
			1.5,
			-0.95,
		]);
	}
	const windshield = part(
		parent,
		new BoxGeometry(1.9, 0.82, 0.05),
		glass,
		[0, 1.64, -1.22],
	);
	windshield.rotation.x = 0.5;
	part(parent, new BoxGeometry(1.6, 0.34, 0.05), trim, [0, 0.95, -2.61]);
	part(parent, new BoxGeometry(1.6, 0.06, 0.06), chrome, [0, 1, -2.63]);
	part(parent, new BoxGeometry(2.04, 0.2, 0.28), trim, [0, 0.46, 2.6]);
	part(parent, new BoxGeometry(2.04, 0.2, 0.28), trim, [0, 0.46, -2.6]);

	// Cargo area, visible through the open boot.
	part(parent, new BoxGeometry(1.86, 0.04, 1.3), interior, [0, 1.02, 1.95]);
	part(parent, new BoxGeometry(1.8, 0.6, 0.14), interior, [0, 1.32, 1.3]);
	part(parent, new BoxGeometry(1.86, 0.02, 3.4), interior, [0, 1.95, 0.8]);

	// Liftgate, swung up on its roof hinge.
	const hinge = joint(parent, [0, 2, 2.6]);
	hinge.rotation.x = -1.95;
	part(hinge, new BoxGeometry(1.9, 1, 0.07), paint, [0, -0.5, 0]);
	part(hinge, new BoxGeometry(1.6, 0.44, 0.02), glass, [0, -0.3, 0.045]);
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
		part(parent, new BoxGeometry(0.05, 0.05, 3.2), trim, [
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

export const JAKE_TAHOE: EasterEgg = {
	id: 'jake-tahoe',
	clearingRadius: 13.5,
	footprint: { halfWidth: 1.1, halfDepth: 2.7 },
	gallery: {
		name: 'Jake',
		caption: 'Reading in the back of the Tahoe',
		camera: [3.4, 2.3, 7.4],
		target: [0, 1.2, 1.3],
	},
	create: () => {
		const root = new Group();
		buildTahoe(root);
		const jake = buildJake(joint(root, [0, 1.06, 2.25]));

		let lookUp = 0;
		const update = ({ time, dt, player }: EasterEggFrame): void => {
			// Glance up from the book as I roll past.
			const distance = Math.hypot(player.x, player.z);
			const target = distance < 28 ? 1 : 0;
			lookUp = MathUtils.lerp(lookUp, target, 1 - Math.exp(-4 * dt));
			const yaw = Math.atan2(player.x, Math.max(1, player.z - 2.25));
			jake.head.rotation.set(
				MathUtils.lerp(0.4, -0.15, lookUp),
				MathUtils.clamp(yaw, -0.9, 0.9) * lookUp,
				0,
			);
			jake.upper.rotation.x = MathUtils.lerp(0.14, 0.02, lookUp);

			// Turn a page every few seconds (right page over to the left).
			const turn = MathUtils.smootherstep(time % 5, 4.3, 4.9);
			jake.page.rotation.y = -0.3 - turn * (Math.PI - 0.6);

			// Swing the legs.
			for (const [i, knee] of jake.knees.entries()) {
				knee.rotation.x = Math.sin(time * 2 + i * Math.PI) * 0.18;
			}
		};
		return { object: root, update };
	},
};
