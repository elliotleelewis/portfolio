import { readFileSync } from 'node:fs';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders, sharpImageService } from 'astro/config';
import robotsTxt from 'astro-robots-txt';
import type { Dependency } from 'rollup-plugin-license';
import license from 'rollup-plugin-license';

const google = fontProviders.google();

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
 * /licenses.txt: the notices that the open-source code, fonts and sounds the
 * site sends to browsers ask to go with them.
 * @param dependencies - The packages bundled into the page's JavaScript.
 * @returns The file.
 */
const licensesTxt = (dependencies: Dependency[]): string =>
	[
		'Open-source software in elliotleelewis.com\n\nThe site itself is (c) Elliot Lewis, all rights reserved. It sends your\nbrowser the open-source software, fonts and sounds below, whose licences\nask for these notices to go with them (or, for the sounds, credit them).\n',
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
		notice(
			'Sounds',
			'CC0-1.0',
			readFileSync('licenses/sounds.txt', 'utf8'),
		),
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
		// 14 seconds to show the hero photo. Astro's image cache
		// (node_modules/.astro) ignores these settings, so delete it after
		// changing them, or builds keep the old images.
		service: sharpImageService({
			avif: { quality: 80, chromaSubsampling: '4:4:4', effort: 3 },
			webp: { quality: 90 },
		}),
	},
	// Every font comes from Google Fonts, and the build hosts it with the
	// site. A browser only downloads the styles a page uses. If the download
	// fails, the build carries on without them, so the e2e test "loads each
	// font" checks they're there. Each family also needs a <Font> in
	// src/layout/Layout.astro.
	fonts: [
		// Headings, all semibold, and with the optical-size axis kept, so
		// large ones get the display design. Asked for one weight, Google
		// sends a file cut down to it. Asked for several, it sends the full
		// variable font.
		{
			provider: google,
			name: 'Fraunces',
			cssVariable: '--font-fraunces',
			weights: [600],
			styles: ['normal'],
			subsets: ['latin'],
			fallbacks: ['Iowan Old Style', 'Georgia', 'serif'],
			options: {
				experimental: { variableAxis: { opsz: [['9', '144']] } },
			},
		},
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
			// package.json. Adding one means a messages/{locale}.json, the
			// locale in project.inlang/settings.json, Astro's i18n routing,
			// and a `url` strategy here and in `prepare`.
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
