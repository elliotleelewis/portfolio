import partytown from '@astrojs/partytown';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, sharpImageService } from 'astro/config';
import robotsTxt from 'astro-robots-txt';

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
