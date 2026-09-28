import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import type { AstroUserConfig } from 'astro';
import { defineConfig, fontProviders, sharpImageService } from 'astro/config';
import robotsTxt from 'astro-robots-txt';

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
		plugins: [tailwindcss()],
	},
});
