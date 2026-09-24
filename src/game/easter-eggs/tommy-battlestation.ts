import {
	BoxGeometry,
	type CanvasTexture,
	CapsuleGeometry,
	CircleGeometry,
	Color,
	CylinderGeometry,
	Group,
	MathUtils,
	type MeshStandardMaterial,
	type Object3D,
	PlaneGeometry,
	Quaternion,
	RepeatWrapping,
	SphereGeometry,
	TorusGeometry,
	Vector3,
} from 'three';

import { canvasTexture, joint, part, standard } from './parts';
import { type EasterEgg, type EasterEggFrame } from './types';

// Tommy sits at z = sitZ facing -z, at a low table whose top is at
// tableHeight. His screens face him, and so face me (+z) as I roll up.
const tableHeight = 0.4;
const tableZ = -0.3;
const sitZ = 0.42;

// ---------------------------------------------------------------------------
// Screens

const codeColors = [
	'#c792ea',
	'#82aaff',
	'#c3e88d',
	'#f78c6c',
	'#89ddff',
	'#ffcb6b',
	'#eeffff',
];

// A tall page of syntax-highlighted "code", scrolled through the screen.
const codeTexture = (): CanvasTexture => {
	const texture = canvasTexture(256, 512, (context) => {
		context.fillStyle = '#1e1f2e';
		context.fillRect(0, 0, 256, 512);
		let indent = 0;
		for (let line = 0; line < 42; line++) {
			const y = 6 + line * 12;
			context.fillStyle = '#4b4f6b';
			context.fillRect(4, y, 10, 6);
			if (line % 7 === 6) {
				indent = Math.max(0, indent - 1);
				continue;
			}
			let x = 22 + indent * 14;
			const tokens = 2 + ((line * 7) % 5);
			for (let t = 0; t < tokens && x < 240; t++) {
				const width = 10 + ((line * 13 + t * 29) % 38);
				context.fillStyle =
					codeColors[(line + t * 3) % codeColors.length] ?? '#eeffff';
				context.fillRect(x, y, width, 6);
				x += width + 6;
			}
			if (line % 5 === 2) {
				indent = Math.min(4, indent + 1);
			}
		}
	});
	texture.wrapT = RepeatWrapping;
	texture.repeat.set(1, 0.45);
	return texture;
};

// Charts that scroll sideways like a live dashboard.
const dashboardTexture = (): CanvasTexture => {
	const texture = canvasTexture(512, 256, (context) => {
		context.fillStyle = '#10151f';
		context.fillRect(0, 0, 512, 256);
		const series = [
			{ color: '#4ade80', base: 70, amplitude: 30 },
			{ color: '#60a5fa', base: 120, amplitude: 22 },
			{ color: '#f472b6', base: 170, amplitude: 26 },
		];
		for (const { color, base, amplitude } of series) {
			context.strokeStyle = color;
			context.lineWidth = 4;
			context.beginPath();
			for (let x = 0; x <= 512; x += 8) {
				// Whole periods across the width, so it tiles as it scrolls.
				const y =
					base +
					Math.sin((x / 512) * Math.PI * 6) * amplitude * 0.6 +
					Math.sin((x / 512) * Math.PI * 14 + base) * amplitude * 0.4;
				if (x === 0) {
					context.moveTo(x, y);
				} else {
					context.lineTo(x, y);
				}
			}
			context.stroke();
		}
		context.fillStyle = '#facc15';
		for (let x = 0; x < 512; x += 16) {
			const height = 10 + Math.abs(Math.sin(x * 0.05)) * 30;
			context.fillRect(x + 2, 250 - height, 10, height);
		}
	});
	texture.wrapS = RepeatWrapping;
	texture.repeat.set(0.5, 1);
	return texture;
};

