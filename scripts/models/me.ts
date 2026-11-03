// The procedural version of me: the template that models/me.glb started
// from (see models/README.md). It's only used to make that template again
// (`pnpm models:template`), never by the game.
import {
	type BufferGeometry,
	CircleGeometry,
	ExtrudeGeometry,
	Group,
	type Material,
	Mesh,
	type MeshStandardMaterial,
	Object3D,
	Shape,
	SphereGeometry,
	TorusGeometry,
	Vector3,
} from 'three';

import {
	type SweepPoint,
	lathe,
	roundedBox,
	sweep,
} from '../../src/game/look/shapes';
import { TONES, surface } from '../../src/game/look/surfaces';

// My clothes and colouring, each finished like the rest of the world.
const createMaterials = (): Record<
	| 'skin'
	| 'hair'
	| 'shirt'
	| 'trousers'
	| 'shoes'
	| 'soles'
	| 'pack'
	| 'packTrim'
	| 'frames'
	| 'eye'
	| 'teeth'
	| 'mouth',
	MeshStandardMaterial
> => ({
	skin: surface('#efc3a4'),
	hair: surface('#c9a46c'),
	shirt: surface('#868b84'),
	trousers: surface('#3e434a'),
	shoes: surface('#5b4a3a'),
	soles: surface('#2f2925'),
	pack: surface('#4e5452'),
	packTrim: surface('#3a3f3d'),
	// Clear glasses.
	frames: surface('#b9bcbd', 'gloss', { transparent: true, opacity: 0.6 }),
	eye: surface('#3a2e28'),
	teeth: surface(TONES.teeth),
	mouth: surface(TONES.mouth),
});

type Materials = ReturnType<typeof createMaterials>;

/**
 * Places a part on what it's part of.
 * @param parent - What it's part of.
 * @param geometry - Its shape.
 * @param material - What it's made of.
 * @param at - Where it is on its parent.
 * @param hasShadow - Whether it casts a shadow: not the little things on
 * my face, whose shadows would only fall inside my head's.
 * @returns The part.
 */
const add = (
	parent: Object3D,
	geometry: BufferGeometry,
	material: Material,
	at: readonly [number, number, number] = [0, 0, 0],
	hasShadow = true,
): Mesh => {
	const part = new Mesh(geometry, material);
	part.position.set(...at);
	part.castShadow = hasShadow;
	parent.add(part);
	return part;
};

/**
 * My own, steady random numbers, so I'm drawn the same every time.
 * @param seed - Which numbers.
 * @returns Numbers from 0 to 1.
 */
const steadyRandom = (seed: number): (() => number) => {
	let state = seed;
	return () => {
		state = (state * 16_807) % 2_147_483_647;
		return (state - 1) / 2_147_483_646;
	};
};

/**
 * Points along a sweep, from `[x, y, z, radius]`.
 * @param points - Each point.
 * @returns The points.
 */
const path = (
	...points: (readonly [number, number, number, number])[]
): SweepPoint[] =>
	points.map(([x, y, z, radius]) => ({ at: [x, y, z], radius }));

// My head, from the chin up, as how far out it is at each height above my
// neck: a jaw that narrows to the chin, full cheeks and a rounded crown.
const headOutline = [
	[0, 0.02],
	[0.04, 0.024],
	[0.072, 0.045],
	[0.095, 0.08],
	[0.108, 0.12],
	[0.117, 0.165],
	[0.118, 0.2],
	[0.11, 0.24],
	[0.088, 0.276],
	[0.05, 0.3],
	[0, 0.307],
] as const;
// It's a little narrower than it is deep.
const headWidth = 0.92;

/**
 * How far out my face is at a height, so what's on it sits on it.
 * @param y - The height, above my neck.
 * @param inset - How far in from my face.
 * @returns How far out it is.
 */
const faceAt = (y: number, inset = 0): number => {
	for (let i = 1; i < headOutline.length; i++) {
		const [r1, y1] = headOutline[i] ?? [0, 0];
		const [r0, y0] = headOutline[i - 1] ?? [0, 0];
		if (y <= y1) {
			return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0) - inset;
		}
	}
	return -inset;
};

/**
 * The frame round one lens of my glasses: a rounded rectangle.
 * @returns Its shape.
 */
