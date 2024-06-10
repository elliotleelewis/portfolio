const baseExtends = [
	'eslint:recommended',
	'plugin:astro/recommended',
	'plugin:tailwindcss/recommended',
	'plugin:unicorn/recommended',
	'prettier',
];

const basePlugins = ['file-progress', 'import'];

const baseRules = {
	'file-progress/activate': 'warn',
	'import/first': 'error',
	'import/newline-after-import': 'error',
	'import/order': [
		'error',
		{
			alphabetize: {
				order: 'asc',
			},
			'newlines-between': 'always',
		},
	],
	'unicorn/filename-case': 'off',
	'unicorn/prevent-abbreviations': 'off',
};

module.exports = {
	root: true,
	ignorePatterns: ['dist/', '.astro/', 'node_modules/'],
	overrides: [
		{
			files: ['*.astro'],
			parser: 'astro-eslint-parser',
			parserOptions: {
				parser: '@typescript-eslint/parser',
				extraFileExtensions: ['.astro'],
				project: './tsconfig.json',
			},
			processor: 'astro/client-side-ts',
			extends: [
				'plugin:@typescript-eslint/strict',
				'plugin:@typescript-eslint/strict-type-checked',
				'plugin:@typescript-eslint/stylistic',
				'plugin:@typescript-eslint/stylistic-type-checked',
				...baseExtends,
			],
			plugins: basePlugins,
			rules: {
				...baseRules,
				'@typescript-eslint/no-unsafe-return': 'off', // https://github.com/ota-meshi/eslint-plugin-astro/issues/168
			},
		},
		{
			files: ['*.ts'],
			parserOptions: {
				project: './tsconfig.json',
			},
			extends: [
				'plugin:@typescript-eslint/strict',
				'plugin:@typescript-eslint/strict-type-checked',
				'plugin:@typescript-eslint/stylistic',
				'plugin:@typescript-eslint/stylistic-type-checked',
				...baseExtends,
			],
			plugins: basePlugins,
			rules: baseRules,
		},
		{
			files: ['*.js', '*.cjs'],
			parserOptions: {
				ecmaVersion: 'latest',
			},
			env: {
				node: true,
			},
			extends: baseExtends,
			plugins: basePlugins,
			rules: baseRules,
		},
		{
			files: ['*.mjs'],
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
			env: {
				node: true,
			},
			extends: baseExtends,
			plugins: basePlugins,
			rules: baseRules,
		},
	],
};
