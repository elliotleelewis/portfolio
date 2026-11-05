import {
	BackSide,
	CircleGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	InstancedMesh,
	MathUtils,
	Matrix4,
	type Mesh,
	type MeshStandardMaterial,
	type Object3D,
	Quaternion,
	SphereGeometry,
	Vector3,
} from 'three';

import { m } from '../../paraglide/messages';
import { foldedBox } from '../look/shapes';
import { surface } from '../look/surfaces';
import { STOKER } from '../people/cast';
import { type Person, createPerson, personMaterial } from '../people/person';

import { joint, part } from './parts';
import type { EasterEgg, EasterEggFrame } from './types';

// How close I get before he goes into overdrive and lights it.
const triggerDistance = 65;
// The stove sits at the origin, door facing +z; the stoker crouches beside it,
// on its left, turned to the door.
const stokerX = -0.72;
const stokerZ = 0.5;
const stokerFacing = 1.9;
const stickCount = 8;
const stickLength = 0.5;
// Seconds per stick while I'm far off, and once he's in a hurry.
const stackInterval = 1;
const hurriedInterval = 0.3;
// After the trigger: when he strikes the light, and when it catches.
const lightAt = 1.1;
const catchAt = 1.9;
const emberCount = 18;
const smokeCount = 6;

// The stoker, on the game's humanoid rig: his joints, as his animation
// knows them.
interface Stoker {
	person: Person;
	// His arms, at the shoulder and elbow: the one on his right (-x), then his
	// left (+x).
	arms: { shoulder: Group; elbow: Group }[];
	legs: { hip: Group; knee: Group }[];
	// The stick he's carrying to the stove.
	stick: Mesh;
}

/**
 * Builds the stoker (STOKER in people/cast.ts), in folded paper, carrying a
 * stick in his left hand.
 * @param parent - Where he stands.
 * @returns The stoker.
 */
const buildStoker = (parent: Object3D): Stoker => {
	const person = createPerson(STOKER, personMaterial());
	parent.add(person.root);
	const stick = part(
		person.leftHand,
		new CylinderGeometry(0.022, 0.026, stickLength, 6),
		surface('#6a4b2f'),
		[0, 0.01, 0],
	);
	stick.rotation.x = Math.PI / 2;
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
		stick,
	};
};

// One tongue of flame, drawn in its colour's batch.
interface Flame {
	batch: InstancedMesh;
	slot: number;
	at: Vector3;
}

const unturned = new Quaternion();
const placing = new Matrix4();
const sized = new Vector3();

/**
 * Places one of a batch's instances, upright.
 * @param batch - The batch.
 * @param slot - Which instance.
 * @param at - Where, in the batch's space.
 * @param size - Its scale on each axis.
 */
const placeInstance = (
	batch: InstancedMesh,
	slot: number,
	at: Vector3,
	size: Vector3,
): void => {
	batch.setMatrixAt(slot, placing.compose(at, unturned, size));
};

