import {
	BufferAttribute,
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

import { m } from '../../paraglide/messages';
import { surface } from '../look/surfaces';
import { JUGGLER } from '../people/cast';
import { type Person, createPerson, personMaterial } from '../people/person';

import { joint, part } from './parts';
import type { EasterEgg, EasterEggFrame } from './types';

// One touch of the ball every this many seconds, alternating feet.
const touchInterval = 0.46;
// How high each touch sends the ball above the foot.
const ballRise = 0.55;
// Height of the ball's centre as it meets the foot.
const touchHeight = 0.34;
const ballRadius = 0.11;
const puffCount = 8;

// The juggler, his arms and legs (his right, -x, first), and his
// cigarette's glow.
interface Juggler {
	person: Person;
	legs: { hip: Group; knee: Group }[];
	arms: Group[];
	ember: MeshStandardMaterial;
	// Where the smoke comes from.
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
		surface('#ffffff', 'satin', { vertexColors: true, flatShading: true }),
	);
	ball.castShadow = true;
	return ball;
};

/**
 * Builds the juggler, with a cigarette in the corner of his mouth.
 * @param parent - What he stands in.
 * @returns Him.
 */
const buildJuggler = (parent: Object3D): Juggler => {
	const person = createPerson(JUGGLER, personMaterial());
	parent.add(person.root);
	const ember = surface('#ff7a1a', 'matte', {
		emissive: '#ff4d00',
		emissiveIntensity: 1,
	});
	// From the corner of his mouth, pointing down and out.
	const cigarette = joint(person.head, [0.05, 0.17, 0.24]);
	cigarette.rotation.set(0.35, 0.35, 0);
	part(
		cigarette,
		new CylinderGeometry(0.009, 0.009, 0.03, 6).rotateX(Math.PI / 2),
		surface('#d49a52'),
		[0, 0, 0.015],
	);
	part(
		cigarette,
		new CylinderGeometry(0.009, 0.009, 0.08, 6).rotateX(Math.PI / 2),
		surface('#f5f2ea'),
		[0, 0, 0.07],
	);
	const tip = part(
		cigarette,
		new SphereGeometry(0.01, 6, 4),
		ember,
		[0, 0, 0.112],
	);
	tip.castShadow = false;
	parent.updateMatrixWorld(true);
	return {
		person,
		legs: [
			{ hip: person.rightLeg, knee: person.rightShin },
			{ hip: person.leftLeg, knee: person.leftShin },
		],
		arms: [person.rightArm, person.leftArm],
		ember,
		emberTip: parent.worldToLocal(tip.getWorldPosition(new Vector3())),
	};
};

export const KEEPY_UPPIES: EasterEgg = {
	id: 'keepy-uppies',
	clearingRadius: 10.5,
	footprint: { halfWidth: 0.5, halfDepth: 0.5 },
	gallery: {
		caption: m.egg_keepy_uppies(),
		camera: [1.3, 1.5, 4.3],
		target: [0, 1, 0],
	},
	create: () => {
		const root = new Group();
		const juggler = buildJuggler(root);
		const ball = buildBall();
		root.add(ball);

		// Smoke drifting up from the cigarette.
		const puffGeometry = new SphereGeometry(0.035, 8, 6);
		const puffs = Array.from({ length: puffCount }, (_, i) => {
			const material = surface('#d9dcde', 'matte', {
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
			for (const [i, { hip, knee }] of juggler.legs.entries()) {
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
			juggler.person.body.position.y =
				-Math.abs(Math.sin(beats * Math.PI)) * 0.03;
			for (const [i, arm] of juggler.arms.entries()) {
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
			juggler.person.head.rotation.set(
				MathUtils.lerp(ballPitch, -0.05, look),
				yaw * look,
				0,
			);

			// The cigarette glows as he draws on it, and puffs out smoke.
			juggler.ember.emissiveIntensity = 0.7 + Math.sin(time * 1.7) * 0.4;
			for (const puff of puffs) {
				puff.age += dt;
				if (puff.age > 2.4) {
					puff.age -= 2.4;
				}
				const k = puff.age / 2.4;
				// Drifts off to the side and away from his face as it rises.
				puff.mesh.position.set(
					juggler.emberTip.x +
						k * 0.35 +
						Math.sin(k * 7 + time) * 0.04 * k,
					juggler.emberTip.y + k * 0.55,
					juggler.emberTip.z + k * 0.25,
				);
				puff.mesh.scale.setScalar(0.3 + k * 1.4);
				puff.material.opacity = 0.5 * (1 - k);
			}
		};
		const moving = [
			ball,
			...juggler.person.joints,
			...puffs.map(({ mesh }) => mesh),
		];
		return { object: root, update, moving };
	},
};