// A terminal of green logs, scrolling.
const terminalTexture = (): CanvasTexture => {
	const texture = canvasTexture(256, 512, (context) => {
		context.fillStyle = '#060906';
		context.fillRect(0, 0, 256, 512);
		for (let line = 0; line < 42; line++) {
			const y = 6 + line * 12;
			context.fillStyle = line % 9 === 4 ? '#fbbf24' : '#34d399';
			context.fillRect(6, y, 8, 6);
			context.fillStyle = '#86efac';
			context.fillRect(20, y, 30 + ((line * 37) % 190), 6);
		}
	});
	texture.wrapT = RepeatWrapping;
	texture.repeat.set(1, 0.45);
	return texture;
};

// A stand-up call: a grid of little faces.
const callTexture = (): CanvasTexture =>
	canvasTexture(256, 144, (context) => {
		context.fillStyle = '#18181b';
		context.fillRect(0, 0, 256, 144);
		const tiles = [
			'#475569',
			'#57534e',
			'#3f3f46',
			'#44403c',
			'#334155',
			'#52525b',
		];
		for (const [i, color] of tiles.entries()) {
			const x = 6 + (i % 3) * 83;
			const y = 6 + Math.floor(i / 3) * 68;
			context.fillStyle = color;
			context.fillRect(x, y, 78, 62);
			context.fillStyle = '#e7c3a5';
			context.beginPath();
			context.arc(x + 39, y + 26, 13, 0, Math.PI * 2);
			context.fill();
			context.fillStyle = '#94a3b8';
			context.fillRect(x + 20, y + 42, 38, 20);
		}
	});

// The laptop: a chat app with a purple sidebar.
const chatTexture = (): CanvasTexture =>
	canvasTexture(256, 160, (context) => {
		context.fillStyle = '#ffffff';
		context.fillRect(0, 0, 256, 160);
		context.fillStyle = '#3f0e40';
		context.fillRect(0, 0, 64, 160);
		context.fillStyle = '#b5a1b6';
		for (let i = 0; i < 8; i++) {
			context.fillRect(8, 12 + i * 16, 30 + ((i * 17) % 20), 6);
		}
		for (let i = 0; i < 6; i++) {
			const y = 10 + i * 24;
			context.fillStyle =
				['#e01e5a', '#2eb67d', '#36c5f0', '#ecb22e'][i % 4] ??
				'#e01e5a';
			context.fillRect(72, y, 14, 14);
			context.fillStyle = '#1d1c1d';
			context.fillRect(92, y, 40, 5);
			context.fillStyle = '#616061';
			context.fillRect(92, y + 8, 60 + ((i * 29) % 90), 5);
		}
	});

const screenMaterial = (texture: CanvasTexture): MeshStandardMaterial =>
	standard('#000000', {
		emissive: '#ffffff',
		emissiveMap: texture,
		emissiveIntensity: 1.1,
		roughness: 0.3,
	});

// ---------------------------------------------------------------------------
// The workstation

interface Workstation {
	textures: { scrollY: CanvasTexture[]; scrollX: CanvasTexture[] };
	rgb: MeshStandardMaterial[];
	generator: Group;
	dish: Group;
}