const lensFrame = (): ExtrudeGeometry => {
	const w = 0.044;
	const h = 0.031;
	const r = 0.012;
	const t = 0.0055;
	const rounded = (
		shape: Shape,
		halfWidth: number,
		halfHeight: number,
		round: number,
	): Shape => {
		shape.moveTo(-halfWidth + round, -halfHeight);
		shape.lineTo(halfWidth - round, -halfHeight);
		shape.quadraticCurveTo(
			halfWidth,
			-halfHeight,
			halfWidth,
			-halfHeight + round,
		);
		shape.lineTo(halfWidth, halfHeight - round);
		shape.quadraticCurveTo(
			halfWidth,
			halfHeight,
			halfWidth - round,
			halfHeight,
		);
		shape.lineTo(-halfWidth + round, halfHeight);
		shape.quadraticCurveTo(
			-halfWidth,
			halfHeight,
			-halfWidth,
			halfHeight - round,
		);
		shape.lineTo(-halfWidth, -halfHeight + round);
		shape.quadraticCurveTo(
			-halfWidth,
			-halfHeight,
			-halfWidth + round,
			-halfHeight,
		);
		return shape;
	};
	const outline = rounded(new Shape(), w, h, r);
	outline.holes.push(rounded(new Shape(), w - t, h - t, r - t / 2));
	return new ExtrudeGeometry(outline, {
		depth: 0.004,
		bevelEnabled: true,
		bevelThickness: 0.0015,
		bevelSize: 0.0015,
		bevelSegments: 1,
		curveSegments: 3,
	});
};

/**
 * My hair: short and sandy, swept up into spiky tufts and a quiff.
 * @param head - My head.
 * @param mats - My materials.
 */
const buildHair = (head: Object3D, mats: Materials): void => {
	// Close-cropped at the back and sides, following my head's shape, and
	// tipped back: high at my forehead, down to the nape of my neck.
	const crown = 0.17;
	add(
		head,
		lathe(
			headOutline
				.filter(([, y]) => y >= 0.13)
				.map(([r, y]) => [r === 0 ? 0 : r + 0.011, y + 0.005] as const),
			{ sides: 24, width: headWidth, depth: 1.05 },
		)
			.translate(0, -crown, 0)
			.rotateX(-0.32)
			.translate(0, crown, -0.004),
		mats.hair,
	);
	// Tufts all over the top, each a tapering lock swept up and back, a
	// little different from the next.
	const random = steadyRandom(7);
	const centre = new Vector3(0, 0.185, -0.01);
	const direction = new Vector3();
	const up = new Vector3(0, 1, 0);
	for (let i = 0; i < 34; i++) {
		// Rings of tufts, from round the crown in to the top.
		const ring = Math.floor(i / 12);
		const elevation = 0.45 + ring * 0.4 + random() * 0.12;
		const azimuth = (i / 12) * Math.PI * 2 + ring * 0.4 + random() * 0.3;
		direction
			.set(
				Math.cos(azimuth) * Math.cos(elevation) * headWidth,
				Math.sin(elevation),
				Math.sin(azimuth) * Math.cos(elevation),
			)
			.normalize();
		const base = centre.clone().addScaledVector(direction, 0.118);
		const length = 0.03 + random() * 0.022;
		const lean = direction.clone().addScaledVector(up, 0.45);
		lean.z -= 0.45;
		lean.normalize();
		const middle = base.clone().addScaledVector(lean, length * 0.5);
		const tip = base
			.clone()
			.addScaledVector(lean, length)
			.addScaledVector(direction, length * 0.25);
		add(
			head,
			sweep(
				[
					{ at: [base.x, base.y, base.z], radius: 0.018 },
					{ at: [middle.x, middle.y, middle.z], radius: 0.011 },
					{ at: [tip.x, tip.y, tip.z], radius: 0.0015 },
				],
				{ sides: 5, steps: 2 },
			),
			mats.hair,
		);
	}
	// The quiff, up and forward over my forehead.
	for (let i = -3; i <= 3; i++) {
		const x = i * 0.018;
		const rise = 0.028 - Math.abs(i) * 0.004;
		add(
			head,
			sweep(
				path(
					[x, 0.24, 0.07, 0.018],
					[x * 1.05, 0.275 + rise * 0.5, 0.085, 0.012],
					[x * 1.15, 0.29 + rise, 0.075, 0.002],
				),
				{ sides: 6, steps: 3 },
			),
			mats.hair,
		);
	}
};

