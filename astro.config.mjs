import partytown from '@astrojs/partytown';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders, sharpImageService } from 'astro/config';
import robotsTxt from 'astro-robots-txt';

const google = fontProviders.google();

/**
 * One style of Fraunces from Google Fonts: a single weight, with the
 * optical-size axis kept, so large headings get the display design. Asked
 * for one at a time, Google sends a file cut down to that weight. Asked for
 * several weights together, it sends the full variable font.
 * @param weight - The weight.
 * @param style - Upright or italic.
 * @returns The font family entry.
 */
const fraunces = (weight, style) => ({
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
	// Headings are semibold, the game page's title bold, and one line italic.
	// A browser only downloads the styles a page uses.
	fonts: [
		fraunces(600, 'normal'),
		fraunces(700, 'normal'),
		fraunces(400, 'italic'),
	],
	integrations: [
		partytown({
			config: {
				forward: ['dataLayer.push'],
			},
		}),
		react({ compiler: true }),
		robotsTxt(),
		sitemap(),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
