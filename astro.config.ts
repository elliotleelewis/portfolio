import { readFileSync } from 'node:fs';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import type { AstroUserConfig } from 'astro';
import { defineConfig, fontProviders, sharpImageService } from 'astro/config';
import robotsTxt from 'astro-robots-txt';
import type { Dependency } from 'rollup-plugin-license';
import license from 'rollup-plugin-license';

const google = fontProviders.google();

// A font family from Google Fonts, with its options. Astro doesn't export the
// type on its own.
type GoogleFontFamily = NonNullable<
	AstroUserConfig<never, never, [typeof google]>['fonts']
>[0];

/**
 * One style of Fraunces from Google Fonts: a single weight, with the
 * optical-size axis kept, so large headings get the display design. Asked
 * for one at a time, Google sends a file cut down to that weight. Asked for
 * several weights together, it sends the full variable font.
 * @param weight - The weight.
 * @param style - Upright or italic.
 * @returns The font family entry.
 */
const fraunces = (
	weight: number,
	style: 'normal' | 'italic',
): GoogleFontFamily => ({
	provider: google,
	name: 'Fraunces',
	// Entries with the same variable, name and provider make one family.
	cssVariable: '--font-fraunces',
	weights: [weight],
	styles: [style],
	subsets: ['latin'],
	fallbacks: ['Iowan Old Style', 'Georgia', 'serif'],
	options: { experimental: { variableAxis: { opsz: [['9', '144']] } } },
});

/**
 * One package's notice, for /licenses.txt.
 * @param name - The package.
 * @param licence - Its licence's SPDX ID.
 * @param text - Its licence, with its copyright notice.
 * @returns The notice.
 */
const notice = (name: string, licence: string, text: string): string =>
	`${'-'.repeat(72)}\n${name} (${licence})\n\n${text.trim()}\n`;

/**
 * /licenses.txt: the notices that the open-source code and fonts the site
 * sends to browsers ask to go with them.
 * @param dependencies - The packages bundled into the page's JavaScript.
 * @returns The file.
 */
const licensesTxt = (dependencies: Dependency[]): string =>
	[
		'Open-source software in elliotleelewis.com\n\nThe site itself is (c) Elliot Lewis, all rights reserved. It sends your\nbrowser the open-source software and fonts below, whose licences ask for\nthese notices to go with them.\n',
		// Astro writes its own script for the hero straight into the page,
		// and Paraglide copies its runtime into src/paraglide/, so the bundle
		// doesn't see that either comes from a package.
		notice(
			'astro',
			'MIT',
			readFileSync('node_modules/astro/LICENSE', 'utf8'),
		),
		notice(
			'@inlang/paraglide-js',
			'MIT',
			readFileSync('node_modules/@inlang/paraglide-js/LICENSE', 'utf8'),
		),
		...dependencies
			.toSorted((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
			.map((dependency) => {
				const name = dependency.name ?? '';
				// A package that doesn't publish its licence needs a copy in
				// licenses/, named like `@scope+name.txt`, or the build fails.
				const text =
					dependency.licenseText ??
					readFileSync(
						`licenses/${name.replace('/', '+')}.txt`,
						'utf8',
					);
				// Apache-2.0 asks for a package's NOTICE file to go with it too.
				const withNotice =
					dependency.noticeText === null
						? text
						: `${text.trim()}\n\n${dependency.noticeText}`;
				return notice(name, dependency.license ?? '', withNotice);
			}),
		notice('Fonts', 'OFL-1.1', readFileSync('licenses/fonts.txt', 'utf8')),
	].join('\n');

// https://astro.build/config
export default defineConfig({
	site: 'https://elliotleelewis.com',
	build: {
		inlineStylesheets: 'always',
	},
	image: {
		// Photos are encoded well above the point where compression shows:
		// AVIF keeps full colour detail (no chroma subsampling), and WebP is
		// the fallback for browsers without AVIF. Effort 3 encodes six times
		// faster than the default 4, for files about 7% bigger at the same
		// quality. The dev server encodes on every request, and at 4 it took
		// 14 seconds to show the hero photo.
		service: sharpImageService({
			avif: { quality: 80, chromaSubsampling: '4:4:4', effort: 3 },
			webp: { quality: 90 },
		}),
	},
	// Every font comes from Google Fonts, and the build hosts it with the
	// site. A browser only downloads the styles a page uses.
	fonts: [
		// Headings are semibold, and one line italic.
		fraunces(600, 'normal'),
		fraunces(400, 'italic'),
		// Body text, from regular to black: one variable font.
		{
			provider: google,
			name: 'Inter',
			cssVariable: '--font-inter',
			weights: ['400 900'],
			styles: ['normal'],
			subsets: ['latin'],
			fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
		},
		// Labels and the game's score, only ever regular.
		{
			provider: google,
			name: 'JetBrains Mono',
			cssVariable: '--font-jetbrains-mono',
			weights: [400],
			styles: ['normal'],
			subsets: ['latin'],
			fallbacks: ['ui-monospace', 'SFMono-Regular', 'monospace'],
		},
	],
	integrations: [react({ compiler: true }), robotsTxt(), sitemap()],
	vite: {
		plugins: [
			// Compiles messages/ into typed functions in src/paraglide/, for
			// the Astro pages and the React island alike. English is the only
			// language so far. Keep the strategy in step with `prepare` in
			// package.json.
			paraglideVitePlugin({
				project: './project.inlang',
				outdir: './src/paraglide',
				strategy: ['baseLocale'],
			}),
			tailwindcss(),
			// Writes /licenses.txt, from only the browser's build: the rest
			// renders pages at build time and never reaches visitors. Fails the
			// build if a package we'd send has no licence, or one whose terms
			// a credit alone doesn't meet.
			{
				...license({
					thirdParty: {
						allow: {
							test: '(MIT OR ISC OR BSD-2-Clause OR BSD-3-Clause OR Apache-2.0 OR 0BSD)',
							failOnUnlicensed: true,
							failOnViolation: true,
						},
						output: {
							file: 'dist/licenses.txt',
							template: licensesTxt,
						},
					},
				}),
				applyToEnvironment: (environment) =>
					environment.name === 'client',
			},
		],
	},
});
