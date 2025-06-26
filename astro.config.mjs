import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import robotsTxt from 'astro-robots-txt';

// https://astro.build/config
export default defineConfig({
	site: 'https://elliotleelewis.com',
	build: {
		inlineStylesheets: 'always',
	},
	integrations: [
		partytown({
			config: {
				forward: ['dataLayer.push'],
			},
		}),
		robotsTxt(),
		sitemap(),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
