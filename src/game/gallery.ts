import {
	BufferAttribute,
	type BufferGeometry,
	Color,
	DirectionalLight,
	Fog,
	type Group,
	HemisphereLight,
	type Material,
	Mesh,
	MeshLambertMaterial,
	PCFShadowMap,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	Vector3,
	WebGLRenderer,
} from 'three';

import {
	ALL_EASTER_EGGS,
	type EasterEgg,
	type EasterEggInstance,
	type EasterEggShowcase,
	disposeObject,
} from './easter-eggs';
import { createMountains, createTreeGeometry } from './world';

export interface GalleryCallbacks {
	// The first frame has been drawn.
	onReady: () => void;
	// The camera is heading to a new easter egg.
	onSelect: (index: number, showcase: EasterEggShowcase) => void;
}

interface Station {
	egg: EasterEgg;
	instance: EasterEggInstance;
	position: Vector3;
	// When the camera arrived, so the easter egg can replay from the start.
	arrivedAt: number;
}

const fogColor = new Color('#dde3e5');
// Distance between easter eggs along the row.
const spacing = 18;
const fov = 40;
// How far off an easter egg "thinks" I am when it isn't being looked at, so
// it waits for me rather than playing out its moment.
const faraway = new Vector3(0, 0, 500);
// When the camera arrives, I "approach" from this far off, at this speed,
// to set off anything that happens as I roll up.
const approachFrom = 70;
const approachSpeed = 35;

/**
 * A clearing with every easter egg lined up in a row, and a camera that
 * glides from one to the next.
 */
export class Gallery {
	private readonly _host: HTMLElement;
	private readonly _callbacks: GalleryCallbacks;
	private readonly _renderer: WebGLRenderer;
	private readonly _scene = new Scene();
	private readonly _camera = new PerspectiveCamera(fov, 1, 0.05, 1200);
	private readonly _sun = new DirectionalLight('#fff3df', 2.2);
	private readonly _mountains: Group;
	private readonly _stations: Station[];
	private readonly _resizeObserver: ResizeObserver;

	private readonly _cameraTarget = new Vector3();
	private readonly _lookTarget = new Vector3();
	private readonly _look = new Vector3();
	private readonly _v = new Vector3();
	private readonly _drift = new Vector3();

	private _index = 0;
	private _zoom = 1;
	private _time = 0;
	private _last = 0;
	private _isReady = false;

	public constructor(host: HTMLElement, callbacks: GalleryCallbacks) {
		this._host = host;
		this._callbacks = callbacks;

		this._renderer = new WebGLRenderer({ antialias: true });
		this._renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
		this._renderer.shadowMap.enabled = true;
		this._renderer.shadowMap.type = PCFShadowMap;
		this._renderer.domElement.classList.add(
			'absolute',
			'inset-0',
			'size-full',
		);
		host.append(this._renderer.domElement);

		this._scene.background = fogColor;
		this._scene.fog = new Fog(fogColor, 30, 160);
		this._scene.add(new HemisphereLight('#f4f7f9', '#4f5f3c', 2.1));
		this._sun.castShadow = true;
		this._sun.shadow.mapSize.set(2048, 2048);
		this._sun.shadow.camera.left = -14;
		this._sun.shadow.camera.right = 14;
		this._sun.shadow.camera.top = 14;
		this._sun.shadow.camera.bottom = -14;
		this._sun.shadow.camera.far = 90;
		this._sun.shadow.bias = -0.0005;
		this._sun.shadow.normalBias = 0.03;
		this._scene.add(this._sun, this._sun.target);

		this._mountains = createMountains(fogColor);
		this._scene.add(this._mountains);

		this._stations = ALL_EASTER_EGGS.map((egg, i) => {
			const position = new Vector3(i * spacing, 0, 0);
			return {
				egg,
				instance: this.place(egg, position),
				position,
				arrivedAt: 0,
			};
		});
		this.createGround();
		this.createTrees();

		this._resizeObserver = new ResizeObserver(() => {
			this.resize();
		});
		this._resizeObserver.observe(host);
		this.resize();

		// Start at the first one, with no fly-in.
		this.select(0);
		this._camera.position
			.subVectors(this._cameraTarget, this._lookTarget)
			.multiplyScalar(this._zoom)
			.add(this._lookTarget);
		this._look.copy(this._lookTarget);
	}

