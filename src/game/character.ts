import {
	BoxGeometry,
	type BufferGeometry,
	CapsuleGeometry,
	CircleGeometry,
	ConeGeometry,
	CylinderGeometry,
	ExtrudeGeometry,
	Group,
	type Material,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	Path,
	Shape,
	SphereGeometry,
} from 'three';

/**
 * Height (from the feet) of the point the character spins around while
 * cartwheeling. Roughly the middle of the body when in a star pose.
 */
export const PIVOT_HEIGHT = 1.05;

export interface Character {
	// Positioned on the slope.
	root: Group;
	// Leans into turns.
	lean: Group;
	// Spins around its local x-axis to cartwheel.
	roller: Group;
	// Turns the body to face sideways before rolling.
	facing: Group;
	body: Group;
	head: Group;
	eyes: Mesh[];
	leftArm: Group;
	rightArm: Group;
	leftLeg: Group;
	rightLeg: Group;
	// Hands and feet; used to keep the cartwheel on the ground.
	extremities: Object3D[];
}

const colors = {
	skin: '#efc3a4',
	hair: '#c9a46c',
	shirt: '#868b84',
	trousers: '#3e434a',
	shoes: '#5b4a3a',
	pack: '#4e5452',
	frames: '#b9bcbd',
	eye: '#3a2e28',
	teeth: '#f6f2ea',
	mouth: '#7a3b36',
};

const material = (color: string): MeshStandardMaterial =>
	new MeshStandardMaterial({ color, roughness: 0.85 });

const mesh = (
	geometry: BufferGeometry,
	mat: Material,
	x = 0,
	y = 0,
	z = 0,
): Mesh => {
	const m = new Mesh(geometry, mat);
	m.position.set(x, y, z);
	m.castShadow = true;
	return m;
};

const glassesFrameGeometry = (): ExtrudeGeometry => {
	const w = 0.085;
	const h = 0.06;
	const t = 0.006;
	const shape = new Shape();
	shape.moveTo(-w / 2, -h / 2);
	shape.lineTo(w / 2, -h / 2);
	shape.lineTo(w / 2, h / 2);
	shape.lineTo(-w / 2, h / 2);
	shape.lineTo(-w / 2, -h / 2);
	const hole = new Path();
	hole.moveTo(-w / 2 + t, -h / 2 + t);
	hole.lineTo(w / 2 - t, -h / 2 + t);
	hole.lineTo(w / 2 - t, h / 2 - t);
	hole.lineTo(-w / 2 + t, h / 2 - t);
	hole.lineTo(-w / 2 + t, -h / 2 + t);
	shape.holes.push(hole);
	return new ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false });
};

