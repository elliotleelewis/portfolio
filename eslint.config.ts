import path from 'node:path';

import eslint from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import tailwind from 'eslint-plugin-better-tailwindcss';
import { createNodeResolver, importX } from 'eslint-plugin-import-x';
import { jsdoc } from 'eslint-plugin-jsdoc';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const namingConvention = [
	{
		selector: 'default',
		format: ['camelCase'],
		leadingUnderscore: 'forbid',
		trailingUnderscore: 'forbid',
	},
	// Keys that have to be quoted, like 'import-x/order' or 'Content-Type',
	// name something outside the code.
	{
		selector: ['objectLiteralProperty', 'typeProperty'],
		modifiers: ['requiresQuotes'],
		format: null,
	},
	{
		selector: 'typeLike',
		format: ['PascalCase'],
		leadingUnderscore: 'forbid',
		trailingUnderscore: 'forbid',
	},
	{
		selector: 'enumMember',
		format: ['PascalCase'],
	},
	{
		selector: 'parameter',
		modifiers: ['unused'],
		format: ['camelCase'],
		leadingUnderscore: 'require',
	},
	{
		selector: 'property',
		modifiers: ['readonly', 'static'],
		format: ['UPPER_CASE'],
	},
	{
		selector: 'property',
		modifiers: ['private'],
		format: ['camelCase'],
		leadingUnderscore: 'require',
	},
	{
		selector: 'variable',
		modifiers: ['const', 'exported'],
		format: ['UPPER_CASE'],
	},
	{
		selector: 'variable',
		modifiers: ['const', 'exported'],
		types: ['function'],
		format: ['camelCase'],
	},
];

export default defineConfig(
	includeIgnoreFile(path.resolve(import.meta.dirname, '.gitignore')),
	eslint.configs.recommended,
	{
		files: ['**/*.ts', '**/*.tsx'],
		extends: [
			tseslint.configs.strictTypeChecked,
			tseslint.configs.stylisticTypeChecked,
			comments.recommended,
			importX.flatConfigs.recommended,
			importX.flatConfigs.typescript,
			jsdoc({ config: 'flat/recommended-typescript-error' }),
			unicorn.configs.recommended,
		],
		settings: {
			// Every import of mine is relative, so Node's own resolution is
			// enough, and unlike TypeScript's, it keeps jotai and jotai/utils
			// apart.
			'import-x/resolver-next': [
				createNodeResolver({
					extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
				}),
			],
		},
		rules: {
			'@typescript-eslint/naming-convention': [
				'error',
				...namingConvention,
			],
			// With verbatimModuleSyntax, `import { type X } from 'y'` still
			// loads 'y' for its side effects; `import type { X }` doesn't.
			// That matters for code that should only load on demand, like the
			// game.
			'@typescript-eslint/no-import-type-side-effects': 'error',
			// TypeScript checks this already.
			'import-x/no-named-as-default-member': 'off',
			// Packages, then parents, then siblings, each sorted.
			'import-x/order': [
				'error',
				{
					alphabetize: { order: 'asc' },
					named: true,
					'newlines-between': 'always',
				},
			],
			// Too keen: it would rename `props`, `ref` and `i`.
			'unicorn/name-replacements': 'off',
			// JSDoc comments keep the leading asterisk on each line, as jsdoc's
			// own rules expect.
			'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
			// React, JSON and three.js all use null.
			'unicorn/no-null': 'off',
		},
	},
	{
		files: ['**/*.tsx'],
		extends: [
			reactHooks.configs.flat['recommended-latest'],
			jsxA11y.flatConfigs.strict,
		],
		rules: {
			// Components are PascalCase.
			'@typescript-eslint/naming-convention': [
				'error',
				...namingConvention.map((option) =>
					option.types?.includes('function')
						? { ...option, format: ['camelCase', 'PascalCase'] }
						: option,
				),
				{
					selector: 'variable',
					modifiers: ['const'],
					types: ['function'],
					format: ['camelCase', 'PascalCase'],
				},
			],
		},
	},
	{
		// A tool's config is its default export, built by a call.
		files: ['*.config.ts'],
		rules: {
			'unicorn/no-top-level-side-effects': 'off',
		},
	},
	{
		// What tests run in the page, with `page.evaluate`.
		files: ['e2e/**'],
		languageOptions: {
			globals: globals.browser,
		},
	},
	{
		// The page only imports types from the leaderboard's Function.
		// Anything more would bundle the Function's code (with Zod and
		// obscenity) into the site.
		files: ['src/**/*.ts', 'src/**/*.tsx'],
		rules: {
			'@typescript-eslint/no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['**/functions/**'],
							allowTypeImports: true,
							message:
								'The page only imports types from functions/, with `import type`. Call the API through the typed client in src/hero/leaderboard.ts.',
						},
					],
				},
			],
		},
	},
	{
		// Astro pages have no business with the Function at all.
		files: ['src/**/*.astro'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['**/functions/**'],
							message:
								'Astro pages don’t import from functions/. The page calls the API through the typed client in src/hero/leaderboard.ts.',
						},
					],
				},
			],
		},
	},
	{
		// The Function runs on Cloudflare, apart from the site, so it never
		// imports the site's code.
		files: ['functions/**/*.ts'],
		rules: {
			'import-x/no-restricted-paths': [
				'error',
				{
					basePath: import.meta.dirname,
					zones: [
						{
							target: './functions',
							from: './src',
							message:
								'functions/ runs on Cloudflare, apart from the site, so it doesn’t import from src/.',
						},
					],
				},
			],
		},
	},
	astro.configs.recommended,
	astro.configs['jsx-a11y-strict'],
	{
		files: ['**/*.ts', '**/*.tsx', '**/*.astro'],
		extends: [tailwind.configs['recommended-error']],
		settings: {
			'better-tailwindcss': {
				entryPoint: 'src/styles/global.css',
			},
		},
		rules: {
			// Prettier wraps lines.
			'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
			// Colours come from the site's palette (src/styles/global.css),
			// so the game looks like the rest of the site, in light and dark
			// mode alike. See "Design" in AGENTS.md.
			'better-tailwindcss/no-restricted-classes': [
				'error',
				{
					restrict: [
						{
							pattern: String.raw`^(?:.+:)?((?:bg|text|border(?:-[xytrblse])?|ring|ring-offset|inset-ring|outline|decoration|divide|caret|accent|fill|stroke|shadow|inset-shadow|drop-shadow|text-shadow|from|via|to|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d+)?(?:\/\d+)?)$`,
							message: `"$1" is one of Tailwind's colours. Use the site's palette instead (paper, surface, ink, muted, line, accent, on-accent, danger, pine, snow, scrim, fog): see "Design" in AGENTS.md.`,
						},
						{
							pattern: String.raw`^(?:.+:)?([a-z-]+-\[[^\]]*(?:#[\da-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\().*)$`,
							message: `"$1" sets its own colour. Use the site's palette instead, adding a token to src/styles/global.css if it really needs a new one: see "Design" in AGENTS.md.`,
						},
					],
				},
			],
		},
	},
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	prettier,
);