// A black cast-iron cabin wood stove on a slate hearth, with a stovepipe
// chimney. Its door faces +z, hinged on the right.
const buildStove = (
	parent: Object3D,
): {
	sticks: Mesh[];
	door: Group;
	flameGroup: Group;
	flames: Flame[];
	// The flames of each colour, drawn in one go.
	flameBatches: InstancedMesh[];
	glass: MeshStandardMaterial;
	glow: MeshStandardMaterial;
	spark: Mesh;
	embers: { age: number; drift: Vector3 }[];
	// Every ember, drawn in one go.
	emberBatch: InstancedMesh;
	smoke: { mesh: Mesh; material: MeshStandardMaterial; age: number }[];
	chimneyTop: number;
} => {
	const iron = surface('#1b1c1e', 'cast');
	const ironDark = surface('#101112', 'cast');
	// Only its inside faces, so it doesn't hide the fire from the front.
	const firebox = surface('#0b0908', 'matte', { side: BackSide });
	const steel = surface('#b9bec4', 'metal');
	const slate = surface('#4a4f55');
	const wood = surface('#6a4b2f');
	const woodLight = surface('#8b6843');

	// Slate hearth pad.
	part(parent, foldedBox(1.1, 0.04, 1.1), slate, [0, 0.02, 0.1]);

	// Legs, then the firebox: panels round an opening at the front.
	for (const x of [-0.24, 0.24]) {
		for (const z of [-0.19, 0.19]) {
			part(parent, foldedBox(0.06, 0.18, 0.06), iron, [x, 0.13, z]);
		}
	}
	const width = 0.62;
	const height = 0.56;
	const depth = 0.5;
	const bottom = 0.22;
	const middle = bottom + height / 2;
	const panel = (
		size: [number, number, number],
		position: [number, number, number],
	): void => {
		part(parent, foldedBox(...size), iron, position);
	};
	panel([width, 0.04, depth], [0, bottom, 0]);
	panel([width, 0.04, depth], [0, bottom + height, 0]);
	panel([width, height, 0.04], [0, middle, -depth / 2]);
	panel([0.04, height, depth], [-width / 2, middle, 0]);
	panel([0.04, height, depth], [width / 2, middle, 0]);
	// Front frame round the door opening.
	const openingWidth = 0.38;
	const openingHeight = 0.3;
	const openingY = middle - 0.02;
	const side = (width - openingWidth) / 2;
	for (const x of [-1, 1]) {
		panel(
			[side, height, 0.04],
			[x * (width / 2 - side / 2), middle, depth / 2],
		);
	}
	panel(
		[openingWidth, openingY - openingHeight / 2 - bottom, 0.04],
		[0, (bottom + openingY - openingHeight / 2) / 2, depth / 2],
	);
	panel(
		[openingWidth, bottom + height - openingY - openingHeight / 2, 0.04],
		[0, (bottom + height + openingY + openingHeight / 2) / 2, depth / 2],
	);
	// Sooty lining inside.
	part(
		parent,
		foldedBox(width - 0.06, height - 0.06, depth - 0.06),
		firebox,
		[0, middle, -0.005],
	).scale.z = 0.98;
	// Cast-iron details: a lipped top plate, ribs down the sides.
	part(parent, foldedBox(width + 0.06, 0.035, depth + 0.06), ironDark, [
		0,
		bottom + height + 0.035,
		0,
	]);
	for (const x of [-1, 1]) {
		for (let i = 0; i < 3; i++) {
			part(parent, foldedBox(0.02, height - 0.1, 0.03), ironDark, [
				x * (width / 2 + 0.01),
				middle,
				-0.15 + i * 0.15,
			]);
		}
	}

	// Logs, fed in one at a time.
	const logGeometry = new CylinderGeometry(0.03, 0.034, 0.44, 7);
	const sticks = Array.from({ length: stickCount }, (_, i) => {
		const layer = Math.floor(i / 4);
		const log = part(parent, logGeometry, i % 3 === 0 ? woodLight : wood, [
			-0.15 + (i % 4) * 0.1,
			bottom + 0.05 + layer * 0.06,
			-0.02 + (layer % 2) * 0.04,
		]);
		log.rotation.set(Math.PI / 2, 0, (i % 2) * 0.15);
		log.visible = false;
		return log;
	});

	// Flames in the firebox, hidden until it catches.
	const flameGroup = joint(parent, [0, bottom + 0.1, 0]);
	flameGroup.scale.setScalar(0.001);
	const flames: Flame[] = [];
	const flameBatches = (
		[
			['#ff4d00', 0.07, 0.3, 0.85, 0.12, 5],
			['#ff9a1a', 0.05, 0.24, 0.9, 0.08, 4],
			['#ffe066', 0.035, 0.16, 0.95, 0.03, 3],
		] as const
	).map(([color, radius, flameHeight, opacity, spread, count]) => {
		const material = surface(color, 'matte', {
			emissive: color,
			emissiveIntensity: 1.8,
			transparent: true,
			opacity,
			depthWrite: false,
		});
		const geometry = new ConeGeometry(
			radius,
			flameHeight,
			7,
			1,
			true,
		).translate(0, flameHeight / 2, 0);
		const batch = new InstancedMesh(geometry, material, count);
		// The tongues stretch and shrink, so the batch is never culled as a
		// whole: it's small, and always in view when the stove is.
		batch.frustumCulled = false;
		batch.receiveShadow = true;
		flameGroup.add(batch);
		for (let slot = 0; slot < count; slot++) {
			const at = new Vector3(
				-spread + ((slot + 0.5) / count) * spread * 2,
				0,
				(slot % 2) * 0.05 - 0.02,
			);
			placeInstance(batch, slot, at, sized.set(1, 1, 1));
			flames.push({ batch, slot, at });
		}
		return batch;
	});

	// The door: a glass window and a steel handle. Swings open to the right.
	const door = joint(parent, [
		openingWidth / 2 + 0.01,
		openingY,
		depth / 2 + 0.03,
	]);
	// A frame round the window, so you can see into the firebox.
	const doorWidth = openingWidth + 0.04;
	const doorHeight = openingHeight + 0.04;
	const bar = 0.06;
	for (const y of [-1, 1]) {
		part(door, foldedBox(doorWidth, bar, 0.025), iron, [
			-doorWidth / 2,
			y * (doorHeight / 2 - bar / 2),
			0,
		]);
	}
	for (const x of [0, 1]) {
		part(door, foldedBox(bar, doorHeight - bar * 2, 0.025), iron, [
			-bar / 2 - x * (doorWidth - bar),
			0,
			0,
		]);
	}
	// Smoked glass: see-through, so the flames show, with a warm tint once
	// it's burning.
	const glass = surface('#2a1a10', 'gloss', {
		emissive: '#ff6a10',
		emissiveIntensity: 0,
		transparent: true,
		opacity: 0.45,
		depthWrite: false,
	});
	part(
		door,
		foldedBox(openingWidth - 0.06, openingHeight - 0.06, 0.006),
		glass,
		[-(openingWidth + 0.04) / 2, 0, 0.013],
	).castShadow = false;
	part(door, new CylinderGeometry(0.012, 0.012, 0.12, 8), steel, [
		-openingWidth - 0.005,
		0,
		0.035,
	]);

	// Stovepipe chimney, a damper handle, and a rain cap on top.
	const pipeTop = 2.7;
	const pipeBottom = bottom + height + 0.05;
	part(
		parent,
		new CylinderGeometry(0.075, 0.075, pipeTop - pipeBottom, 8),
		iron,
		[0, (pipeTop + pipeBottom) / 2, -0.1],
	);
	for (const y of [pipeBottom + 0.02, pipeBottom + 0.7, pipeBottom + 1.4]) {
		part(parent, new CylinderGeometry(0.082, 0.082, 0.03, 8), ironDark, [
			0,
			y,
			-0.1,
		]);
	}
	part(parent, foldedBox(0.2, 0.015, 0.015), steel, [
		0.08,
		pipeBottom + 0.35,
		-0.1,
	]);
	part(parent, new ConeGeometry(0.16, 0.1, 8), ironDark, [
		0,
		pipeTop + 0.1,
		-0.1,
	]);
	for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
		part(parent, foldedBox(0.012, 0.08, 0.012), ironDark, [
			Math.cos(angle) * 0.07,
			pipeTop + 0.03,
			-0.1 + Math.sin(angle) * 0.07,
		]);
	}

	// Warm light spilling out onto the hearth.
	const glowMaterial = surface('#ff7a1a', 'matte', {
		emissive: '#ff6a00',
		emissiveIntensity: 1,
		transparent: true,
		opacity: 0,
		depthWrite: false,
	});
	const glow = part(
		parent,
		new CircleGeometry(0.35, 10),
		glowMaterial,
		[0, 0.045, 0.45],
	);
	glow.rotation.x = -Math.PI / 2;
	glow.castShadow = false;
	glow.receiveShadow = false;

	// The spark as he lights it, just inside the door.
	const spark = part(
		parent,
		new SphereGeometry(0.03, 8, 6),
		surface('#fff2a8', 'matte', {
			emissive: '#ffd24d',
			emissiveIntensity: 3,
		}),
		[0, bottom + 0.1, 0.12],
	);
	spark.castShadow = false;
	spark.visible = false;

	// Sparks and smoke out of the top of the chimney.
	const emberGeometry = foldedBox(0.02, 0.02, 0.02);
	const emberMaterial = surface('#ffb347', 'matte', {
		emissive: '#ff7a00',
		emissiveIntensity: 2,
	});
	const emberBatch = new InstancedMesh(
		emberGeometry,
		emberMaterial,
		emberCount,
	);
	// The embers fly off on their own, so the batch is never culled as a
	// whole.
	emberBatch.frustumCulled = false;
	emberBatch.receiveShadow = true;
	emberBatch.visible = false;
	parent.add(emberBatch);
	const embers = Array.from({ length: emberCount }, (_, i) => ({
		age: (i / emberCount) * 1.6,
		drift: new Vector3(
			MathUtils.randFloatSpread(0.5),
			MathUtils.randFloat(0.6, 1.1),
			MathUtils.randFloatSpread(0.5),
		),
	}));
	const puff = new SphereGeometry(0.09, 8, 6);
	const smoke = Array.from({ length: smokeCount }, (_, i) => {
		const material = surface('#9ea3a8', 'matte', {
			transparent: true,
			opacity: 0,
			depthWrite: false,
		});
		const mesh = part(parent, puff, material, [0, 0, 0]);
		mesh.castShadow = false;
		return { mesh, material, age: (i / smokeCount) * 3 };
	});

	// Spare logs piled up beside him.
	const spareGeometry = new CylinderGeometry(0.03, 0.034, 0.5, 7);
	for (let i = 0; i < 6; i++) {
		const spare = part(
			parent,
			spareGeometry,
			i % 2 === 0 ? wood : woodLight,
			[
				stokerX - 0.05 + (i % 3) * 0.075,
				0.035 + Math.floor(i / 3) * 0.06,
				1.15,
			],
		);
		spare.rotation.set(0, 0, Math.PI / 2);
	}

	return {
		sticks,
		door,
		flameGroup,
		flames,
		flameBatches,
		glass,
		glow: glowMaterial,
		spark,
		embers,
		emberBatch,
		smoke,
		chimneyTop: pipeTop + 0.15,
	};
};

