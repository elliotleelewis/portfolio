import {
	BoxGeometry,
	BufferAttribute,
	CapsuleGeometry,
	Color,
	CylinderGeometry,
	Group,
	IcosahedronGeometry,
	MathUtils,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	SphereGeometry,
	Vector3,
} from 'three';

import { joint, part, standard } from './parts';
import { type EasterEgg, type EasterEggFrame } from './types';

// One touch of the ball every this many seconds, alternating feet.
const touchInterval = 0.46;
// How high each touch sends the ball above the foot.
const ballRise = 0.55;
// Height of the ball's centre as it meets the foot.
const touchHeight = 0.34;
const ballRadius = 0.11;
const puffCount = 8;

interface Kyle {
	body: Group;
	head: Group;
	legs: { hip: Group; knee: Group }[];
	arms: Group[];
	ember: MeshStandardMaterial;
	emberTip: Vector3;
}

// A football: white, with the black pentagons where the icosahedron's
// original twelve corners were.
const buildBall = (): Mesh => {
	const geometry = new IcosahedronGeometry(ballRadius, 2);
	const corners = new IcosahedronGeometry(1, 0).getAttribute('position');
	const cornerDirections: Vector3[] = [];
	for (let i = 0; i < corners.count; i++) {
		cornerDirections.push(new Vector3().fromBufferAttribute(corners, i));
	}
	const position = geometry.getAttribute('position');
	const colors = new Float32Array(position.count * 3);
	const white = new Color('#f4f4f2');
	const black = new Color('#161616');
	const vertex = new Vector3();
	for (let face = 0; face < position.count; face += 3) {
		let isPentagon = false;
		for (let i = face; i < face + 3; i++) {
			vertex.fromBufferAttribute(position, i).normalize();
			if (cornerDirections.some((c) => c.dot(vertex) > 0.999)) {
				isPentagon = true;
			}
		}
		const color = isPentagon ? black : white;
		for (let i = face; i < face + 3; i++) {
			colors.set([color.r, color.g, color.b], i * 3);
		}
	}
	geometry.setAttribute('color', new BufferAttribute(colors, 3));
	const ball = new Mesh(
		geometry,
		new MeshStandardMaterial({
			vertexColors: true,
			flatShading: true,
			roughness: 0.6,
		}),
	);
	ball.castShadow = true;
	return ball;
};