const buildHead = (
	mats: Record<keyof typeof colors, MeshStandardMaterial>,
): { head: Group; eyes: Mesh[] } => {
	const head = new Group();

	const skull = mesh(new SphereGeometry(0.12, 24, 18), mats.skin, 0, 0.13);
	skull.scale.set(0.92, 1.18, 1);
	head.add(skull);

	// Short, spiky, sandy hair.
	const cap = mesh(
		new SphereGeometry(0.125, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
		mats.hair,
		0,
		0.15,
		-0.008,
	);
	cap.scale.set(0.95, 1.15, 1.04);
	head.add(cap);
	const spike = new ConeGeometry(0.028, 0.08, 5);
	for (let i = 0; i < 14; i++) {
		const angle = (i / 14) * Math.PI * 2;
		const ring = i % 2 === 0 ? 0.06 : 0.035;
		const s = mesh(
			spike,
			mats.hair,
			Math.cos(angle) * ring,
			0.27 + (i % 3) * 0.006,
			Math.sin(angle) * ring + 0.01,
		);
		s.rotation.set(Math.sin(angle) * 0.6 + 0.25, 0, -Math.cos(angle) * 0.6);
		head.add(s);
	}
	// Quiff at the front.
	for (let i = -2; i <= 2; i++) {
		const s = mesh(spike, mats.hair, i * 0.03, 0.245, 0.085);
		s.rotation.set(0.9, 0, -i * 0.15);
		head.add(s);
	}

	// Ears.
	const ear = new SphereGeometry(0.028, 10, 8);
	for (const side of [-1, 1]) {
		const e = mesh(ear, mats.skin, side * 0.11, 0.13, 0);
		e.scale.set(0.5, 1, 0.8);
		head.add(e);
	}

	// Eyes.
	const eyeGeometry = new SphereGeometry(0.013, 10, 8);
	const eyes = [-1, 1].map((side) => {
		const e = mesh(eyeGeometry, mats.eye, side * 0.042, 0.145, 0.108);
		head.add(e);
		return e;
	});

	// Brows.
	const brow = new BoxGeometry(0.045, 0.009, 0.01);
	for (const side of [-1, 1]) {
		const b = mesh(brow, mats.hair, side * 0.043, 0.185, 0.11);
		b.rotation.z = side * -0.12;
		head.add(b);
	}

	// Nose.
	const nose = mesh(
		new ConeGeometry(0.018, 0.05, 8),
		mats.skin,
		0,
		0.11,
		0.125,
	);
	nose.rotation.x = Math.PI / 2 - 0.3;
	head.add(nose);

	// Big grin.
	const mouth = mesh(
		new CircleGeometry(0.045, 16, Math.PI, Math.PI),
		mats.mouth,
		0,
		0.085,
		0.109,
	);
	mouth.scale.y = 0.62;
	mouth.rotation.x = -0.25;
	head.add(mouth);
	const teeth = mesh(
		new CircleGeometry(0.04, 16, Math.PI, Math.PI),
		mats.teeth,
		0,
		0.085,
		0.1105,
	);
	teeth.scale.y = 0.32;
	teeth.rotation.x = -0.25;
	head.add(teeth);

	// Clear-framed glasses.
	const frame = glassesFrameGeometry();
	for (const side of [-1, 1]) {
		const f = mesh(frame, mats.frames, side * 0.047, 0.145, 0.118);
		f.castShadow = false;
		head.add(f);
		const arm = mesh(
			new BoxGeometry(0.006, 0.006, 0.12),
			mats.frames,
			side * 0.093,
			0.155,
			0.065,
		);
		head.add(arm);
	}
	head.add(
		mesh(new BoxGeometry(0.02, 0.006, 0.006), mats.frames, 0, 0.16, 0.124),
	);

	return { head, eyes };
};

const buildArm = (
	side: 1 | -1,
	mats: Record<keyof typeof colors, MeshStandardMaterial>,
): { arm: Group; hand: Mesh } => {
	const arm = new Group();
	arm.position.set(side * 0.235, 1.46, 0);

	const sleeve = mesh(
		new CylinderGeometry(0.068, 0.062, 0.22, 12),
		mats.shirt,
		0,
		-0.09,
	);
	arm.add(sleeve);
	const limb = mesh(
		new CapsuleGeometry(0.048, 0.46, 4, 10),
		mats.skin,
		0,
		-0.4,
	);
	arm.add(limb);
	const hand = mesh(new SphereGeometry(0.06, 12, 10), mats.skin, 0, -0.69);
	hand.scale.set(0.8, 1.1, 0.6);
	arm.add(hand);
	arm.rotation.z = side * 0.08;
	return { arm, hand };
};

const buildLeg = (
	side: 1 | -1,
	mats: Record<keyof typeof colors, MeshStandardMaterial>,
): { leg: Group; foot: Mesh } => {
	const leg = new Group();
	leg.position.set(side * 0.1, 0.95, 0);
	leg.add(
		mesh(new CapsuleGeometry(0.075, 0.72, 4, 10), mats.trousers, 0, -0.43),
	);
	const foot = mesh(
		new BoxGeometry(0.12, 0.09, 0.26),
		mats.shoes,
		0,
		-0.9,
		0.04,
	);
	leg.add(foot);
	return { leg, foot };
};

/**
 * Builds a stylised, low-poly version of me: sandy spiky hair, clear
 * glasses, a grey tee and a backpack.
 * @returns The character rig.
 */
export const createCharacter = (): Character => {
	const mats = Object.fromEntries(
		Object.entries(colors).map(([key, color]) => [key, material(color)]),
	) as Record<keyof typeof colors, MeshStandardMaterial>;
	mats.frames.transparent = true;
	mats.frames.opacity = 0.6;
	mats.frames.roughness = 0.3;

	const body = new Group();
	body.position.y = -PIVOT_HEIGHT;

	// Torso.
	const torso = mesh(
		new CylinderGeometry(0.215, 0.175, 0.58, 16),
		mats.shirt,
		0,
		1.2,
	);
	torso.scale.z = 0.62;
	body.add(torso);
	const shoulders = mesh(
		new SphereGeometry(0.215, 16, 8),
		mats.shirt,
		0,
		1.46,
	);
	shoulders.scale.set(1, 0.35, 0.62);
	body.add(shoulders);
	const hips = mesh(
		new CylinderGeometry(0.175, 0.17, 0.16, 16),
		mats.trousers,
		0,
		0.93,
	);
	hips.scale.z = 0.66;
	body.add(hips);

	// Backpack & straps.
	const pack = mesh(
		new BoxGeometry(0.3, 0.38, 0.14),
		mats.pack,
		0,
		1.22,
		-0.17,
	);
	body.add(pack);
	for (const side of [-1, 1]) {
		const strap = mesh(
			new BoxGeometry(0.045, 0.42, 0.02),
			mats.pack,
			side * 0.11,
			1.28,
			0.125,
		);
		strap.rotation.x = -0.12;
		body.add(strap);
		const top = mesh(
			new BoxGeometry(0.045, 0.02, 0.26),
			mats.pack,
			side * 0.11,
			1.5,
			-0.01,
		);
		body.add(top);
	}

	// Neck & head.
	body.add(
		mesh(new CylinderGeometry(0.05, 0.058, 0.12, 12), mats.skin, 0, 1.54),
	);
	const { head, eyes } = buildHead(mats);
	head.position.y = 1.57;
	body.add(head);

	const left = buildArm(1, mats);
	const right = buildArm(-1, mats);
	body.add(left.arm, right.arm);
	const leftLeg = buildLeg(1, mats);
	const rightLeg = buildLeg(-1, mats);
	body.add(leftLeg.leg, rightLeg.leg);

	const facing = new Group();
	facing.add(body);
	const roller = new Group();
	roller.position.y = PIVOT_HEIGHT;
	roller.add(facing);
	const lean = new Group();
	lean.add(roller);
	const root = new Group();
	root.add(lean);

	return {
		root,
		lean,
		roller,
		facing,
		body,
		head,
		eyes,
		leftArm: left.arm,
		rightArm: right.arm,
		leftLeg: leftLeg.leg,
		rightLeg: rightLeg.leg,
		extremities: [left.hand, right.hand, leftLeg.foot, rightLeg.foot],
	};
};
