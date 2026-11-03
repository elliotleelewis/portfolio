import { execSync } from 'node:child_process';

import { defineConfig, devices } from '@playwright/test';

import base from './playwright.config';

// Each set of screenshots goes in a folder of its own, named for the branch
// (or SHOTS_NAME), so a set from main and one from a branch sit side by side
// to compare (shots/out/compare.html).
const name =
	process.env.SHOTS_NAME ??
	execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' })
		.trim()
		.replaceAll(/[^\w.-]+/g, '-');
process.env.SHOTS_NAME = name;

const launchOptions = {
	args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
	...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE && {
		executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
	}),
};

/**
 * Screenshots of the 3D scene, by day and by night, on a desktop and a
 * phone, for checking how a change to the game looks: `pnpm shots`. Unlike
 * the end-to-end tests, they draw the scene, so they're slow, and aren't
 * part of CI.
 */
export default defineConfig({
	...base,
	testDir: 'shots',
	outputDir: 'test-results/shots',
	// Drawing on the CPU takes a while.
	timeout: 180_000,
	// One at a time: each draws with every core it can get.
	workers: 1,
	fullyParallel: false,
	reporter: 'list',
	projects: [
		{
			name: 'desktop-day',
			use: {
				...devices['Desktop Chrome'],
				launchOptions,
				colorScheme: 'light',
			},
		},
		{
			name: 'desktop-night',
			use: {
				...devices['Desktop Chrome'],
				launchOptions,
				colorScheme: 'dark',
			},
		},
		{
			name: 'phone-day',
			use: { ...devices['Pixel 7'], launchOptions, colorScheme: 'light' },
		},
		{
			name: 'phone-night',
			use: { ...devices['Pixel 7'], launchOptions, colorScheme: 'dark' },
		},
	],
});
