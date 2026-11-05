import {
	type BufferGeometry,
	Color,
	Group,
	type Material,
	Mesh,
	Object3D,
	type Vector3,
} from 'three';

import {
	at,
	ball,
	block,
	cutOut,
	fold,
	keep,
	near,
	oval,
	prism,
	rectangle,
	spike,
	steadyRandom,
} from '../look/paper';
import { TONES, surface } from '../look/surfaces';

/**
 * People in the world's folded-paper style (models/README.md, "The
 * style"), built from a description, on the game's humanoid skeleton:
 * chunky, about four heads tall, faces cut from paper, and recognisable by
 * their hair, glasses, expression and clothes.
 */

// What a mouth can look like. A person's first is their everyday one.
type Mouth = 'grin' | 'smile' | 'shout' | 'knockedOut';

/**
 * How someone looks. Colours are sRGB hex.
 */
export interface PersonSpec {
	// Their folds' shades, so each person's are their own.
	seed: number;
	skin: string;
	blush?: string;
	hair: {
		colour: string;
		// Underneath and at the roots.
		under: string;
		style:
			| 'spiky'
			| 'wavy'
			| 'slicked'
			| 'crop'
			| 'short'
			| 'long'
			| 'fade';
	};
	beanie?: { colour: string; cuff: string };
	// A trucker cap, with a flag's patch on the front: its ground, its
	// stripes and its corner.
	trucker?: { colour: string; patch: readonly [string, string, string] };
	// A peaked cap, its band chequered in two colours, with a badge.
	cap?: {
		colour: string;
		band: readonly [string, string];
		peak: string;
		badge: string;
	};
	brows?: string;
	stubble?: string;
	beard?: string;
	moustache?: string;
	goatee?: string;
	// Glasses' frames; clubmasters' colour is their brow bar, over dark
	// lenses in a thin rim.
	glasses?: {
		colour: string;
		shape: 'rectangle' | 'round' | 'clubmaster';
		lens?: string;
		rim?: string;
	};
	top: {
		colour: string;
		// A short-sleeved tee, or a long-sleeved top (a fleece) with a
		// quarter-zip.
		sleeves: 'short' | 'long';
		zip?: string;
		// The zip's collar, if it's not the top's own colour.
		collar?: string;
		// A stripe down the outside of each sleeve.
		piping?: string;
		// Round the collar and the ends of short sleeves.
		trim?: string;
		// What shows at the neck, under the zip.
		under?: string;
		// A hood, down behind the neck.
		hood?: boolean;
		// Their right side (-x), all the way round, if it's not the top's
		// colour: a flag, wrapped round, splits on a fold.
		right?: string;
		// A crest on the front, where the right side meets the left.
		crest?: { ring: string; shield: string };
		// Worn open, over a tee with a print on it.
		open?: { tee: string; print: string; edge: string };
	};
	// A hi-vis vest over the top, with reflective stripes round it.
	vest?: { colour: string; stripes: string };
	belt?: string;
	// Gloves over their hands, and the colour of their fingertips.
	gloves?: { colour: string; tips: string };
	chain?: string;
	// Trousers, or shorts over socks.
	trousers: string;
	shorts?: { socks: string; turnover: string };
	shoes: string;
	soles: string;
	pack?: { colour: string; dark: string };
	mouths: readonly [Mouth, ...Mouth[]];
}

// The bones of the game's humanoid skeleton (models/README.md) a person is
// built on, and which each moves with.
export type Bone =
	| 'pelvis'
	| 'spine_03'
	| 'Head'
	| 'upperarm_l'
	| 'upperarm_r'
	| 'lowerarm_l'
	| 'lowerarm_r'
	| 'palm_l'
	| 'palm_r'
	| 'thigh_l'
	| 'thigh_r'
	| 'calf_l'
	| 'calf_r'
	| 'sole_l'
	| 'sole_r';

// Where each bone is at rest, and what it hangs from.
const shoulder = at(0.28, 0, 1.13);
const elbow = at(0.33, 0, 0.92);
const wrist = at(0.385, -0.02, 0.71);
const hip = at(0.11, 0, 0.72);
const knee = at(0.11, 0, 0.42);
const ankle = at(0.11, 0, 0.12);

/**
 * The same point on the other side.
 * @param v - The point.
 * @returns It, mirrored.
 */
const mirror = (v: Vector3): Vector3 => v.clone().setX(-v.x);