/**
 * My face: eyes, brows, nose, ears, a big grin and clear-framed glasses.
 * @param head - My head.
 * @param mats - My materials.
 * @returns My eyes, which blink.
 */
const buildFace = (head: Object3D, mats: Materials): Mesh[] => {
	const eyeY = 0.15;
	const eyeX = 0.041;
	// Eyes: dark and oval, set a little into my face.
	const eyeGeometry = new SphereGeometry(0.0135, 12, 10).scale(1, 1.2, 0.6);
	const eyes = [-1, 1].map((side) =>
		add(
			head,
			eyeGeometry,
			mats.eye,
			[side * eyeX, eyeY, faceAt(eyeY, 0.012)],
			false,
		),
	);
	// Brows, arched over them.
	for (const side of [-1, 1]) {
		const y = eyeY + 0.033;
		const z = faceAt(y, 0.004);
		add(
			head,
			sweep(
				path(
					[side * 0.02, y - 0.002, z + 0.003, 0.004],
					[side * 0.042, y + 0.004, z, 0.0055],
					[side * 0.063, y - 0.001, z - 0.008, 0.003],
				),
				{ sides: 5, steps: 2 },
			),
			mats.hair,
			undefined,
			false,
		);
	}
	// Nose: a soft wedge, out and down from between my eyes.
	const bridge = faceAt(0.145, 0.008);
	const tip = faceAt(0.118, -0.012);
	const underneath = faceAt(0.108, -0.016);
	add(
		head,
		sweep(
			path(
				[0, 0.145, bridge, 0.009],
				[0, 0.118, tip, 0.0135],
				[0, 0.108, underneath, 0.012],
			),
			{ sides: 8, steps: 2 },
		),
		mats.skin,
		undefined,
		false,
	);
	// Ears.
	const ear = new SphereGeometry(0.03, 12, 10).scale(0.35, 1, 0.7);
	for (const side of [-1, 1]) {
		add(head, ear, mats.skin, [
			side * faceAt(0.14) * headWidth,
			0.14,
			-0.005,
		]);
	}
	// A big grin, with teeth.
	const mouthY = 0.075;
	for (const [radius, squash, material, inset] of [
		[0.042, 0.62, mats.mouth, 0.004],
		[0.037, 0.32, mats.teeth, 0.0025],
	] as const) {
		const grin = add(
			head,
			new CircleGeometry(radius, 18, Math.PI, Math.PI),
			material,
			[
				0,
				mouthY + (material === mats.teeth ? 0.002 : 0),
				faceAt(mouthY, inset),
			],
			false,
		);
		grin.scale.y = squash;
		grin.rotation.x = -0.38;
	}
	// Clear-framed glasses, their arms back over my ears.
	const lensY = eyeY + 0.003;
	const lensZ = faceAt(lensY) + 0.004;
	const frame = lensFrame();
	for (const side of [-1, 1]) {
		// Turned a little to wrap round my face.
		add(
			head,
			frame,
			mats.frames,
			[side * 0.047, lensY, lensZ],
			false,
		).rotation.y = -side * 0.22;
		add(
			head,
			sweep(
				path(
					[side * 0.089, lensY + 0.008, lensZ - 0.01, 0.0028],
					[side * 0.1, lensY + 0.008, lensZ - 0.045, 0.0028],
					[side * 0.104, lensY + 0.002, -0.01, 0.0028],
					[side * 0.1, lensY - 0.02, -0.03, 0.0028],
				),
				{ sides: 4, steps: 3 },
			),
			mats.frames,
			undefined,
			false,
		);
	}
	add(
		head,
		sweep(
			path(
				[-0.004, lensY + 0.005, lensZ + 0.003, 0.0025],
				[0, lensY + 0.009, lensZ + 0.005, 0.0025],
				[0.004, lensY + 0.005, lensZ + 0.003, 0.0025],
			),
			{ sides: 4, steps: 2 },
		),
		mats.frames,
		undefined,
		false,
	);
	return eyes;
};

/**
 * My head, on my neck.
 * @param mats - My materials.
 * @returns My head, and my eyes.
 */
const buildHead = (mats: Materials): { head: Group; eyes: Mesh[] } => {
	const head = new Group();
	// Sat down on my neck a little, below the joint it turns on.
	const skull = new Group();
	skull.position.y = -0.025;
	head.add(skull);
	add(skull, lathe(headOutline, { sides: 26, width: headWidth }), mats.skin);
	buildHair(skull, mats);
	const eyes = buildFace(skull, mats);
	return { head, eyes };
};

