import tailwindcssBgPatterns from 'tailwindcss-bg-patterns';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	plugins: [tailwindcssBgPatterns],
};