export const BONES: readonly { name: Bone; head: Vector3; parent?: Bone }[] = [
	{ name: 'pelvis', head: at(0, 0, 0.72) },
	{ name: 'spine_03', head: at(0, 0, 0.92), parent: 'pelvis' },
	{ name: 'Head', head: at(0, 0, 1.28), parent: 'spine_03' },
	...(['l', 'r'] as const).flatMap((side) => {
		const flip = side === 'l' ? (v: Vector3) => v.clone() : mirror;
		return [
			{
				name: `upperarm_${side}` as const,
				head: flip(shoulder),
				parent: 'spine_03' as const,
			},
			{
				name: `lowerarm_${side}` as const,
				head: flip(elbow),
				parent: `upperarm_${side}` as const,
			},
			{
				name: `palm_${side}` as const,
				head: flip(near(wrist, 0, 0, -0.07)),
				parent: `lowerarm_${side}` as const,
			},
			{
				name: `thigh_${side}` as const,
				head: flip(hip),
				parent: 'pelvis' as const,
			},
			{
				name: `calf_${side}` as const,
				head: flip(knee),
				parent: `thigh_${side}` as const,
			},
			{
				name: `sole_${side}` as const,
				head: flip(at(0.11, -0.05, 0.001)),
				parent: `calf_${side}` as const,
			},
		];
	}),
];

/**
 * A piece of a person: stiff paper, moving with one bone, as one.
 */
export interface PersonPart {
	// Folded and coloured, where it is on the person at rest.
	geometry: BufferGeometry;
	bone: Bone;
	// Part of their eyes, which blink, or of one of their mouths' faces,
	// shown only with it.
	isEye?: boolean;
	mouth?: Mouth;
}

// How much lighter or darker each fold is than its paper's colour.
const folds = 0.07;

// Where a top split down the middle splits: just to their right of it, on
// a fold.
const split = -0.03;

// Their head: a big faceted ball, their face a flat sheet just in front.
const head = at(0, 0, 1.52);
const headSize = 0.26;
const face = near(head, 0, -0.236, 0);

/**
 * A grin's outline, its corners up.
 * @param w - Half its width.
 * @param h - How deep it is.
 * @returns The outline.
 */
const halfOval = (w: number, h: number): [number, number][] =>
	Array.from({ length: 11 }, (_value, k) => [
		Math.cos(Math.PI + (Math.PI * k) / 10) * w,
		Math.sin(Math.PI + (Math.PI * k) / 10) * h,
	]);

/**
 * A thin, wobbly band: a knocked-out mouth, a closed smile.
 * @param w - Half its width.
 * @param thick - Half its thickness.
 * @param shape - How far up or down it is across its width (-1 to 1).
 * @returns The outline.
 */
const band = (
	w: number,
	thick: number,
	shape: (u: number) => number,
): [number, number][] => {
	const line = Array.from({ length: 13 }, (_value, k): [number, number] => {
		const u = (k / 12) * 2 - 1;
		return [u * w, shape(u)];
	});
	return [
		...line.map(([x, y]): [number, number] => [x, y + thick]),
		...line.toReversed().map(([x, y]): [number, number] => [x, y - thick]),
	];
};

/**
 * A mouth's shapes, cut from paper, and their colours.
 * @param kind - The mouth.
 * @param lift - How far in front of the face it's stuck.
 * @returns Its shapes.
 */
const mouthShapes = (kind: Mouth, lift: number): [BufferGeometry, string][] => {
	const mouth = near(face, 0, -lift, -0.07);
	if (kind === 'grin') {
		// A big grin, with teeth.
		const grin = halfOval(0.075, 0.05);
		const teeth = grin.map(([x, y]): [number, number] => [
			x * 0.86,
			Math.max(y, -0.016) * 0.86,
		]);
		const behind = near(mouth, 0, 0, -0.002);
		return [
			[cutOut(grin, mouth, 0.002), TONES.mouth],
			[cutOut(teeth, behind, 0.004), TONES.teeth],
		];
	}
	if (kind === 'smile') {
		// A calm, closed smile.
		const smile = band(0.045, 0.006, (u) => -0.012 * (1 - u * u));
		return [[cutOut(smile, mouth, 0.002), TONES.mouth]];
	}
	if (kind === 'shout') {
		const open = oval(0.032, 0.04);
		return [[cutOut(open, near(mouth, 0, 0, -0.01), 0.002), TONES.throat]];
	}
	// Knocked out: a small, wobbly line.
	const wobble = band(0.04, 0.0055, (u) => Math.sin((u + 1) * 6.6) * 0.005);
	return [[cutOut(wobble, near(mouth, 0, 0, -0.015), 0.002), TONES.mouth]];
};

/**
 * Builds a person's parts, folded and coloured, from how they look.
 * @param spec - How they look.
 * @returns Their parts.
 */