const buildWorkstation = (parent: Object3D): Workstation => {
	const wood = standard('#9a7148', { roughness: 0.9 });
	const black = standard('#161719', { roughness: 0.5 });
	const metal = standard('#8f969d', { metalness: 0.8, roughness: 0.35 });
	const aluminium = standard('#c9ccd1', { metalness: 0.7, roughness: 0.3 });
	const white = standard('#eef0f2');
	const yellow = standard('#f2b705');
	const red = standard('#c8262f');
	const mug = standard('#e9e4da');
	const can = standard('#1f7fd1', { metalness: 0.6, roughness: 0.3 });
	const rgb = Array.from({ length: 4 }, () =>
		standard('#111111', { emissive: '#ff00ff', emissiveIntensity: 1.4 }),
	);

	const table = joint(parent, [0, 0, tableZ]);
	// A low wooden table: top and four legs.
	part(table, new BoxGeometry(1.6, 0.05, 0.66), wood, [0, tableHeight, 0]);
	for (const x of [-0.74, 0.74]) {
		for (const z of [-0.28, 0.28]) {
			part(table, new BoxGeometry(0.05, tableHeight, 0.05), wood, [
				x,
				tableHeight / 2,
				z,
			]);
		}
	}
	const top = tableHeight + 0.025;

	// Quad-monitor arm: three across, one on top.
	part(table, new CylinderGeometry(0.1, 0.12, 0.02, 16), black, [
		0,
		top + 0.01,
		-0.22,
	]);
	part(table, new CylinderGeometry(0.02, 0.02, 0.9, 10), metal, [
		0,
		top + 0.45,
		-0.22,
	]);
	const code = codeTexture();
	const dashboard = dashboardTexture();
	const terminal = terminalTexture();
	const monitor = (
		texture: CanvasTexture,
		position: [number, number, number],
		yaw: number,
		width: number,
		height: number,
	): void => {
		const mount = joint(table, position);
		mount.rotation.y = yaw;
		part(
			mount,
			new BoxGeometry(width + 0.03, height + 0.03, 0.03),
			black,
			[0, 0, 0],
		);
		part(
			mount,
			new PlaneGeometry(width, height),
			screenMaterial(texture),
			[0, 0, 0.016],
		).castShadow = false;
		part(mount, new BoxGeometry(0.02, 0.02, 0.14), metal, [0, 0, -0.08]);
	};
	monitor(code, [0, top + 0.46, -0.14], 0, 0.62, 0.36);
	monitor(dashboard, [-0.63, top + 0.46, -0.05], 0.45, 0.62, 0.36);
	monitor(terminal, [0.63, top + 0.46, -0.05], -0.45, 0.62, 0.36);
	monitor(callTexture(), [0, top + 0.86, -0.16], 0, 0.62, 0.36);

	// Laptop, open, off to the left.
	const laptop = joint(table, [-0.45, top, 0.06]);
	laptop.rotation.y = 0.3;
	part(laptop, new BoxGeometry(0.32, 0.015, 0.22), aluminium, [0, 0.008, 0]);
	const lid = joint(laptop, [0, 0.015, -0.11]);
	lid.rotation.x = -0.25;
	part(lid, new BoxGeometry(0.32, 0.21, 0.01), aluminium, [0, 0.105, 0]);
	part(
		lid,
		new PlaneGeometry(0.29, 0.18),
		screenMaterial(chatTexture()),
		[0, 0.105, 0.006],
	).castShadow = false;

	// Mechanical keyboard with RGB underglow, mouse on a glowing pad.
	part(table, new BoxGeometry(0.44, 0.03, 0.15), black, [0, top + 0.02, 0.2]);
	part(table, new BoxGeometry(0.45, 0.006, 0.16), rgb[0] ?? black, [
		0,
		top + 0.004,
		0.2,
	]);
	const keycap = new BoxGeometry(0.022, 0.012, 0.022);
	const keycapMaterial = standard('#2d2f33');
	for (let row = 0; row < 4; row++) {
		for (let key = 0; key < 15; key++) {
			part(table, keycap, keycapMaterial, [
				-0.196 + key * 0.028,
				top + 0.04,
				0.15 + row * 0.03,
			]).castShadow = false;
		}
	}
	part(table, new BoxGeometry(0.28, 0.004, 0.22), rgb[1] ?? black, [
		0.38,
		top + 0.002,
		0.18,
	]);
	part(table, new CapsuleGeometry(0.028, 0.04, 4, 8), black, [
		0.38,
		top + 0.02,
		0.18,
	]).rotation.x = Math.PI / 2;

	// Coffee and a small pile of energy drinks.
	part(table, new CylinderGeometry(0.04, 0.035, 0.1, 14), mug, [
		0.62,
		top + 0.05,
		0.08,
	]);
	part(table, new TorusGeometry(0.025, 0.008, 6, 12), mug, [
		0.665,
		top + 0.05,
		0.08,
	]);
	const drinkGeometry = new CylinderGeometry(0.028, 0.028, 0.11, 12);
	part(table, drinkGeometry, can, [0.7, top + 0.055, -0.08]);
	// The empties, crushed and knocked over.
	for (const [x, z] of [
		[0.62, -0.12],
		[-0.7, 0.2],
	] as const) {
		const empty = part(table, drinkGeometry, can, [x, top + 0.028, z]);
		empty.rotation.z = Math.PI / 2;
		empty.scale.y = 0.7;
	}

	// A gaming PC beside the table, fans glowing.
	const tower = joint(parent, [1.08, 0, -0.3]);
	part(tower, new BoxGeometry(0.22, 0.48, 0.46), black, [0, 0.24, 0]);
	part(
		tower,
		new PlaneGeometry(0.44, 0.44),
		standard('#1c2733', {
			transparent: true,
			opacity: 0.55,
			roughness: 0.1,
		}),
		[-0.112, 0.25, 0],
	).rotation.y = -Math.PI / 2;
	for (const [i, y] of [0.12, 0.25, 0.38].entries()) {
		const fan = part(
			tower,
			new TorusGeometry(0.055, 0.012, 8, 20),
			rgb[2 + (i % 2)] ?? black,
			[0, y, 0.232],
		);
		fan.castShadow = false;
	}

	// A generator to power it all, humming away.
	const generator = joint(parent, [-1.25, 0, -0.1]);
	part(generator, new BoxGeometry(0.5, 0.36, 0.34), yellow, [0, 0.22, 0]);
	part(generator, new BoxGeometry(0.52, 0.04, 0.36), black, [0, 0.04, 0]);
	part(
		generator,
		new CylinderGeometry(0.1, 0.1, 0.22, 14).rotateZ(Math.PI / 2),
		red,
		[0, 0.44, 0],
	);
	part(generator, new BoxGeometry(0.46, 0.03, 0.03), black, [0, 0.43, 0.17]);

	// And a Starlink dish, for the Wi-Fi.
	const dishBase = joint(parent, [-1.1, 0, -0.95]);
	part(
		dishBase,
		new CylinderGeometry(0.02, 0.02, 1.2, 8),
		metal,
		[0, 0.6, 0],
	);
	for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
		const leg = part(
			dishBase,
			new CylinderGeometry(0.015, 0.015, 0.5, 6),
			metal,
			[Math.sin(angle) * 0.14, 0.2, Math.cos(angle) * 0.14],
		);
		leg.rotation.set(Math.cos(angle) * 0.35, 0, -Math.sin(angle) * 0.35);
	}
	const dish = joint(dishBase, [0, 1.22, 0]);
	part(dish, new BoxGeometry(0.5, 0.03, 0.3), white, [0, 0, 0]).castShadow =
		true;

	// Cables snaking between everything.
	const cable = standard('#101010');
	for (const [from, to] of [
		[new Vector3(-1.05, 0.02, -0.1), new Vector3(-0.3, 0.02, -0.55)],
		[new Vector3(-0.3, 0.02, -0.55), new Vector3(0.95, 0.02, -0.4)],
		[new Vector3(-1.1, 0.02, -0.9), new Vector3(-1.05, 0.02, -0.25)],
	] as const) {
		const length = from.distanceTo(to);
		const wire = part(
			parent,
			new CylinderGeometry(0.008, 0.008, length, 5),
			cable,
			[(from.x + to.x) / 2, 0.01, (from.z + to.z) / 2],
		);
		wire.quaternion.setFromUnitVectors(
			new Vector3(0, 1, 0),
			to.clone().sub(from).normalize(),
		);
	}

	return {
		textures: { scrollY: [code, terminal], scrollX: [dashboard] },
		rgb,
		generator,
		dish,
	};
};

