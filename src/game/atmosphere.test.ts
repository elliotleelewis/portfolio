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
	parseOklch,
	pickMode,
	readAtmosphere,
	setLights,
	setStars,
} from './atmosphere';

const css = readFileSync(
	new URL('../styles/global.css', import.meta.url),
	'utf8',
);

/**
 * Reads one of the theme's custom properties straight from the stylesheet,
 * as the page would before picking a mode.
 * @param name - The property, like `--accent`.
 * @returns Its value.
 */
const theme = (name: string): string =>
	new RegExp(String.raw`${name}:\s*([^;]+);`).exec(css)?.[1] ?? '';

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

	it('brings colours past sRGB into it', () => {
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

describe('pickMode', () => {
	it('picks the light or dark colour', () => {
		const value = 'light-dark(oklch(91.2% .007 219.6),oklch(26% .025 220))';
		expect(pickMode(value, 'day')).toBe('oklch(91.2% .007 219.6)');
		expect(pickMode(value, 'night')).toBe('oklch(26% .025 220)');
	});

	it('keeps a colour that is the same in both', () => {
		expect(pickMode(' oklch(54% 0.165 49) ', 'night')).toBe(
			'oklch(54% 0.165 49)',
		);
	});
});

describe('readAtmosphere', () => {
	it('reads every colour the scene needs from the theme', () => {
		for (const timeOfDay of ['day', 'night'] as const) {
			expect(() => readAtmosphere(theme, timeOfDay)).not.toThrow();
		}
	});

	it('is darker by night, with the lantern lit and the stars out', () => {
		const day = readAtmosphere(theme, 'day');
		const night = readAtmosphere(theme, 'night');
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
		const night = readAtmosphere(theme, 'night');
		setLights(lights, night);
		setStars(stars, night);
		expect(lights.sun.color.equals(night.sun)).toBe(true);
		expect(lights.sky.groundColor.equals(night.ground)).toBe(true);
		expect(lights.lantern.visible).toBe(true);
		expect(stars.visible).toBe(true);

		const day = readAtmosphere(theme, 'day');
		setLights(lights, day);
		setStars(stars, day);
		expect(lights.sun.intensity).toBe(day.sunIntensity);
		expect(lights.lantern.visible).toBe(false);
		expect(stars.visible).toBe(false);
	});
});
