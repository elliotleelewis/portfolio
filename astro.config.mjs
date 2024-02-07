import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	build: {
		inlineStylesheets: 'always',
	},
	integrations: [tailwind()],
});