export const personParts = (spec: PersonSpec): PersonPart[] => {
	const random = steadyRandom(spec.seed);
	const parts: PersonPart[] = [];
	const add = (
		bone: Bone,
		geometry: BufferGeometry,
		colour: string,
		{
			shade = folds,
			...rest
		}: { shade?: number } & Omit<PersonPart, 'geometry' | 'bone'> = {},
	): void => {
		const { r, g, b } = new Color(colour);
		parts.push({
			geometry: fold(geometry, [r, g, b], shade, random),
			bone,
			...rest,
		});
	};
	// What's cut out and stuck on is one flat colour.
	const flat = { shade: 0 };

	const isLongSleeves = spec.top.sleeves === 'long';
	for (const side of ['l', 'r'] as const) {
		const flip = side === 'l' ? (v: Vector3) => v.clone() : mirror;
		const s = side === 'l' ? 1 : -1;
		// Legs, bending at the knee.
		const thighTop = flip(near(hip, 0, 0, 0.06));
		const shinTop = flip(near(knee, 0, 0, 0.03));
		const shinBottom = flip(near(ankle, 0, 0, 0.02));
		if (spec.shorts) {
			// Shorts, bare knees and socks, their tops turned over.
			const hem = flip(hip.clone().lerp(knee, 0.55));
			add(
				`thigh_${side}`,
				prism(thighTop, hem, 0.11, 0.105, 6),
				spec.trousers,
			);
			add(
				`thigh_${side}`,
				prism(hem, flip(knee), 0.075, 0.07, 5),
				spec.skin,
			);
			add(`calf_${side}`, ball(flip(knee), 0.07), spec.skin);
			const turnover = flip(near(knee, 0, 0, -0.06));
			add(
				`calf_${side}`,
				prism(turnover, shinBottom, 0.08, 0.076, 6),
				spec.shorts.socks,
			);
			add(
				`calf_${side}`,
				prism(shinTop, turnover, 0.088, 0.086, 6),
				spec.shorts.turnover,
			);
		} else {
			add(
				`thigh_${side}`,
				prism(thighTop, flip(knee), 0.1, 0.088, 6),
				spec.trousers,
			);
			add(
				`calf_${side}`,
				prism(shinTop, shinBottom, 0.088, 0.08, 6),
				spec.trousers,
			);
		}
		// Shoes, on darker soles.
		const [shoe, sole] = [
			flip(at(0.11, -0.05, 0.075)),
			flip(at(0.11, -0.05, 0.016)),
		];
		add(`calf_${side}`, block(shoe, [0.17, 0.3, 0.12], 0.02), spec.shoes);
		add(`calf_${side}`, block(sole, [0.18, 0.31, 0.032]), spec.soles);
		// Arms, in sleeves, bending at the elbow, and hands.
		const sleeveTop = flip(near(shoulder, -0.01, 0, 0.03));
		const upperSleeve = flip(
			shoulder.clone().lerp(elbow, isLongSleeves ? 1 : 0.55),
		);
		const sleeve =
			side === 'r'
				? (spec.top.right ?? spec.top.colour)
				: spec.top.colour;
		add(
			`upperarm_${side}`,
			prism(sleeveTop, upperSleeve, 0.088, 0.082, 6),
			sleeve,
		);
		const forearm = isLongSleeves ? sleeve : spec.skin;
		if (isLongSleeves) {
			add(`lowerarm_${side}`, ball(flip(elbow), 0.075), sleeve);
			add(
				`lowerarm_${side}`,
				prism(flip(elbow), flip(wrist), 0.075, 0.062, 6),
				forearm,
			);
		} else {
			if (spec.top.trim) {
				const [from, to] = [
					shoulder.clone().lerp(elbow, 0.47),
					shoulder.clone().lerp(elbow, 0.56),
				];
				add(
					`upperarm_${side}`,
					prism(flip(from), flip(to), 0.092, 0.092, 6),
					spec.top.trim,
				);
			}
			const armTop = flip(shoulder.clone().lerp(elbow, 0.4));
			add(
				`upperarm_${side}`,
				prism(armTop, flip(elbow), 0.06, 0.056, 5),
				spec.skin,
			);
			add(`lowerarm_${side}`, ball(flip(elbow), 0.057), spec.skin);
			add(
				`lowerarm_${side}`,
				prism(flip(elbow), flip(wrist), 0.056, 0.048, 5),
				forearm,
			);
		}
		if (spec.top.piping) {
			// Down the outside of the sleeve, from the shoulder.
			const [from, to] = [
				near(shoulder, 0.075, 0, 0.01),
				near(shoulder.clone().lerp(elbow, 0.95), 0.08, 0, 0),
			];
			add(
				`upperarm_${side}`,
				prism(flip(from), flip(to), 0.012, 0.012, 4),
				spec.top.piping,
				{ shade: 0 },
			);
		}
		const hand = flip(near(wrist, 0, 0, -0.05));
		const { gloves } = spec;
		add(
			`lowerarm_${side}`,
			ball(hand, 0.068, [0.8, 0.9, 1.1]),
			gloves?.colour ?? spec.skin,
		);
		if (gloves) {
			// A cuff at the wrist, and fingertips dipped in something.
			const [cuffTop, cuffBottom, tips] = [
				near(wrist, 0, 0, 0.02),
				near(wrist, 0, 0, -0.03),
				near(wrist, 0, 0, -0.105),
			];
			add(
				`lowerarm_${side}`,
				prism(flip(cuffTop), flip(cuffBottom), 0.062, 0.062, 6),
				gloves.colour,
			);
			add(
				`lowerarm_${side}`,
				ball(flip(tips), 0.05, [0.9, 0.95, 0.55]),
				gloves.tips,
			);
		}
		// Ears, sticking out a little.
		const ear = near(head, s * 0.235, 0.02, -0.02);
		add('Head', ball(ear, 0.065, [0.45, 0.8, 1]), spec.skin);
	}

	// Their middle: the top of their trousers, and a top over their chest.
	add(
		'pelvis',
		prism(at(0, 0, 0.62), at(0, 0, 0.84), 0.2, 0.2, 7, 0.3),
		spec.trousers,
	);
	for (const piece of [
		prism(at(0, 0, 0.78), at(0, 0, 1.2), 0.205, 0.25, 7, 0.3),
		prism(at(0, 0, 1.18), at(0, 0, 1.25), 0.25, 0.14, 7, 0.3),
	]) {
		const { right } = spec.top;
		if (right === undefined) {
			add('spine_03', piece, spec.top.colour);
			continue;
		}
		// Split along its folds, just to their right of the middle.
		add(
			'spine_03',
			keep(piece.clone(), (c) => c.x < split),
			right,
		);
		add(
			'spine_03',
			keep(piece, (c) => c.x >= split),
			spec.top.colour,
		);
	}
	if (spec.top.crest) {
		// A ring round a shield, on the join.
		const { crest } = spec.top;
		const where = at(split, -0.245, 1.04);
		add(
			'spine_03',
			cutOut(oval(0.05, 0.055), where, 0, [oval(0.038, 0.043)]),
			crest.ring,
			flat,
		);
		add(
			'spine_03',
			cutOut(rectangle(0.022, 0.026), where, 0.002),
			crest.shield,
			flat,
		);
	}
	add(
		'spine_03',
		prism(at(0, 0, 1.2), at(0, 0, 1.32), 0.075, 0.072, 6),
		spec.skin,
	);
	if (spec.top.zip) {
		// A quarter-zip: a collar up round the neck, and the zip.
		add(
			'spine_03',
			prism(at(0, 0, 1.22), at(0, 0, 1.31), 0.1, 0.09, 7),
			spec.top.collar ?? spec.top.colour,
		);
		if (spec.top.under) {
			add(
				'spine_03',
				block(at(0, -0.095, 1.255), [0.08, 0.02, 0.06]),
				spec.top.under,
			);
		}
		add(
			'spine_03',
			block(at(0, -0.215, 1.1), [0.012, 0.012, 0.2]),
			spec.top.zip,
			{ shade: 0 },
		);
	}
	if (spec.chain) {
		const link = prism(
			at(0, -0.12, 1.255),
			at(0, -0.12, 1.262),
			0.085,
			0.085,
			10,
		);
		add('spine_03', link, spec.chain, { shade: 0 });
	}
	if (spec.top.trim) {
		add(
			'spine_03',
			prism(at(0, 0, 1.22), at(0, 0, 1.27), 0.105, 0.1, 7),
			spec.top.trim,
		);
	}
	if (spec.top.open) {
		// Open down the front: the tee, its print, and the edges either side.
		const { open } = spec.top;
		add('spine_03', block(at(0, -0.225, 1), [0.15, 0.03, 0.4]), open.tee);
		add(
			'spine_03',
			block(at(0, -0.245, 1.04), [0.1, 0.01, 0.12]),
			open.print,
			{ shade: 0.02 },
		);
		for (const s of [1, -1]) {
			add(
				'spine_03',
				block(at(s * 0.095, -0.215, 1), [0.04, 0.03, 0.42]),
				open.edge,
			);
		}
	}
	if (spec.top.hood) {
		add(
			'spine_03',
			ball(at(0, 0.13, 1.25), 0.17, [1, 0.6, 0.5]),
			spec.top.colour,
		);
	}
	if (spec.vest) {
		// Over the top, a little bigger, and the stripes a little bigger
		// again.
		const { vest } = spec;
		const around = (up: number): number =>
			0.222 + ((up - 0.86) / 0.34) * 0.04;
		add(
			'spine_03',
			prism(
				at(0, 0, 0.86),
				at(0, 0, 1.2),
				around(0.86),
				around(1.2),
				7,
				0.3,
			),
			vest.colour,
		);
		for (const up of [0.95, 1.06]) {
			const [bottom, top] = [up - 0.018, up + 0.018];
			add(
				'spine_03',
				prism(
					at(0, 0, bottom),
					at(0, 0, top),
					around(bottom) + 0.006,
					around(top) + 0.006,
					7,
					0.3,
				),
				vest.stripes,
				{ shade: 0.03 },
			);
		}
	}
	if (spec.belt) {
		add(
			'pelvis',
			prism(at(0, 0, 0.79), at(0, 0, 0.85), 0.222, 0.222, 7, 0.3),
			spec.belt,
		);
		add(
			'pelvis',
			block(at(0.21, -0.04, 0.77), [0.07, 0.09, 0.11], 0.015),
			spec.belt,
		);
	}
	if (spec.pack) {
		// A daypack, with a lid, and its straps over the shoulders.
		add(
			'spine_03',
			block(at(0, 0.28, 0.97), [0.36, 0.18, 0.44], 0.03),
			spec.pack.colour,
		);
		add(
			'spine_03',
			block(at(0, 0.28, 1.19), [0.34, 0.2, 0.08], 0.02),
			spec.pack.dark,
		);
		for (const s of [1, -1]) {
			add(
				'spine_03',
				block(at(s * 0.13, -0.245, 1), [0.055, 0.02, 0.4]),
				spec.pack.dark,
			);
			add(
				'spine_03',
				block(at(s * 0.15, 0, 1.235), [0.055, 0.5, 0.02]),
				spec.pack.dark,
			);
		}
	}

	// The head: a big, faceted ball.
	add('Head', ball(head, headSize, [0.92, 0.9, 1], 1), spec.skin, {
		shade: 0.05,
	});

	// Hair.
	switch (spec.hair.style) {
		case 'spiky': {
			// A folded cap, darker underneath, and tousled spikes, swept up and
			// forward at the front.
			const cap = near(head, 0, 0.05, 0.1);
			add('Head', ball(cap, 0.25, [0.96, 0.96, 0.72]), spec.hair.under);
			for (let k = 0; k < 26; k++) {
				const t = (2 * Math.PI * k) / 26 + (random() - 0.5) * 0.2;
				const ring = [0.18, 0.12, 0.06][k % 3] ?? 0.1;
				const [x, y] = [Math.cos(t) * ring, Math.sin(t) * ring + 0.02];
				const base = near(head, x, y, 0.2 - ring * 0.25);
				const front = Math.max(0, -Math.sin(t));
				const lean = at(
					Math.cos(t) * 0.45,
					Math.sin(t) * 0.45 - 0.35 * front,
					1,
				);
				const width = 0.065 + random() * 0.015;
				const length = 0.06 + random() * 0.03 + 0.05 * front;
				add(
					'Head',
					spike(base, lean, width, length),
					spec.hair.colour,
					{
						shade: 0.1,
					},
				);
			}
			break;
		}
		case 'fade': {
			// Faded at the sides: a cap in the fade's colour, the top longer
			// and darker, in tufts.
			// Low, so the top shows above it.
			const cap = near(head, 0, 0.03, 0.04);
			add(
				'Head',
				ball(cap, 0.27, [0.97, 0.97, 0.78], 1),
				spec.hair.under,
				{ shade: 0.05 },
			);
			add(
				'Head',
				ball(near(head, 0, 0.01, 0.19), 0.23, [0.95, 0.98, 0.45], 1),
				spec.hair.colour,
				{ shade: 0.08 },
			);
			for (const [x, back] of [
				[-0.08, -0.1],
				[0, -0.13],
				[0.08, -0.1],
				[-0.04, 0.02],
				[0.05, 0.03],
			]) {
				const base = near(head, x, back, 0.27);
				add(
					'Head',
					spike(base, at(x, -0.3, 1), 0.04, 0.06),
					spec.hair.colour,
					{
						shade: 0.1,
					},
				);
			}
			break;
		}
		case 'crop':
		case 'short': {
			// Cropped close: a cap hugging the head, and for a crop, a short
			// spiky fringe, pushed up at the front.
			const cap = near(head, 0, 0.03, 0.08);
			// Folded finely: it's close enough to the head for a coarse
			// ball's flat faces to dip inside it.
			add(
				'Head',
				ball(cap, 0.266, [0.97, 0.97, 0.75], 1),
				spec.hair.colour,
				{
					shade: 0.08,
				},
			);
			if (spec.hair.style === 'crop') {
				for (let k = -3; k <= 3; k++) {
					const base = near(
						head,
						k * 0.038,
						-0.165 + Math.abs(k) * 0.012,
						0.17,
					);
					const lean = at(k * 0.1, -0.9, 0.7);
					add(
						'Head',
						spike(base, lean, 0.03, 0.075),
						spec.hair.colour,
						{
							shade: 0.1,
						},
					);
				}
			}
			break;
		}
		case 'slicked': {
			// Slicked back: a cap swept off the forehead, long at the back down
			// to the collar and over the ears, with combed ridges along the top.
			const cap = near(head, 0, 0.05, 0.07);
			add('Head', ball(cap, 0.272, [0.99, 1, 0.82]), spec.hair.under);
			add(
				'Head',
				prism(
					near(head, 0, 0.1, 0.02),
					near(head, 0, 0.13, -0.24),
					0.21,
					0.16,
					7,
				),
				spec.hair.under,
			);
			for (const x of [-0.13, -0.045, 0.045, 0.13]) {
				add(
					'Head',
					prism(
						near(head, x, -0.13, 0.185),
						near(head, x * 1.15, 0.2, 0.17),
						0.035,
						0.02,
						4,
						random(),
					),
					spec.hair.colour,
					{ shade: 0.1 },
				);
			}
			for (const s of [1, -1]) {
				add(
					'Head',
					prism(
						near(head, s * 0.215, 0.03, 0.09),
						near(head, s * 0.235, 0.1, -0.18),
						0.055,
						0.045,
						5,
					),
					spec.hair.colour,
					{ shade: 0.1 },
				);
			}
			break;
		}
		case 'long': {
			// Long and wavy, from a centre parting: a cap, a fall down the
			// back to the shoulders, and strands either side of the face.
			const cap = near(head, 0, 0.03, 0.06);
			add(
				'Head',
				ball(cap, 0.272, [0.98, 0.98, 0.84], 1),
				spec.hair.colour,
				{ shade: 0.08 },
			);
			add(
				'Head',
				prism(
					near(head, 0, 0.1, 0.05),
					near(head, 0, 0.15, -0.36),
					0.22,
					0.2,
					7,
					random(),
				),
				spec.hair.under,
				{ shade: 0.1 },
			);
			for (const s of [1, -1]) {
				for (const [x, back, twist] of [
					[0.2, -0.06, 0.4],
					[0.225, 0.04, 1.3],
				]) {
					add(
						'Head',
						prism(
							near(head, s * x, back, 0.12),
							near(head, s * (x + 0.04), back + 0.04, -0.33),
							0.06,
							0.045,
							5,
							twist,
						),
						spec.hair.colour,
						{ shade: 0.1 },
					);
				}
			}
			break;
		}
		case 'wavy': {
			// Wavy: a cap that shows round the sides and back of the head, below
			// a beanie if there is one, and locks curling out from it at the
			// temples, over the ears and at the nape, clear of the face.
			const cap = near(head, 0, 0.04, 0.04);
			add('Head', ball(cap, 0.272, [0.98, 0.98, 0.84]), spec.hair.under);
			const locks: [number, number, number, number, number, number][] = [
				// where it grows (across, back, up), then where it falls to
				[0.2, -0.09, 0.1, 0.035, -0.04, -0.09],
				[-0.2, -0.09, 0.1, -0.035, -0.04, -0.09],
				[0.245, 0.03, 0.02, 0.04, 0.02, -0.12],
				[-0.245, 0.03, 0.02, -0.04, 0.02, -0.12],
				[0.15, 0.2, -0.02, 0.05, 0.04, -0.12],
				[0, 0.24, -0.02, 0, 0.05, -0.13],
				[-0.15, 0.2, -0.02, -0.05, 0.04, -0.12],
			];
			for (const [x, y, z, dx, dy, dz] of locks) {
				const from = near(head, x, y, z);
				add(
					'Head',
					prism(
						from,
						near(from, dx, dy, dz),
						0.045,
						0.014,
						5,
						random(),
					),
					spec.hair.colour,
					{ shade: 0.1 },
				);
			}
		}
	}
	if (spec.beanie) {
		// A knitted beanie over the hair, slouching a little at the back, its
		// cuff folded up above the brows and ribbed.
		const crown = near(head, 0, 0.03, 0.16);
		add('Head', ball(crown, 0.255, [0.98, 1, 0.74]), spec.beanie.colour, {
			shade: 0.1,
		});
		add(
			'Head',
			prism(
				near(head, 0, 0.01, 0.105),
				near(head, 0, 0.02, 0.185),
				0.262,
				0.238,
				14,
			),
			spec.beanie.cuff,
			{ shade: 0.08 },
		);
		add(
			'Head',
			block(near(head, 0.255, 0.02, 0.14), [0.008, 0.04, 0.03]),
			'#141414',
			{ shade: 0 },
		);
	}

	if (spec.trucker) {
		// A trucker cap: a crown over the top of the head, a brim, and a
		// patch tipped back with the crown's front.
		const { trucker } = spec;
		const crown = ball(
			near(head, 0, 0.01, 0.06),
			0.275,
			[0.97, 0.97, 0.9],
			1,
		);
		add(
			'Head',
			keep(crown, (c) => c.y > head.y + 0.1),
			trucker.colour,
		);
		add(
			'Head',
			ball(near(head, 0, -0.22, 0.1), 0.17, [0.95, 0.75, 0.1]),
			trucker.colour,
			{
				shade: 0.04,
			},
		);
		const [ground, stripes, corner] = trucker.patch;
		const patch = (shape: BufferGeometry): BufferGeometry =>
			shape
				.rotateX(-0.5)
				.translate(head.x, head.y + 0.18, head.z + 0.235);
		const [middle, cornerAt] = [at(0, 0, 0), at(-0.025, 0, 0.015)];
		const backing = cutOut(rectangle(0.04, 0.026), middle);
		add('Head', patch(backing), ground, flat);
		for (const k of [-1, 0, 1]) {
			const stripe = cutOut(
				rectangle(0.04, 0.004),
				at(0, 0, k * 0.016),
				0.002,
			);
			add('Head', patch(stripe), stripes, flat);
		}
		const canton = patch(cutOut(rectangle(0.015, 0.011), cornerAt, 0.003));
		add('Head', canton, corner, flat);
	}
	if (spec.cap) {
		// A peaked cap: a crown over a chequered band, a badge and a peak.
		const { cap } = spec;
		add(
			'Head',
			prism(
				near(head, 0, 0, 0.2),
				near(head, 0, 0, 0.27),
				0.262,
				0.285,
				12,
			),
			cap.colour,
		);
		const segments = 12;
		const width = (2 * Math.PI * 0.256) / segments;
		for (const [row, up] of [0.1375, 0.1725].entries()) {
			for (let k = 0; k < segments; k++) {
				const turn = (2 * Math.PI * k) / segments;
				const square = block(at(0, 0, 0), [width, 0.012, 0.035])
					.rotateY(turn)
					.translate(
						head.x + Math.sin(turn) * 0.256,
						head.y + up,
						head.z + Math.cos(turn) * 0.256,
					);
				add('Head', square, cap.band[(k + row) % 2] ?? cap.colour, {
					shade: 0.02,
				});
			}
		}
		add(
			'Head',
			ball(near(head, 0, -0.2, 0.12), 0.17, [1, 0.6, 0.1]),
			cap.peak,
			{ shade: 0.04 },
		);
		add(
			'Head',
			block(near(head, 0, -0.27, 0.235), [0.05, 0.012, 0.05]),
			cap.badge,
			{ shade: 0 },
		);
	}

	// The face, cut from paper.
	for (const s of [1, -1]) {
		const eye = near(face, s * 0.08, 0, 0.035);
		add('Head', cutOut(oval(0.022, 0.026), eye), TONES.pupil, {
			...flat,
			isEye: true,
		});
		if (spec.brows) {
			const brow = near(face, s * 0.085, 0, 0.09);
			add(
				'Head',
				cutOut(rectangle(0.04, 0.008), brow, 0.003, [], s * -0.12),
				spec.brows,
				flat,
			);
		}
		if (spec.blush) {
			const cheek = near(face, s * 0.14, 0.03, -0.045);
			add('Head', cutOut(oval(0.034, 0.025), cheek), spec.blush, flat);
		}
		const { glasses } = spec;
		if (glasses?.shape === 'clubmaster') {
			const lens = near(face, s * 0.085, 0, 0.035);
			const bar = near(face, s * 0.085, 0, 0.068);
			const rim = cutOut(oval(0.058, 0.047), lens, 0.012);
			add('Head', rim, glasses.rim ?? glasses.colour, flat);
			const dark = cutOut(oval(0.052, 0.041), lens, 0.013);
			add('Head', dark, glasses.lens ?? glasses.colour, flat);
			const brow = cutOut(rectangle(0.064, 0.014), bar, 0.014);
			add('Head', brow, glasses.colour, flat);
		} else if (spec.glasses) {
			const lens = near(face, s * 0.085, 0, 0.04);
			const frame =
				spec.glasses.shape === 'round'
					? cutOut(oval(0.052, 0.048), lens, 0.012, [
							oval(0.041, 0.037),
						])
					: cutOut(rectangle(0.066, 0.047), lens, 0.012, [
							rectangle(0.053, 0.034),
						]);
			add('Head', frame, spec.glasses.colour, flat);
		}
		if (spec.mouths.includes('knockedOut')) {
			// Knocked out: crosses for eyes.
			for (const turn of [Math.PI / 4, -Math.PI / 4]) {
				const stroke = cutOut(
					rectangle(0.026, 0.0065),
					eye,
					0,
					[],
					turn,
				);
				add('Head', stroke, TONES.pupil, {
					...flat,
					mouth: 'knockedOut',
				});
			}
		}
	}
	if (spec.glasses) {
		const bridge = near(face, 0, 0, 0.05);
		add(
			'Head',
			cutOut(
				rectangle(0.022, 0.006),
				bridge,
				// Clubmasters' in front of their lenses.
				spec.glasses.shape === 'clubmaster' ? 0.014 : 0.012,
			),
			spec.glasses.rim ?? spec.glasses.colour,
			flat,
		);
	}
	if (spec.stubble) {
		// Stubble: a darker jaw, cut from paper, round the mouth.
		const jaw = band(0.13, 0.04, (u) => -0.5 * u * u * 0.08);
		add(
			'Head',
			cutOut(jaw, near(face, 0, 0, -0.09), -0.004),
			spec.stubble,
			flat,
		);
	}
	if (spec.beard) {
		// A full beard: the lower front of a shell round the head.
		const shell = ball(head, headSize * 1.06, [0.92, 0.9, 1], 1);
		add(
			'Head',
			keep(
				shell,
				(centre) => centre.y < head.y - 0.035 && centre.z > head.z,
			),
			spec.beard,
			{ shade: 0.08 },
		);
	}
	// Out in front of a beard, if there is one.
	const lift = spec.beard ? 0.016 : 0;
	if (spec.goatee) {
		add(
			'Head',
			ball(near(head, 0, -0.17, -0.18), 0.055, [1.1, 0.9, 0.75]),
			spec.goatee,
			{ shade: 0.08 },
		);
	}
	if (spec.moustache) {
		const moustache = band(
			0.075,
			0.016,
			(u) => 0.012 * (1 - u * u) - 0.004,
		);
		add(
			'Head',
			cutOut(moustache, near(face, 0, -lift, -0.045), 0.006),
			spec.moustache,
			flat,
		);
	}
	for (const kind of spec.mouths) {
		for (const [shape, colour] of mouthShapes(kind, lift)) {
			add('Head', shape, colour, { ...flat, mouth: kind });
		}
	}
	return parts;
};