	private place(egg: EasterEgg, position: Vector3): EasterEggInstance {
		const instance = egg.create();
		instance.object.position.copy(position);
		this._scene.add(instance.object);
		return instance;
	}

	private createGround(): void {
		const width = this._stations.length * spacing + 200;
		const geometry = new PlaneGeometry(width, 240, 90, 60);
		geometry.rotateX(-Math.PI / 2);
		geometry.translate(((this._stations.length - 1) * spacing) / 2, 0, -40);
		const position = geometry.getAttribute('position');
		const colors = new Float32Array(position.count * 3);
		const grass = new Color('#6d8448');
		const scrub = new Color('#51683a');
		const c = new Color();
		for (let i = 0; i < position.count; i++) {
			const x = position.getX(i);
			const z = position.getZ(i);
			// Flat where the easter eggs stand; gently rolling elsewhere.
			const bumps = Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.3);
			position.setY(i, z < -12 || z > 16 ? bumps * 0.6 - 0.05 : -0.02);
			const n = Math.sin(x * 1.3 + z * 0.7) * Math.sin(z * 1.1 - x * 0.4);
			c.copy(grass).lerp(scrub, (n + 1) / 2);
			colors.set([c.r, c.g, c.b], i * 3);
		}
		geometry.setAttribute('color', new BufferAttribute(colors, 3));
		geometry.computeVertexNormals();
		const ground = new Mesh(
			geometry,
			new MeshLambertMaterial({ vertexColors: true, flatShading: true }),
		);
		ground.receiveShadow = true;
		this._scene.add(ground);
	}

	// Forest behind and around the row, leaving each easter egg (and the
	// camera's path) in the open.
	private createTrees(): void {
		const geometries = [
			createTreeGeometry(6, 8, 1.5),
			createTreeGeometry(5, 6.5, 1.7),
			createTreeGeometry(8, 11, 1.4),
		];
		const materials = ['#ffffff', '#dfe8d4', '#c9d6c2'].map(
			(color) =>
				new MeshLambertMaterial({
					color,
					vertexColors: true,
					flatShading: true,
				}),
		);
		const end = (this._stations.length - 1) * spacing;
		let seed = 11;
		const random = (): number => {
			seed = (seed * 16_807) % 2_147_483_647;
			return (seed - 1) / 2_147_483_646;
		};
		for (let i = 0; i < 260; i++) {
			const x = -40 + random() * (end + 80);
			const z = -70 + random() * 110;
			const isNearRow = z > -9 && z < 14;
			const isNearEnd = x < -8 || x > end + 8;
			// Keep the row itself (and the camera's path) open, save for a few
			// trees between easter eggs.
			if (isNearRow && !isNearEnd) {
				const gap = Math.abs(
					((x + spacing / 2) % spacing) - spacing / 2,
				);
				if (gap < spacing / 2 - 1.5 || z > 0) {
					continue;
				}
			}
			const tree = new Mesh(
				geometries[i % geometries.length],
				materials[i % materials.length],
			);
			tree.position.set(x, -0.1, z);
			tree.scale.setScalar(0.8 + random() * 0.5);
			tree.rotation.y = random() * Math.PI * 2;
			tree.castShadow = true;
			this._scene.add(tree);
		}
	}

	private resize(): void {
		const { clientWidth: width, clientHeight: height } = this._host;
		if (width === 0 || height === 0) {
			return;
		}
		this._renderer.setSize(width, height, false);
		this._camera.aspect = width / height;
		// Portrait screens need a wider view to fit the same easter egg in.
		// Portrait screens get a slightly wider view, with the camera pulled
		// back, to fit the same easter egg in.
		const isPortrait = this._camera.aspect < 1;
		this._camera.fov = isPortrait ? fov / this._camera.aspect ** 0.25 : fov;
		this._zoom = isPortrait ? this._camera.aspect ** -0.4 : 1;
		this._camera.updateProjectionMatrix();
	}

	private frame(now: number): void {
		const dt = Math.min((now - this._last) / 1000, 1 / 20);
		this._last = now;
		this._time += dt;

		// Glide to the current easter egg, with a gentle drift once there.
		const damp = 1 - Math.exp(-3 * dt);
		const drift = this._v
			.subVectors(this._cameraTarget, this._lookTarget)
			.multiplyScalar(this._zoom)
			.add(this._lookTarget)
			.add(
				this._drift.set(
					Math.sin(this._time * 0.35) * 0.35,
					Math.sin(this._time * 0.5) * 0.1,
					0,
				),
			);
		this._camera.position.lerp(drift, damp);
		this._look.lerp(this._lookTarget, damp);
		this._camera.lookAt(this._look);

		for (const [i, station] of this._stations.entries()) {
			const { object, update } = station.instance;
			if (!update) {
				continue;
			}
			let player = faraway;
			if (i === this._index) {
				// "Roll up" to it, ending where the camera is.
				object.updateMatrixWorld();
				player = object.worldToLocal(
					this._v.copy(this._camera.position),
				);
				const since = this._time - station.arrivedAt;
				player.z += Math.max(0, approachFrom - since * approachSpeed);
			}
			update({ time: this._time, dt, player });
		}

		this._mountains.position.copy(this._camera.position);
		this._sun.target.position.copy(this._look);
		this._sun.position.copy(this._look).add(this._v.set(20, 40, 15));

		this._renderer.render(this._scene, this._camera);

		if (this._isReady) {
			return;
		}

		this._isReady = true;
		this._callbacks.onReady();
	}

	public get count(): number {
		return this._stations.length;
	}

	public next(): void {
		this.select((this._index + 1) % this._stations.length);
	}

	public previous(): void {
		this.select(
			(this._index - 1 + this._stations.length) % this._stations.length,
		);
	}

	public select(index: number): void {
		const count = this._stations.length;
		this._index = ((index % count) + count) % count;
		const station = this._stations[this._index];
		// Start its moment over, fresh.
		station.instance.object.removeFromParent();
		disposeObject(station.instance.object);
		station.instance = this.place(station.egg, station.position);
		station.arrivedAt = this._time;

		const { camera, target } = station.egg.gallery;
		this._cameraTarget.fromArray(camera).add(station.position);
		this._lookTarget.fromArray(target).add(station.position);
		// Aim a little low, so the easter egg sits above the caption panel.
		this._lookTarget.y -=
			this._cameraTarget.distanceTo(this._lookTarget) * 0.14;
		this._callbacks.onSelect(this._index, station.egg.gallery);
	}

	public start(): void {
		this._last = performance.now();
		this._renderer.setAnimationLoop((now: number) => {
			this.frame(now);
		});
	}

	public dispose(): void {
		this._renderer.setAnimationLoop(null);
		this._resizeObserver.disconnect();
		const geometries = new Set<BufferGeometry>();
		const materials = new Set<Material>();
		this._scene.traverse((object) => {
			if (!(object instanceof Mesh)) {
				return;
			}
			geometries.add(object.geometry as BufferGeometry);
			const material = object.material as Material | Material[];
			const list = Array.isArray(material) ? material : [material];
			for (const m of list) {
				materials.add(m);
			}
		});
		for (const geometry of geometries) {
			geometry.dispose();
		}
		for (const material of materials) {
			material.dispose();
		}
		this._renderer.dispose();
		this._renderer.domElement.remove();
	}
}
