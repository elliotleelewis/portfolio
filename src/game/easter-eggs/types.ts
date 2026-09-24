import { type Object3D, type Vector3 } from 'three';

export interface EasterEggFrame {
	time: number;
	dt: number;
	// My position in the easter egg's local space (+z is uphill, towards me
	// as I approach).
	player: Vector3;
}

export interface EasterEggInstance {
	// Placed on the slope, facing +z (uphill).
	object: Object3D;
	update?: (frame: EasterEggFrame) => void;
}

/**
 * How an easter egg is shown in the gallery. Positions are in its local
 * space, where it faces +z.
 */
export interface EasterEggShowcase {
	name: string;
	caption: string;
	// Where the camera sits, and what it looks at.
	camera: [number, number, number];
	target: [number, number, number];
}

/**
 * A landmark from the stag do, dropped into a clearing down the mountain.
 *
 * To add one: write a module that exports an `EasterEgg`, then add it to the
 * list in `./index.ts`.
 */
export interface EasterEgg {
	id: string;
	// Radius of the tree-free clearing around it, in metres.
	clearingRadius: number;
	// Solid area I bounce off, as half-extents in local x and z.
	footprint?: { halfWidth: number; halfDepth: number };
	gallery: EasterEggShowcase;
	create: () => EasterEggInstance;
}