/**
 * A person, built for the game: their joints, on the humanoid skeleton,
 * named as for me (`humanoid.ts`), with their paper parts on them. Pose the
 * joints; easter eggs merge the parts (`mergeParts`).
 */
export interface Person {
	// Where they stand: the origin is between their feet.
	root: Group;
	// All of them, to crouch or bob.
	body: Group;
	chest: Group;
	head: Group;
	leftArm: Group;
	rightArm: Group;
	leftForearm: Group;
	rightForearm: Group;
	leftLeg: Group;
	rightLeg: Group;
	leftShin: Group;
	rightShin: Group;
	// Their palms, to put things in their hands.
	leftHand: Object3D;
	rightHand: Object3D;
	// Every joint that moves, for `moving`.
	joints: Object3D[];
	eyes: Mesh[];
	// Each mouth's face, shown one at a time: their first to begin with.
	mouths: Partial<Record<Mouth, Mesh[]>>;
}

/**
 * Builds a person, for the game, from how they look.
 * @param spec - How they look.
 * @param material - Their paper (`surface` with vertex colours), shared.
 * @returns The person.
 */
export const createPerson = (spec: PersonSpec, material: Material): Person => {
	const root = new Group();
	const body = new Group();
	root.add(body);
	// The joints, where the skeleton's bones are, in its hierarchy.
	const joints = new Map<Bone, Object3D>();
	// The ones that move, which are groups (palms and soles only mark
	// where they are).
	const groups = new Map<Bone, Group>();
	for (const { name, head: where, parent } of BONES) {
		const isMark = name.startsWith('palm') || name.startsWith('sole');
		const moves = new Group();
		const joint = isMark ? new Object3D() : moves;
		if (!isMark) {
			groups.set(name, moves);
		}
		const above =
			parent === undefined ? body : (joints.get(parent) ?? body);
		const from = BONES.find((bone) => bone.name === parent)?.head;
		joint.position
			.copy(where)
			.sub(parent === undefined || !from ? at(0, 0, 0) : from);
		above.add(joint);
		joints.set(name, joint);
	}
	const group = (name: Bone): Group => groups.get(name) ?? new Group();
	body.updateMatrixWorld(true);

	const eyes: Mesh[] = [];
	const mouths: Partial<Record<Mouth, Mesh[]>> = {};
	for (const part of personParts(spec)) {
		const joint = joints.get(part.bone) ?? body;
		const piece = new Mesh(part.geometry, material);
		// Into its joint's space (nothing's turned at rest).
		const origin = joint.getWorldPosition(at(0, 0, 0));
		piece.geometry.translate(-origin.x, -origin.y, -origin.z);
		// Even what's stuck flat on the face, so it merges with the rest.
		piece.castShadow = true;
		piece.receiveShadow = true;
		joint.add(piece);
		if (part.isEye) {
			eyes.push(piece);
		}
		if (!part.mouth) {
			continue;
		}

		(mouths[part.mouth] ??= []).push(piece);
		piece.visible = part.mouth === spec.mouths[0];
	}
	const moving = groups.values().toArray();
	return {
		root,
		body,
		chest: group('spine_03'),
		head: group('Head'),
		leftArm: group('upperarm_l'),
		rightArm: group('upperarm_r'),
		leftForearm: group('lowerarm_l'),
		rightForearm: group('lowerarm_r'),
		leftLeg: group('thigh_l'),
		rightLeg: group('thigh_r'),
		leftShin: group('calf_l'),
		rightShin: group('calf_r'),
		leftHand: joints.get('palm_l') ?? new Object3D(),
		rightHand: joints.get('palm_r') ?? new Object3D(),
		joints: [root, body, ...moving],
		eyes,
		mouths,
	};
};

/**
 * A person's paper: matte, coloured by their folds.
 * @returns The material.
 */
export const personMaterial = (): Material =>
	surface('#ffffff', 'matte', { vertexColors: true });
