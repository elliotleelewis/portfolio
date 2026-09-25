import { defineConfig, devices } from '@playwright/test';

const isCi = Boolean(process.env.CI);

// WebGL runs on the CPU in headless Chromium. An existing Chromium can be
// used instead of Playwright's own with PLAYWRIGHT_CHROMIUM_EXECUTABLE.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const launchOptions = {
	args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
	...(executablePath && { executablePath }),
};

export default defineConfig({
	testDir: 'e2e',
	// Software WebGL is slow; the game tests fast-forward, but still take time.
	timeout: 90_000,
	expect: { timeout: 15_000 },
	workers: isCi ? 2 : undefined,
	forbidOnly: isCi,
	reporter: isCi ? [['github'], ['list']] : 'list',
	use: {
		baseURL: 'http://localhost:4321',
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'desktop',
			use: { ...devices['Desktop Chrome'], launchOptions },
		},
		{
			name: 'mobile',
			use: { ...devices['Pixel 7'], launchOptions },
		},
	],
	// The dev server, which exposes a test handle on the game.
	webServer: {
		command: 'astro dev --port 4321',
		url: 'http://localhost:4321',
		reuseExistingServer: !isCi,
		timeout: 120_000,
		// Astro backgrounds the dev server when it detects an AI agent, which
		// Playwright would take as the server exiting. This keeps it in the
		// foreground.
		env: {
			// eslint-disable-next-line @typescript-eslint/naming-convention -- Astro's own variable.
			ASTRO_DEV_BACKGROUND: '1',
		},
	},
});