// ---------------------------------------------------------------------------
// Tommy

interface Tommy {
	upper: Group;
	head: Group;
	wrists: Group[];
	elbows: Group[];
	shoulders: Group[];
}

// A capsule running between two points.
const limb = (
	parent: Object3D,
	from: Vector3,
	to: Vector3,
	radius: number,
	material: MeshStandardMaterial,
): void => {
	const length = from.distanceTo(to);
	const mesh = part(
		parent,
		new CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 4, 10),
		material,
		[(from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2],
	);
	mesh.quaternion.copy(
		new Quaternion().setFromUnitVectors(
			new Vector3(0, 1, 0),
			to.clone().sub(from).normalize(),
		),
	);
};

// Tommy: short dark hair, a neat full beard, clubmaster sunglasses, and an
// olive zip-up fleece hoodie. Built facing +z, sitting cross-legged.
const buildTommy = (parent: Object3D): Tommy => {
	const skin = standard('#efc6aa');
	const hair = standard('#3a2619', { roughness: 0.85 });
	const beard = standard('#4f3423', { roughness: 0.95 });
	const fleece = standard('#4a4c38', { roughness: 0.95 });
	const fleeceDark = standard('#3b3d2c', { roughness: 0.95 });
	const jeans = standard('#3a4250');
	const boots = standard('#5a4030');
	const lens = standard('#0f1110', { metalness: 0.6, roughness: 0.1 });
	const browline = standard('#1c1512', { roughness: 0.4 });
	const gold = standard('#c9a656', { metalness: 0.85, roughness: 0.3 });
	const teeth = standard('#f7f3e8');
	const mouth = standard('#6e3432');
	const white = standard('#f4f4f4');
	const cushion = standard('#2f4858');

	part(
		parent,
		new CylinderGeometry(0.34, 0.36, 0.1, 18),
		cushion,
		[0, 0.05, 0],
	);
	const hips = joint(parent, [0, 0.13, 0]);

	// Cross-legged: thighs out and forward, shins crossed in front.
	for (const side of [-1, 1]) {
		const hip = new Vector3(side * 0.1, 0.02, 0);
		const knee = new Vector3(side * 0.36, 0.06, 0.26);
		const ankle = new Vector3(
			-side * 0.1,
			0.02 + (side === 1 ? 0.05 : 0),
			0.34,
		);
		limb(hips, hip, knee, 0.08, jeans);
		limb(hips, knee, ankle, 0.068, jeans);
		const boot = part(hips, new BoxGeometry(0.1, 0.1, 0.22), boots, [
			ankle.x - side * 0.08,
			ankle.y,
			ankle.z - 0.02,
		]);
		boot.rotation.y = side * -1.2;
	}
	part(hips, new BoxGeometry(0.34, 0.14, 0.24), jeans, [0, 0.03, 0]);

	// Upper body leans in to the keyboard.
	const upper = joint(hips, [0, 0.06, 0]);
	upper.rotation.x = 0.18;
	const torso = part(
		upper,
		new CylinderGeometry(0.22, 0.2, 0.52, 16),
		fleece,
		[0, 0.26, 0],
	);
	torso.scale.z = 0.66;
	part(upper, new SphereGeometry(0.22, 16, 8), fleece, [0, 0.5, 0]).scale.set(
		1,
		0.35,
		0.66,
	);
	part(
		upper,
		new BoxGeometry(0.012, 0.44, 0.012),
		fleeceDark,
		[0, 0.27, 0.146],
	);
	part(
		upper,
		new BoxGeometry(0.1, 0.005, 0.01),
		fleeceDark,
		[0.1, 0.26, 0.142],
	);
	part(upper, new BoxGeometry(0.035, 0.018, 0.006), white, [0.1, 0.4, 0.143]);
	// The hood, bunched up behind his neck.
	const hood = part(
		upper,
		new TorusGeometry(0.09, 0.05, 8, 16),
		fleece,
		[0, 0.56, -0.03],
	);
	hood.rotation.x = Math.PI / 2 + 0.25;
	hood.scale.set(1.2, 1, 1);

	// Arms reaching forward to type.
	const shoulders: Group[] = [];
	const elbows: Group[] = [];
	const wrists = [-1, 1].map((side) => {
		const shoulder = joint(upper, [side * 0.24, 0.48, 0]);
		shoulder.rotation.set(-0.7, 0, side * 0.12);
		part(
			shoulder,
			new CapsuleGeometry(0.068, 0.2, 4, 10),
			fleece,
			[0, -0.14, 0],
		);
		const elbow = joint(shoulder, [0, -0.29, 0]);
		elbow.rotation.set(-1.1, 0, side * -0.15);
		part(
			elbow,
			new CapsuleGeometry(0.058, 0.18, 4, 10),
			fleece,
			[0, -0.12, 0],
		);
		const wrist = joint(elbow, [0, -0.27, 0]);
		wrist.rotation.x = 0.6;
		part(
			wrist,
			new SphereGeometry(0.05, 10, 8),
			skin,
			[0, -0.04, 0],
		).scale.set(1, 1.1, 0.6);
		shoulders.push(shoulder);
		elbows.push(elbow);
		return wrist;
	});

	// Neck & head.
	part(
		upper,
		new CylinderGeometry(0.052, 0.058, 0.1, 12),
		skin,
		[0, 0.58, 0],
	);
	const head = joint(upper, [0, 0.61, 0]);
	part(head, new SphereGeometry(0.12, 22, 16), skin, [0, 0.13, 0]).scale.set(
		0.93,
		1.12,
		1,
	);
	for (const side of [-1, 1]) {
		part(head, new SphereGeometry(0.028, 10, 8), skin, [
			side * 0.112,
			0.13,
			0,
		]).scale.set(0.5, 1, 0.8);
	}
	part(head, new SphereGeometry(0.019, 8, 6), skin, [0, 0.12, 0.124]);

	// Neat, full beard and moustache.
	const beardShell = part(
		head,
		new SphereGeometry(
			0.118,
			20,
			12,
			-Math.PI * 0.08,
			Math.PI * 1.16,
			Math.PI * 0.5,
			Math.PI * 0.42,
		),
		beard,
		[0, 0.13, 0.006],
	);
	beardShell.scale.set(0.97, 1.16, 1.02);
	part(head, new BoxGeometry(0.08, 0.018, 0.016), beard, [0, 0.098, 0.116]);
	// A wide smile.
	const grin = part(
		head,
		new CircleGeometry(0.036, 16, Math.PI, Math.PI),
		mouth,
		[0, 0.085, 0.121],
	);
	grin.scale.y = 0.6;
	grin.rotation.x = -0.2;
	const smile = part(
		head,
		new CircleGeometry(0.034, 16, Math.PI, Math.PI),
		teeth,
		[0, 0.085, 0.1225],
	);
	smile.scale.y = 0.35;
	smile.rotation.x = -0.2;

	// Clubmaster sunglasses: dark lenses, a heavy brow bar, gold rims.
	for (const side of [-1, 1]) {
		const lensMesh = part(head, new CircleGeometry(0.032, 16), lens, [
			side * 0.044,
			0.142,
			0.117,
		]);
		lensMesh.scale.set(1.1, 0.85, 1);
		lensMesh.rotation.y = side * 0.15;
		part(head, new BoxGeometry(0.072, 0.014, 0.012), browline, [
			side * 0.044,
			0.166,
			0.116,
		]);
		const rim = part(
			head,
			new TorusGeometry(0.032, 0.0025, 4, 18, Math.PI),
			gold,
			[side * 0.044, 0.142, 0.118],
		);
		rim.rotation.z = Math.PI;
		rim.scale.set(1.1, 0.85, 1);
		part(head, new BoxGeometry(0.005, 0.008, 0.11), browline, [
			side * 0.088,
			0.162,
			0.065,
		]);
	}
	part(head, new BoxGeometry(0.02, 0.005, 0.006), gold, [0, 0.155, 0.12]);

	// Short dark hair, pushed up a little at the front.
	const crown = part(
		head,
		new SphereGeometry(0.126, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.46),
		hair,
		[0, 0.155, -0.005],
	);
	crown.scale.set(0.98, 1.08, 1.04);
	crown.rotation.x = -0.12;
	// Short at the back and sides, down to the nape.
	const back = part(
		head,
		new SphereGeometry(
			0.124,
			20,
			12,
			Math.PI * 0.95,
			Math.PI * 1.1,
			0,
			Math.PI * 0.64,
		),
		hair,
		[0, 0.13, -0.004],
	);
	back.scale.set(0.97, 1.14, 1.02);

	return { upper, head, wrists, elbows, shoulders };
};

