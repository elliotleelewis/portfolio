import { ShaderChunk } from 'three';

// How three.js measures the haze: depth straight ahead of the camera.
const depth = 'vFogDepth = - mvPosition.z;';
// ...and how far it actually is. Otherwise things off to the side of a wide
// view count as nearer than they are, and show through the haze.
const distance = 'vFogDepth = length( mvPosition.xyz );';

// What three.js does with the haze: tint towards the haze colour.
const tint = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';

// How hazed something has to be before it starts fading out altogether.
export const HAZE_FADE_FROM = 0.97;

// As well as the tint, fade out (with a fine, fixed stipple) whatever the
// haze has all but swallowed. The far mountains ignore the haze, so they
// show through, rather than a haze-coloured shape in front of them: the far
// end of the ground, or a tree just planted, would otherwise stand out
// against the mountains and pop in.
const fade = `${tint}
	float hazeFade = smoothstep( ${HAZE_FADE_FROM.toFixed(2)}, 1.0, fogFactor );
	if ( hazeFade > 0.0 && fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) < hazeFade ) discard;`;

/**
 * Swaps one piece of three.js's shader code for another.
 * @param chunk - The shader chunk's name.
 * @param from - The code to replace.
 * @param to - What to replace it with.
 */
const patch = (
	chunk: 'fog_fragment' | 'fog_vertex',
	from: string,
	to: string,
): void => {
	if (ShaderChunk[chunk].includes(to)) {
		return;
	}
	if (!ShaderChunk[chunk].includes(from)) {
		throw new Error(
			`three.js's ${chunk} shader has changed: update haze.ts`,
		);
	}
	ShaderChunk[chunk] = ShaderChunk[chunk].replace(from, () => to);
};

/**
 * Makes the haze thicken with distance, and swallow things whole rather than
 * turning them haze-coloured, so what's behind shows through. Changes
 * three.js's fog shaders for every material that uses fog, so call it before
 * anything is drawn.
 */
export const fadeIntoHaze = (): void => {
	patch('fog_vertex', depth, distance);
	patch('fog_fragment', tint, fade);
};
