import {
	BackSide,
	BufferAttribute,
	type Color,
	Mesh,
	MeshBasicMaterial,
	PMREMGenerator,
	Scene,
	SphereGeometry,
	type Vector3,
	type WebGLRenderer,
} from 'three';

// What the environment is made from: the scene's own sky and light.
export interface EnvironmentColours {
	fog: Color;
	sky: Color;
	ground: Color;
	sun: Color;
}

// The environment's own scene, drawn once into the map and then freed.
const radius = 10;
// How far above and below the horizon the sky and ground take over from
// the haze, as a share of straight up or down.
const skyBlend = 0.45;
const groundBlend = 0.15;
// The sun's (or moon's) size and brightness in the sky: a small, bright
// spot that shiny things show as a highlight.
const sunSize = 1.2;
const sunBrightness = 6;

/**
 * Paints the inside of the sky: the haze at the horizon, the sky above and
 * the ground below.
 * @param geometry - The sky's sphere.
 * @param colours - The scene's colours.
 * @param colours.fog - The haze, at the horizon.
 * @param colours.sky - The sky, above.
 * @param colours.ground - The ground, below.
 */
const paintSky = (
	geometry: SphereGeometry,
	{ fog, sky, ground }: EnvironmentColours,
): void => {
	const position = geometry.getAttribute('position');
	const colours = new Float32Array(position.count * 3);
	const colour = fog.clone();
	for (let i = 0; i < position.count; i++) {
		const up = position.getY(i) / radius;
		colour.copy(fog);
		if (up > 0) {
			colour.lerp(sky, Math.min(1, up / skyBlend));
		} else {
			colour.lerp(ground, Math.min(1, -up / groundBlend));
		}
		colour.toArray(colours, i * 3);
	}
	geometry.setAttribute('color', new BufferAttribute(colours, 3));
};

/**
 * Makes what shiny things in a scene reflect, and what lights everything
 * from all round a little: the scene's sky, haze and ground, with the sun
 * (or the moon) in it. Drawn once, for the scene's atmosphere, never each
 * frame.
 * @param target - The scene to light.
 * @param renderer - What draws it.
 * @param colours - The scene's colours.
 * @param sunDirection - Which way the sun is from the scene.
 * @param intensity - How strongly it lights the scene.
 * @returns Takes it out of the scene, and frees it.
 */
export const lightWithEnvironment = (
	target: Scene,
	renderer: WebGLRenderer,
	colours: EnvironmentColours,
	sunDirection: Vector3,
	intensity: number,
): (() => void) => {
	const scene = new Scene();
	const skyGeometry = new SphereGeometry(radius, 32, 16);
	paintSky(skyGeometry, colours);
	const skyMaterial = new MeshBasicMaterial({
		vertexColors: true,
		side: BackSide,
	});
	scene.add(new Mesh(skyGeometry, skyMaterial));

	const sunGeometry = new SphereGeometry(sunSize, 12, 8);
	const sunMaterial = new MeshBasicMaterial({
		color: colours.sun.clone().multiplyScalar(sunBrightness),
	});
	const sun = new Mesh(sunGeometry, sunMaterial);
	sun.position
		.copy(sunDirection)
		.normalize()
		.multiplyScalar(radius * 0.8);
	scene.add(sun);

	const generator = new PMREMGenerator(renderer);
	const map = generator.fromScene(scene, 0.02);
	generator.dispose();
	for (const freed of [skyGeometry, skyMaterial, sunGeometry, sunMaterial]) {
		freed.dispose();
	}
	target.environment = map.texture;
	target.environmentIntensity = intensity;
	return () => {
		if (target.environment === map.texture) {
			target.environment = null;
		}
		map.dispose();
	};
};