export const TOMMY_BATTLESTATION: EasterEgg = {
	id: 'tommy-battlestation',
	clearingRadius: 13.5,
	footprint: { halfWidth: 1.5, halfDepth: 0.9 },
	gallery: {
		name: 'Tommy',
		caption: 'Working from the woods',
		camera: [1.9, 1.9, 4],
		target: [0, 0.8, -0.3],
	},
	create: () => {
		const root = new Group();
		const station = buildWorkstation(root);
		// Tommy faces his screens (-z), on the near side of the table.
		const seat = joint(root, [0.08, 0, sitZ]);
		seat.rotation.y = Math.PI;
		const tommy = buildTommy(seat);

		const rgbColor = new Color();
		let glance = 0;
		const update = ({ time, dt, player }: EasterEggFrame): void => {
			// Hammering away at the keyboard.
			for (const [i, wrist] of tommy.wrists.entries()) {
				const tap = Math.max(0, Math.sin(time * 22 + i * 1.9)) ** 3;
				wrist.rotation.x = 0.6 + tap * 0.35;
				wrist.rotation.z = Math.sin(time * 3.1 + i) * 0.15;
			}
			// Now and then his right hand goes for the mouse.
			const mouse = MathUtils.smootherstep(
				Math.sin(time * 0.9),
				0.55,
				0.8,
			);
			const [, rightShoulder] = tommy.shoulders;
			rightShoulder.rotation.z = 0.12 - mouse * 0.35;

			// Eyes flick between the screens.
			const look = Math.floor(time / 1.3) % 4;
			const targetYaw = [0, 0.45, 0, -0.45][look] ?? 0;
			const targetPitch = look === 2 ? -0.35 : 0.05;

			// ...until I roll past, when he glances over his shoulder at me.
			const distance = Math.hypot(player.x, player.z - sitZ);
			glance = MathUtils.lerp(
				glance,
				distance < 18 ? 1 : 0,
				1 - Math.exp(-4 * dt),
			);
			// Seen from behind him, I'm off to one side.
			const side = player.x >= 0 ? -1 : 1;
			tommy.upper.rotation.y = side * 0.45 * glance;
			tommy.head.rotation.set(
				MathUtils.lerp(
					tommy.head.rotation.x,
					MathUtils.lerp(targetPitch, -0.05, glance),
					1 - Math.exp(-8 * dt),
				),
				MathUtils.lerp(
					tommy.head.rotation.y,
					MathUtils.lerp(targetYaw, side * 1.25, glance),
					1 - Math.exp(-8 * dt),
				),
				0,
			);

			// Screens scroll; the RGB cycles; the generator rattles.
			for (const texture of station.textures.scrollY) {
				texture.offset.y = (texture.offset.y + dt * 0.12) % 1;
			}
			for (const texture of station.textures.scrollX) {
				texture.offset.x = (texture.offset.x + dt * 0.05) % 1;
			}
			for (const [i, material] of station.rgb.entries()) {
				rgbColor.setHSL((time * 0.25 + i * 0.2) % 1, 1, 0.55);
				material.emissive.copy(rgbColor);
			}
			station.generator.position.x = -1.25 + Math.sin(time * 60) * 0.004;
			station.generator.rotation.z = Math.sin(time * 47) * 0.008;
			station.dish.rotation.x = 0.25 + Math.sin(time * 0.3) * 0.02;
		};
		return { object: root, update };
	},
};
