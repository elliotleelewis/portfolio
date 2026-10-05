import {
	type BufferGeometry,
	Color,
	type DirectionalLight,
	type HemisphereLight,
	LinearSRGBColorSpace,
	type PointLight,
	type Points,
	type PointsMaterial,
} from 'three';

// The site's light and dark modes, out on the mountain.
export type TimeOfDay = 'day' | 'night';

// The light and air around the scene, from the site's theme.
export interface Atmosphere {
	timeOfDay: TimeOfDay;
	// The haze everything far off fades into, and the sky behind it.
	fog: Color;
	// The sun, or by night the moon, and how bright it is.
	sun: Color;
	sunIntensity: number;
	// Light from the sky above and bounced off the ground below.
	sky: Color;
	ground: Color;
	skyIntensity: number;
	// The lantern I carry, lit only at night.
	lantern: Color;
	lanternIntensity: number;
	// Whether the stars are out.
	stars: boolean;
}

// How bright each light is, by day and by night. Their colours are in the
// site's theme (src/styles/global.css), with the rest of the palette.
const intensities: Record<
	TimeOfDay,
	Pick<Atmosphere, 'sunIntensity' | 'skyIntensity' | 'lanternIntensity'>
> = {
	day: { sunIntensity: 2.2, skyIntensity: 2.1, lanternIntensity: 0 },
	night: { sunIntensity: 0.9, skyIntensity: 1.1, lanternIntensity: 22 },
};

const oklch =
	/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/[^)]*)?\)$/i;

/**
 * Reads a colour from the site's theme, written in OKLCH, for three.js.
 * OKLCH converts straight to linear sRGB, the space three.js works in.
 * Colours past sRGB (the amber reaches into Display P3) are clipped to it.
 * @param value - The colour, like `oklch(54% 0.165 49)`.
 * @returns The colour.
 */
export const parseOklch = (value: string): Color => {
	const match = oklch.exec(value.trim());
	if (!match) {
		throw new Error(`Expected an oklch() colour, not "${value}"`);
	}
	const [, lightness = '', percent, chroma = '', hue = ''] = match;
	const l = Number(lightness) / (percent ? 100 : 1);
	const c = Number(chroma);
	const h = (Number(hue) * Math.PI) / 180;
	const a = c * Math.cos(h);
	const b = c * Math.sin(h);
	// OKLab to LMS, then to linear sRGB (Björn Ottosson's matrices).
	const lms = [
		l + 0.3963377774 * a + 0.2158037573 * b,
		l - 0.1055613458 * a - 0.0638541728 * b,
		l - 0.0894841775 * a - 1.291485548 * b,
	].map((x) => x ** 3);
	const [ll = 0, m = 0, s = 0] = lms;
	const clip = (x: number): number => Math.min(1, Math.max(0, x));
	return new Color().setRGB(
		clip(4.0767416621 * ll - 3.3077115913 * m + 0.2309699292 * s),
		clip(-1.2684380046 * ll + 2.6097574011 * m - 0.3413193965 * s),
		clip(-0.0041960863 * ll - 0.7034186147 * m + 1.707614701 * s),
		LinearSRGBColorSpace,
	);
};

/**
 * Picks the light or dark mode's colour from one of the theme's, written
 * `light-dark(light, dark)`. A colour the same in both is written once.
 * @param value - The theme's colour.
 * @param timeOfDay - Day for light mode, night for dark.
 * @returns The colour for that mode.
 */
export const pickMode = (value: string, timeOfDay: TimeOfDay): string => {
	const trimmed = value.trim();
	if (!trimmed.startsWith('light-dark(')) {
		return trimmed;
	}
	// The comma between the two colours, not one inside either.
	const inner = trimmed.slice('light-dark('.length, -1);
	let depth = 0;
	for (let i = 0; i < inner.length; i++) {
		if (inner[i] === '(') {
			depth++;
		} else if (inner[i] === ')') {
			depth--;
		} else if (depth === 0 && inner[i] === ',') {
			return (
				timeOfDay === 'day' ? inner.slice(0, i) : inner.slice(i + 1)
			).trim();
		}
	}
	throw new Error(`Expected light-dark(light, dark), not "${value}"`);
};

/**
 * The scene's atmosphere, from the site's theme.
 * @param read - Reads one of the theme's custom properties, like `--accent`.
 * @param timeOfDay - Whether the site's in light mode (day) or dark (night).
 * @returns The atmosphere.
 */
export const readAtmosphere = (
	read: (name: string) => string,
	timeOfDay: TimeOfDay,
): Atmosphere => {
	const colour = (name: string): Color =>
		parseOklch(pickMode(read(name), timeOfDay));
	return {
		timeOfDay,
		fog: colour('--scene-fog'),
		sun: colour('--scene-sun'),
		sky: colour('--scene-sky'),
		ground: colour('--scene-ground'),
		// The wood stove's amber, the site's one accent.
		lantern: colour('--accent'),
		stars: timeOfDay === 'night',
		...intensities[timeOfDay],
	};
};

// The lights the atmosphere sets.
export interface Lights {
	sun: DirectionalLight;
	sky: HemisphereLight;
	lantern: PointLight;
}

/**
 * Colours the lights, and sets how bright they are, in place, so changing
 * mode doesn't rebuild them.
 * @param lights - The lights.
 * @param lights.sun - The sun, or the moon.
 * @param lights.sky - Light from the sky and the ground.
 * @param lights.lantern - My lantern.
 * @param atmosphere - The atmosphere.
 */
export const setLights = (
	{ sun, sky, lantern }: Lights,
	atmosphere: Atmosphere,
): void => {
	sun.color.copy(atmosphere.sun);
	sun.intensity = atmosphere.sunIntensity;
	sky.color.copy(atmosphere.sky);
	sky.groundColor.copy(atmosphere.ground);
	sky.intensity = atmosphere.skyIntensity;
	lantern.color.copy(atmosphere.lantern);
	lantern.intensity = atmosphere.lanternIntensity;
	// Out altogether by day, so it costs nothing.
	lantern.visible = atmosphere.lanternIntensity > 0;
};

/**
 * Brings the stars out by night, in the moon's colour, and hides them by
 * day.
 * @param stars - The stars.
 * @param atmosphere - The atmosphere.
 */
export const setStars = (
	stars: Points<BufferGeometry, PointsMaterial>,
	atmosphere: Atmosphere,
): void => {
	stars.visible = atmosphere.stars;
	stars.material.color.copy(atmosphere.sun);
};