/**
 * One of my arms, from the shoulder: a tee's short sleeve, a bare arm,
 * a little bent at the elbow, and a hand.
 * @param side - 1 for my left, -1 for my right.
 * @param mats - My materials.
 * @returns The arm, and where my hand is.
 */
const buildArm = (
	side: 1 | -1,
	mats: Materials,
): { arm: Group; hand: Object3D } => {
	const arm = new Group();
	arm.position.set(side * 0.235, 1.46, 0);
	arm.rotation.z = side * 0.08;

	// The sleeve, round my shoulder and open at the hem.
	add(
		arm,
		lathe(
			[
				[0.064, -0.215],
				[0.071, -0.205],
				[0.073, -0.12],
				[0.074, -0.03],
				[0.06, 0.03],
				[0.03, 0.055],
				[0, 0.06],
			],
			{ sides: 16, depth: 0.95 },
		),
		mats.shirt,
	);
	// My arm, from inside the sleeve to the wrist.
	add(
		arm,
		sweep(
			path(
				[0, -0.15, 0, 0.047],
				[0, -0.3, -0.005, 0.044],
				[0, -0.4, 0.003, 0.039],
				[0, -0.53, 0.018, 0.036],
				[0, -0.63, 0.022, 0.029],
			),
			{ sides: 12, steps: 3 },
		),
		mats.skin,
	);
	// My hand: a palm, four fingers curled a little, and a thumb.
	const hand = new Object3D();
	hand.position.set(0, -0.69, 0.02);
	arm.add(hand);
	add(
		hand,
		lathe(
			[
				[0, -0.035],
				[0.03, -0.03],
				[0.04, -0.005],
				[0.037, 0.025],
				[0.026, 0.045],
				[0, 0.05],
			],
			{ sides: 12, width: 0.55, depth: 1 },
		),
		mats.skin,
	);
	for (let i = 0; i < 4; i++) {
		const z = -0.022 + i * 0.015;
		add(
			hand,
			sweep(
				path(
					[0, -0.028, z, 0.009],
					[side * -0.002, -0.058, z + 0.002, 0.008],
					[side * -0.008, -0.075, z + 0.005, 0.0065],
				),
				{ sides: 6, steps: 2 },
			),
			mats.skin,
		);
	}
	add(
		hand,
		sweep(
			path(
				[side * -0.01, 0.002, 0.028, 0.011],
				[side * -0.014, -0.022, 0.042, 0.009],
				[side * -0.012, -0.04, 0.044, 0.0075],
			),
			{ sides: 6, steps: 2 },
		),
		mats.skin,
	);
	return { arm, hand };
};

/**
 * One of my legs, from the hip: walking trousers and a trail shoe.
 * @param side - 1 for my left, -1 for my right.
 * @param mats - My materials.
 * @returns The leg, and where my foot is.
 */
const buildLeg = (
	side: 1 | -1,
	mats: Materials,
): { leg: Group; foot: Object3D } => {
	const leg = new Group();
	leg.position.set(side * 0.1, 0.95, 0);

	// Trousers: full at the thigh, a little loose at the knee, and a cuff
	// over my shoe.
	add(
		leg,
		sweep(
			path(
				[0, 0, 0, 0.088],
				[side * 0.004, -0.2, 0.004, 0.083],
				[side * 0.002, -0.45, 0.012, 0.07],
				[0, -0.7, 0, 0.066],
				[0, -0.82, -0.01, 0.07],
			),
			{ sides: 14, steps: 3 },
		),
		mats.trousers,
	);
	// The shoe: a rounded upper, wider at the toe, on a darker sole.
	const foot = new Object3D();
	foot.position.set(0, -0.9, 0.04);
	leg.add(foot);
	add(
		foot,
		sweep(
			path(
				[0, 0.015, -0.1, 0.042],
				[0, 0.025, -0.04, 0.05],
				[0, 0.012, 0.06, 0.048],
				[0, 0.002, 0.11, 0.036],
			),
			{ sides: 12, steps: 3, flatten: 1.45 },
		),
		mats.shoes,
	);
	add(
		foot,
		roundedBox(0.105, 0.026, 0.26, 0.012),
		mats.soles,
		[0, -0.033, 0.008],
	);
	return { leg, foot };
};

