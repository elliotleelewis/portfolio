import {
	MeshStandardMaterial,
	type MeshStandardMaterialParameters,
} from 'three';

/**
 * How a surface takes the light, whatever its colour. Every model in the
 * world is made from these few, so the world looks of a piece, and parts
 * with the same finish merge into one draw call (`mergeParts` merges parts
 * that differ only in colour).
 */
export const FINISHES = {
	// Cloth, skin, fur, wood, paper, bark and stone: most of the world.
	matte: { roughness: 0.9, metalness: 0 },
	// Hair, leather, plastic, painted wood and rubber boots.
	satin: { roughness: 0.55, metalness: 0 },
	// Glass, lenses, glazed china, lacquer and car paint.
	gloss: { roughness: 0.2, metalness: 0 },
	// Bright metal: chrome, steel, gold, aluminium, chains and cans.
	metal: { roughness: 0.3, metalness: 1 },
	// Dark, worn metal: cast iron.
	cast: { roughness: 0.6, metalness: 0.6 },
} as const satisfies Record<
	string,
	Pick<MeshStandardMaterialParameters, 'roughness' | 'metalness'>
>;

export type Finish = keyof typeof FINISHES;

/**
 * Whether a name is one of the finishes: what a model's materials are named
 * (see models/README.md).
 * @param name - The name.
 * @returns True if it's a finish.
 */
export const isFinish = (name: string): name is Finish =>
	Object.hasOwn(FINISHES, name);

/**
 * Colours the people in the world share, so every face is finished alike.
 */
export const TONES = {
	mouth: '#6e3432',
	teeth: '#f7f3e8',
	// Eyes, and anything else near black on a face.
	pupil: '#1b1411',
} as const;

// What a surface may add to its finish: never its own roughness or
// metalness, which come from the finish.
type Extras = Omit<
	MeshStandardMaterialParameters,
	'color' | 'roughness' | 'metalness'
>;

/**
 * Creates a material for a model in the world: a colour, finished like
 * the rest of the world.
 * @param color - Its colour.
 * @param finish - How it takes the light.
 * @param extras - Anything else, like a texture, a glow or see-through.
 * @returns The material.
 */
export const surface = (
	color: string,
	finish: Finish = 'matte',
	extras: Extras = {},
): MeshStandardMaterial =>
	new MeshStandardMaterial({ color, ...FINISHES[finish], ...extras });
