import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

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
		sitemap(),
		tailwind(),
	],
});