// Kyle: navy trucker cap with a stars-and-stripes patch, moustache and
// goatee, in the royal blue Everton home kit, fag in mouth.
const buildKyle = (parent: Object3D): Kyle => {
	const skin = standard('#d8a684');
	const hair = standard('#2a1c14', { roughness: 0.95 });
	const stubble = standard('#2a1c14', { transparent: true, opacity: 0.45 });
	const shirt = standard('#1c3f96', { roughness: 0.7 });
	const white = standard('#f3f3f1', { roughness: 0.7 });
	const cap = standard('#1f2b4d');
	const flagRed = standard('#c8262f');
	const flagBlue = standard('#23305e');
	const boots = standard('#151515', { roughness: 0.5 });
	const dark = standard('#1b1411');
	const paper = standard('#f5f2ea');
	const filter = standard('#d49a52');
	const ember = standard('#ff7a1a', {
		emissive: '#ff4d00',
		emissiveIntensity: 1,
	});

	const body = joint(parent, [0, 0, 0]);

	// Legs: white shorts, white socks with a blue turnover, black boots.
	const thighGeometry = new CapsuleGeometry(0.075, 0.34, 4, 10);
	const shinGeometry = new CapsuleGeometry(0.062, 0.36, 4, 10);
	const legs = [-1, 1].map((side) => {
		const hip = joint(body, [side * 0.1, 0.92, 0]);
		part(hip, thighGeometry, skin, [0, -0.2, 0]);
		part(
			hip,
			new CylinderGeometry(0.1, 0.095, 0.2, 12),
			white,
			[0, -0.08, 0],
		);
		const knee = joint(hip, [0, -0.42, 0]);
		part(knee, shinGeometry, white, [0, -0.2, 0]);
		part(
			knee,
			new CylinderGeometry(0.068, 0.068, 0.05, 12),
			shirt,
			[0, -0.04, 0],
		);
		part(knee, new BoxGeometry(0.11, 0.08, 0.25), boots, [0, -0.44, 0.05]);
		return { hip, knee };
	});

	// Shirt, with white trim.
	part(body, new CylinderGeometry(0.2, 0.17, 0.2, 16), white, [0, 0.95, 0]);
	const torso = part(
		body,
		new CylinderGeometry(0.21, 0.18, 0.56, 16),
		shirt,
		[0, 1.2, 0],
	);
	torso.scale.z = 0.62;
	part(body, new SphereGeometry(0.21, 16, 8), shirt, [0, 1.46, 0]).scale.set(
		1,
		0.35,
		0.62,
	);
	part(body, new BoxGeometry(0.12, 0.03, 0.03), white, [0, 1.5, 0.12]);
	// A small club badge over the heart.
	part(
		body,
		new CylinderGeometry(0.03, 0.03, 0.01, 12).rotateX(Math.PI / 2),
		white,
		[0.1, 1.36, 0.13],
	);

	// Arms out a little for balance.
	const arms = [-1, 1].map((side) => {
		const shoulder = joint(body, [side * 0.235, 1.45, 0]);
		part(
			shoulder,
			new CylinderGeometry(0.068, 0.062, 0.22, 12),
			shirt,
			[0, -0.09, 0],
		);
		part(
			shoulder,
			new CylinderGeometry(0.066, 0.066, 0.03, 12),
			white,
			[0, -0.2, 0],
		);
		part(
			shoulder,
			new CapsuleGeometry(0.048, 0.42, 4, 10),
			skin,
			[0, -0.38, 0],
		);
		part(shoulder, new SphereGeometry(0.055, 10, 8), skin, [0, -0.64, 0]);
		return shoulder;
	});

	// Neck & head.
	part(body, new CylinderGeometry(0.05, 0.058, 0.12, 12), skin, [0, 1.54, 0]);
	const head = joint(body, [0, 1.57, 0]);
	part(head, new SphereGeometry(0.12, 22, 16), skin, [0, 0.13, 0]).scale.set(
		0.92,
		1.15,
		1,
	);
	for (const side of [-1, 1]) {
		part(head, new SphereGeometry(0.028, 10, 8), skin, [
			side * 0.11,
			0.13,
			0,
		]).scale.set(0.5, 1, 0.8);
		// Smiley, squinting eyes and dark brows.
		part(head, new SphereGeometry(0.012, 8, 6), dark, [
			side * 0.042,
			0.145,
			0.106,
		]).scale.y = 0.45;
		part(head, new BoxGeometry(0.05, 0.011, 0.01), hair, [
			side * 0.043,
			0.18,
			0.11,
		]).rotation.z = side * -0.08;
		// Short dark sideburns under the cap.
		part(head, new BoxGeometry(0.02, 0.07, 0.05), hair, [
			side * 0.105,
			0.16,
			0.02,
		]);
	}
	part(head, new SphereGeometry(0.017, 8, 6), skin, [0, 0.12, 0.122]);
	// Moustache, goatee and stubble.
	part(head, new BoxGeometry(0.075, 0.016, 0.014), hair, [0, 0.092, 0.11]);
	part(
		head,
		new SphereGeometry(0.026, 12, 8),
		hair,
		[0, 0.035, 0.09],
	).scale.set(1, 0.9, 0.6);
	const jaw = part(
		head,
		new SphereGeometry(
			0.113,
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
	jaw.scale.set(0.95, 1.15, 1);
	jaw.castShadow = false;
	part(head, new BoxGeometry(0.04, 0.008, 0.01), dark, [0, 0.075, 0.113]);

	// Navy trucker cap, flag patch on the front.
	const crown = part(
		head,
		new SphereGeometry(0.128, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
		cap,
		[0, 0.17, 0],
	);
	crown.scale.set(0.98, 0.95, 1.02);
	const brim = part(
		head,
		new CylinderGeometry(
			0.1,
			0.1,
			0.012,
			20,
			1,
			false,
			-Math.PI / 2,
			Math.PI,
		),
		cap,
		[0, 0.175, 0.1],
	);
	brim.scale.set(1, 1, 0.9);
	brim.rotation.x = 0.12;
	const patch = joint(head, [0, 0.23, 0.107]);
	patch.rotation.x = -0.5;
	part(patch, new BoxGeometry(0.075, 0.045, 0.006), white, [0, 0, 0]);
	for (let i = 0; i < 3; i++) {
		part(patch, new BoxGeometry(0.075, 0.007, 0.004), flagRed, [
			0,
			-0.018 + i * 0.015,
			0.004,
		]);
	}
	part(
		patch,
		new BoxGeometry(0.03, 0.022, 0.005),
		flagBlue,
		[-0.022, 0.011, 0.005],
	);

	// Cigarette, hanging from the corner of his mouth.
	const cigarette = joint(head, [0.03, 0.075, 0.115]);
	cigarette.rotation.set(0.35, 0.35, 0);
	part(
		cigarette,
		new CylinderGeometry(0.006, 0.006, 0.02, 8).rotateX(Math.PI / 2),
		filter,
		[0, 0, 0.01],
	);
	part(
		cigarette,
		new CylinderGeometry(0.006, 0.006, 0.055, 8).rotateX(Math.PI / 2),
		paper,
		[0, 0, 0.047],
	);
	part(
		cigarette,
		new SphereGeometry(0.0065, 8, 6),
		ember,
		[0, 0, 0.076],
	).castShadow = false;

	return {
		body,
		head,
		legs,
		arms,
		ember,
		emberTip: new Vector3(0.055, 1.62, 0.2),
	};
};

export const KYLE_KEEPY_UPPIES: EasterEgg = {
	id: 'kyle-keepy-uppies',
	clearingRadius: 7,
	footprint: { halfWidth: 0.5, halfDepth: 0.5 },
	create: () => {
		const root = new Group();
		const kyle = buildKyle(root);
		const ball = buildBall();
		root.add(ball);

		// Smoke drifting up from the cigarette.
		const puffGeometry = new SphereGeometry(0.035, 8, 6);
		const puffs = Array.from({ length: puffCount }, (_, i) => {
			const material = standard('#d9dcde', {
				transparent: true,
				depthWrite: false,
			});
			const puff = new Mesh(puffGeometry, material);
			root.add(puff);
			return { mesh: puff, material, age: (i / puffCount) * 2.4 };
		});

		let look = 0;
		const update = ({ time, dt, player }: EasterEggFrame): void => {
			// Touches alternate feet: even ones left, odd ones right.
			const beats = time / touchInterval;
			const touch = Math.floor(beats);
			const s = beats - touch;
			const fromSide = touch % 2 === 0 ? 1 : -1;
			for (const [i, { hip, knee }] of kyle.legs.entries()) {
				const side = i === 0 ? -1 : 1;
				// Distance (in touches) to this foot's nearest touch.
				const phase = MathUtils.euclideanModulo(
					beats + (side === 1 ? 0 : 1),
					2,
				);
				const nearest = Math.min(phase, 2 - phase);
				const kick = MathUtils.smootherstep(1 - nearest / 0.45, 0, 1);
				hip.rotation.x = -0.95 * kick;
				knee.rotation.x = 0.85 * kick;
				hip.rotation.z = side * 0.04;
			}

			// The ball arcs up from one foot and drops onto the other.
			const fromX = fromSide * 0.1;
			ball.position.set(
				MathUtils.lerp(fromX, -fromX, s),
				touchHeight + 4 * ballRise * s * (1 - s),
				0.33,
			);
			ball.rotation.x -= dt * 6;
			ball.rotation.z += dt * fromSide * 1.5;

			// Balance: a bit of bob, arms out, eyes on the ball.
			kyle.body.position.y = -Math.abs(Math.sin(beats * Math.PI)) * 0.03;
			for (const [i, arm] of kyle.arms.entries()) {
				const side = i === 0 ? -1 : 1;
				arm.rotation.z = side * (0.5 + Math.sin(time * 3 + i) * 0.12);
				arm.rotation.x = -0.15;
			}

			// ...until I roll past, when he watches me instead.
			const distance = Math.hypot(player.x, player.z);
			look = MathUtils.lerp(
				look,
				distance < 20 ? 1 : 0,
				1 - Math.exp(-4 * dt),
			);
			const ballPitch = 0.35 - (ball.position.y - touchHeight) * 0.3;
			const yaw = MathUtils.clamp(Math.atan2(player.x, player.z), -1, 1);
			kyle.head.rotation.set(
				MathUtils.lerp(ballPitch, -0.05, look),
				yaw * look,
				0,
			);

			// The cigarette glows as he draws on it, and puffs out smoke.
			kyle.ember.emissiveIntensity = 0.7 + Math.sin(time * 1.7) * 0.4;
			for (const puff of puffs) {
				puff.age += dt;
				if (puff.age > 2.4) {
					puff.age -= 2.4;
				}
				const k = puff.age / 2.4;
				// Drifts off to the side and away from his face as it rises.
				puff.mesh.position.set(
					kyle.emberTip.x +
						k * 0.35 +
						Math.sin(k * 7 + time) * 0.04 * k,
					kyle.emberTip.y + k * 0.55,
					kyle.emberTip.z + k * 0.25,
				);
				puff.mesh.scale.setScalar(0.3 + k * 1.4);
				puff.material.opacity = 0.5 * (1 - k);
			}
		};
		return { object: root, update };
	},
};
