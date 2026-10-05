import { readFileSync } from 'node:fs';

import {
	BufferGeometry,
	Color,
	DirectionalLight,
	HemisphereLight,
	PointLight,
	Points,
	PointsMaterial,
} from 'three';
import { describe, expect, it } from 'vitest';

import {
	type TimeOfDay,
	parseOklch,
	readAtmosphere,
	setLights,
	setStars,
} from './atmosphere';

const css = readFileSync(
	new URL('../styles/global.css', import.meta.url),
	'utf8',
);

// The light mode's custom properties, then the dark mode's.
const [light = '', dark = ''] = css
	.matchAll(/:root\s*\{([^}]*)\}/g)
	.map(([, block]) => block)
	.toArray();

/**
 * Reads the theme's custom properties straight from the stylesheet, as the
 * page would see them: the dark mode's over the light mode's by night.
 * @param timeOfDay - Day for light mode, night for dark.
 * @returns Reads one custom property.
 */
const theme =
	(timeOfDay: TimeOfDay) =>
	(name: string): string => {
		const block = timeOfDay === 'day' ? light : `${light}\n${dark}`;
		const values = block
			.matchAll(new RegExp(String.raw`${name}:\s*([^;]+);`, 'g'))
			.toArray();
		return values.at(-1)?.[1] ?? '';
	};

/**
 * Roughly how bright a colour is.
 * @param color - The colour.
 * @returns Its channels, added up.
 */
const brightness = (color: Color): number => color.r + color.g + color.b;

describe('parseOklch', () => {
	it('converts to the same colour as the sRGB it came from', () => {
		expect(parseOklch('oklch(91.2% 0.007 219.6)').getHexString()).toBe(
			new Color('#dde3e5').getHexString(),
		);
		expect(parseOklch('oklch(0.462 0.057 128.4deg)').getHexString()).toBe(
			new Color('#4f5f3c').getHexString(),
		);
	});

	it('clips colours past sRGB into it', () => {
		const { r, g, b } = parseOklch('oklch(78.2% 0.19 72.3)');
		for (const channel of [r, g, b]) {
			expect(channel).toBeGreaterThanOrEqual(0);
			expect(channel).toBeLessThanOrEqual(1);
		}
	});

	it('turns down anything else', () => {
		expect(() => parseOklch('#dde3e5')).toThrow();
	});
});

describe('readAtmosphere', () => {
	it('reads every colour the scene needs from the theme', () => {
		for (const timeOfDay of ['day', 'night'] as const) {
			expect(() =>
				readAtmosphere(theme(timeOfDay), timeOfDay),
			).not.toThrow();
		}
	});

	it('is darker by night, with the lantern lit and the stars out', () => {
		const day = readAtmosphere(theme('day'), 'day');
		const night = readAtmosphere(theme('night'), 'night');
		expect(brightness(night.fog)).toBeLessThan(brightness(day.fog));
		expect(night.sunIntensity).toBeLessThan(day.sunIntensity);
		expect(day.lanternIntensity).toBe(0);
		expect(night.lanternIntensity).toBeGreaterThan(0);
		expect(day.stars).toBe(false);
		expect(night.stars).toBe(true);
	});
});

describe('setLights and setStars', () => {
	it('switch between day and night in place', () => {
		const lights = {
			sun: new DirectionalLight(),
			sky: new HemisphereLight(),
			lantern: new PointLight(),
		};
		const stars = new Points(new BufferGeometry(), new PointsMaterial());
		const night = readAtmosphere(theme('night'), 'night');
		setLights(lights, night);
		setStars(stars, night);
		expect(lights.sun.color.equals(night.sun)).toBe(true);
		expect(lights.sky.groundColor.equals(night.ground)).toBe(true);
		expect(lights.lantern.visible).toBe(true);
		expect(stars.visible).toBe(true);

		const day = readAtmosphere(theme('day'), 'day');
		setLights(lights, day);
		setStars(stars, day);
		expect(lights.sun.intensity).toBe(day.sunIntensity);
		expect(lights.lantern.visible).toBe(false);
		expect(stars.visible).toBe(false);
	});
});