/**
 * My torso: a grey tee over my shoulders, the top of my trousers, and my
 * neck.
 * @param body - My body.
 * @param mats - My materials.
 */
const buildTorso = (body: Object3D, mats: Materials): void => {
	// The tee, from its hem over my hips up to the collar: a little in at the
	// waist, out at the chest, and over my shoulders.
	add(
		body,
		lathe(
			[
				[0.188, 0.9],
				[0.193, 0.94],
				[0.186, 1.04],
				[0.195, 1.16],
				[0.214, 1.3],
				[0.218, 1.39],
				[0.205, 1.45],
				[0.165, 1.5],
				[0.1, 1.525],
				[0.06, 1.53],
				[0, 1.53],
			],
			{ sides: 22, depth: 0.62 },
		),
		mats.shirt,
	);
	// Its collar.
	add(
		body,
		new TorusGeometry(0.058, 0.009, 6, 18)
			.rotateX(Math.PI / 2)
			.scale(1, 1, 0.85),
		mats.shirt,
		[0, 1.528, 0.004],
	);
	// The top of my trousers, tucked under the tee.
	add(
		body,
		lathe(
			[
				[0, 0.84],
				[0.14, 0.845],
				[0.172, 0.88],
				[0.176, 0.93],
				[0.17, 0.96],
			],
			{ sides: 22, depth: 0.6 },
		),
		mats.trousers,
	);
	// My neck.
	add(
		body,
		lathe(
			[
				[0.054, 1.5],
				[0.05, 1.56],
				[0.052, 1.6],
			],
			{ sides: 14 },
		),
		mats.skin,
	);
};

/**
 * My backpack: a soft daypack with a lid and a front pocket, its straps over
 * my shoulders.
 * @param body - My body.
 * @param mats - My materials.
 */
const buildPack = (body: Object3D, mats: Materials): void => {
	add(body, roundedBox(0.3, 0.4, 0.15, 0.05), mats.pack, [0, 1.22, -0.19]);
	// Lid.
	add(
		body,
		roundedBox(0.28, 0.07, 0.165, 0.03),
		mats.packTrim,
		[0, 1.415, -0.19],
	);
	// Front pocket.
	add(
		body,
		roundedBox(0.22, 0.16, 0.05, 0.022),
		mats.packTrim,
		[0, 1.12, -0.27],
	);
	// Straps: up from the pack, over my shoulders and down my front.
	for (const side of [-1, 1]) {
		const x = side * 0.105;
		add(
			body,
			sweep(
				path(
					[x, 1.38, -0.13, 0.016],
					[x * 1.05, 1.48, -0.1, 0.016],
					[x * 1.1, 1.505, 0, 0.016],
					[x * 1.08, 1.46, 0.13, 0.016],
					[x * 1.05, 1.3, 0.145, 0.016],
					[x * 1.15, 1.13, 0.13, 0.016],
				),
				{ sides: 6, steps: 3, flatten: 2.5 },
			),
			mats.packTrim,
		);
	}
};

/**
 * Builds me, stylised, standing in my rest pose with my feet at the origin:
 * sandy spiky hair, clear glasses, a grey tee, walking trousers, trail
 * shoes and a backpack.
 * @returns My body, the joints the game turns, and where my hands and feet
 * are.
 */
export const buildMe = (): {
	body: Group;
	head: Group;
	arms: [Group, Group];
	legs: [Group, Group];
	hands: [Object3D, Object3D];
	feet: [Object3D, Object3D];
	eyes: Mesh[];
} => {
	const mats = createMaterials();
	const body = new Group();
	buildTorso(body, mats);
	buildPack(body, mats);
	const { head, eyes } = buildHead(mats);
	head.position.y = 1.57;
	body.add(head);
	const left = buildArm(1, mats);
	const right = buildArm(-1, mats);
	body.add(left.arm, right.arm);
	const leftLeg = buildLeg(1, mats);
	const rightLeg = buildLeg(-1, mats);
	body.add(leftLeg.leg, rightLeg.leg);
	return {
		body,
		head,
		arms: [left.arm, right.arm],
		legs: [leftLeg.leg, rightLeg.leg],
		hands: [left.hand, right.hand],
		feet: [leftLeg.foot, rightLeg.foot],
		eyes,
	};
};