// Crouched down at the fire: knees bent, leaning in.
const crouch = (stoker: Stoker, amount: number): void => {
	for (const { hip, knee } of stoker.legs) {
		hip.rotation.x = -1.3 * amount;
		knee.rotation.x = 1.9 * amount;
	}
	stoker.person.body.position.y = -0.27 * amount;
	stoker.person.chest.rotation.x = 0.55 * amount;
};

export const WOOD_STOVE: EasterEgg = {
	id: 'wood-stove',
	clearingRadius: 12,
	footprint: { halfWidth: 1, halfDepth: 0.9 },
	gallery: {
		caption: m.egg_wood_stove(),
		camera: [1.4, 1.9, 4.4],
		target: [-0.25, 1, 0.2],
	},
	create: () => {
		const root = new Group();
		const fire = buildStove(root);
		const stoker = buildStoker(root);
		const { person } = stoker;
		person.root.position.set(stokerX, 0, stokerZ);
		person.root.rotation.y = stokerFacing;
		const { smile = [], shout = [] } = person.mouths;
		const [leftArm, rightArm] = stoker.arms;

		const emberAt = new Vector3();
		let triggeredAt: number | undefined;
		// Sticks placed so far, and how far through placing the next one.
		let placed = 2;
		let progress = 0;
		const update = ({ time, dt, player }: EasterEggFrame): void => {
			const distance = Math.hypot(player.x, player.z);
			if (
				triggeredAt === undefined &&
				player.z > 0 &&
				distance < triggerDistance
			) {
				triggeredAt = time;
			}
			const t = triggeredAt === undefined ? -1 : time - triggeredAt;

			// Stacking: grab a log from the pile, feed it into the stove.
			if (t < lightAt) {
				const interval = t < 0 ? stackInterval : hurriedInterval;
				progress += dt / interval;
				if (progress >= 1) {
					progress -= 1;
					placed = Math.min(stickCount, placed + 1);
				}
				// Once he's in a hurry, make sure it's done in time.
				if (t >= 0) {
					placed = Math.max(
						placed,
						Math.min(
							stickCount,
							2 + Math.ceil((t / lightAt) * stickCount),
						),
					);
				}
				const isDone = placed >= stickCount;
				const reach = isDone ? 0 : Math.sin(progress * Math.PI);
				crouch(stoker, 1);
				// Right arm swings from the pile (his right) to the door.
				rightArm.shoulder.rotation.set(
					-1 - reach * 0.3,
					0,
					MathUtils.lerp(0.9, 0.1, progress),
				);
				rightArm.elbow.rotation.set(-0.6, 0, 0);
				leftArm.shoulder.rotation.set(-0.9 + reach * 0.2, 0, -0.2);
				leftArm.elbow.rotation.set(-0.7, 0, 0);
				stoker.stick.visible = !isDone && progress < 0.85;
				person.head.rotation.set(
					0.35,
					MathUtils.lerp(-0.5, 0, progress),
					0,
				);
			} else if (t < catchAt) {
				// Crouched right down, striking a light at the base.
				crouch(stoker, 1.1);
				stoker.stick.visible = false;
				const strike = Math.sin((t - lightAt) * 30);
				rightArm.shoulder.rotation.set(-1.25, 0, 0.15);
				rightArm.elbow.rotation.set(-0.3 + strike * 0.2, 0, 0);
				leftArm.shoulder.rotation.set(-1.2, 0, -0.15);
				leftArm.elbow.rotation.set(-0.35, 0, 0);
				person.head.rotation.set(0.6, 0, 0);
				fire.spark.visible = strike > 0.3;
			} else {
				// It's lit! Leap up, arms in the air, and shout about it, turning
				// round to face me.
				fire.spark.visible = false;
				const up = MathUtils.smootherstep(t, catchAt, catchAt + 0.35);
				crouch(stoker, 1 - up);
				const c = t - catchAt;
				person.root.position.y = up * Math.abs(Math.sin(c * 6)) * 0.28;
				person.root.rotation.y = MathUtils.lerp(stokerFacing, 0.5, up);
				for (const [i, arm] of stoker.arms.entries()) {
					const side = i === 0 ? -1 : 1;
					const pump = Math.sin(c * 12 + i * Math.PI) * 0.25;
					arm.shoulder.rotation.set(0, 0, side * (2.6 + pump) * up);
					arm.elbow.rotation.set(0, 0, side * 0.5 * up);
				}
				person.head.rotation.set(-0.35 * up, Math.sin(c * 3) * 0.3, 0);
				for (const piece of smile) {
					piece.visible = false;
				}
				for (const piece of shout) {
					piece.visible = true;
				}
			}
			for (const [i, stick] of fire.sticks.entries()) {
				stick.visible = i < placed;
			}

			// The door stands open while he loads it, then swings shut once
			// it's going.
			const shut = MathUtils.smootherstep(t, catchAt + 0.5, catchAt + 1);
			fire.door.rotation.y = MathUtils.lerp(1.9, 0, shut);

			// The fire itself, glowing through the door's window.
			const burn =
				t < catchAt
					? 0
					: MathUtils.smootherstep(t, catchAt, catchAt + 0.8);
			const flicker =
				0.85 + Math.sin(time * 17) * 0.1 + Math.sin(time * 41) * 0.05;
			fire.flameGroup.scale.setScalar(Math.max(0.001, burn));
			for (const [i, { batch, slot, at }] of fire.flames.entries()) {
				const stretch =
					1 +
					Math.sin(time * (11 + (i % 5) * 3) + i) * 0.22 +
					Math.sin(time * (27 + (i % 3) * 7) + i * 2) * 0.12;
				placeInstance(batch, slot, at, sized.set(1, stretch, 1));
			}
			for (const batch of fire.flameBatches) {
				batch.instanceMatrix.needsUpdate = true;
			}
			fire.glass.emissiveIntensity = burn * 0.45 * flicker;
			fire.glow.opacity = burn * 0.14 * flicker;
			fire.emberBatch.visible = burn > 0.3;
			for (const [i, ember] of fire.embers.entries()) {
				ember.age = (ember.age + dt) % 1.6;
				const k = ember.age / 1.6;
				emberAt.set(
					ember.drift.x * k + Math.sin(time * 4 + k * 9) * 0.05,
					fire.chimneyTop + ember.drift.y * k,
					-0.1 + ember.drift.z * k,
				);
				placeInstance(
					fire.emberBatch,
					i,
					emberAt,
					sized.setScalar(1 - k),
				);
			}
			fire.emberBatch.instanceMatrix.needsUpdate = true;
			for (const puff of fire.smoke) {
				puff.age = (puff.age + dt) % 3;
				const k = puff.age / 3;
				puff.mesh.position.set(
					Math.sin(k * 5) * 0.15 + k * 0.4,
					fire.chimneyTop + k * 1.8,
					-0.1 + k * 0.3,
				);
				puff.mesh.scale.setScalar(0.5 + k * 2.4);
				puff.material.opacity = burn * 0.4 * (1 - k);
			}
		};
		const moving = [
			...person.joints,
			stoker.stick,
			...smile,
			...shout,
			fire.spark,
			fire.door,
			fire.flameGroup,
			fire.emberBatch,
			...fire.sticks,
			...fire.smoke.map(({ mesh }) => mesh),
		];
		return { object: root, update, moving };
	},
};
