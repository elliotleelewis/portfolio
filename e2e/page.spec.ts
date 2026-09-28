import { expect, test } from './fixtures';

test('shows the intro and every section', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Elliot Lewis.',
	);
	for (const title of [
		'Where I’ve worked',
		'What I carry',
		'Where it started',
	]) {
		await expect(page.getByRole('heading', { name: title })).toBeVisible();
	}
});

test('opens social links in a new tab', async ({ page }) => {
	await page.goto('/');
	const links = page
		.getByRole('list', { name: 'Find me elsewhere' })
		.getByRole('link');
	await expect(links).not.toHaveCount(0);
	const all = await links.all();
	for (const link of all) {
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', /noopener/);
	}
});

test('has icons for tabs and home screens', async ({ page, request }) => {
	await page.goto('/');
	for (const selector of [
		'link[rel="icon"]',
		'link[rel="apple-touch-icon"]',
	]) {
		const href = await page.locator(selector).getAttribute('href');
		expect(href).toBeTruthy();
		const response = await request.get(href ?? '');
		expect(response.ok()).toBe(true);
	}
});

test('loads without errors', async ({ page }) => {
	// The fixture fails the test on any uncaught error.
	await page.goto('/');
	await page.waitForLoadState('networkidle');
});

test('loads a sharp enough photo for how big it is drawn', async ({ page }) => {
	await page.goto('/');
	const photo = page.locator('#hero img');
	await expect(photo).toHaveJSProperty('complete', true);
	const picked = await photo.evaluate((element) => {
		if (!(element instanceof HTMLImageElement)) {
			throw new TypeError('Expected the photo');
		}
		// Every candidate the page offers, and the one the browser chose.
		const candidates = [
			...(element.parentElement?.querySelectorAll('source') ?? []),
			element,
		].flatMap((node) =>
			(node.getAttribute('srcset') ?? '').split(', ').map((entry) => {
				const [url = '', width = '0w'] = entry.split(' ', 2);
				return {
					url: new URL(url, location.href).href,
					// "1280w" and the like.
					width: Number(width.slice(0, -1)),
				};
			}),
		);
		const chosen = candidates.find(({ url }) => url === element.currentSrc);
		const box = element.getBoundingClientRect();
		// The photo covers the hero, so it's drawn at least as wide as it is.
		const shape = element.naturalWidth / element.naturalHeight;
		const drawn = Math.max(box.width, box.height * shape);
		return {
			url: element.currentSrc,
			width: chosen?.width ?? 0,
			needed: Math.ceil(drawn * devicePixelRatio),
			largest: Math.max(...candidates.map(({ width }) => width)),
		};
	});
	expect(picked.url).toMatch(/avif/);
	// As many pixels as it's drawn with, or the most there are.
	expect(picked.width).toBeGreaterThanOrEqual(
		Math.min(picked.needed, picked.largest),
	);
});

test('answers paths that are not on the site with a 404 page', async ({
	page,
}) => {
	// Crawlers and agents look for files like these. They should hear "not
	// found", not get the home page.
	for (const path of ['/ai-catalog.json', '/no-such-page']) {
		const response = await page.goto(path);
		expect(response?.status()).toBe(404);
		await expect(
			page.getByRole('heading', { level: 1, name: 'Off the trail.' }),
		).toBeVisible();
	}
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
		'content',
		'noindex',
	);
	await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
	await page.getByRole('link', { name: 'Back to the trailhead' }).click();
	await expect(page).toHaveURL('/');
});

test('describes the site for AI agents in llms.txt', async ({ request }) => {
	const response = await request.get('/llms.txt');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toMatch(/^text\/plain/);
	const text = await response.text();
	// The llmstxt.org layout: a title, then a one-line summary.
	const [title, , summary] = text.split('\n', 3);
	expect(title).toBe('# Elliot Lewis');
	expect(summary).toMatch(/^> /);
	// Every page of this site it links to is there.
	const pages = text
		.matchAll(/\]\((https:\/\/elliotleelewis\.com[^)]*)\)/g)
		.map(([, url = '']) => new URL(url).pathname)
		.toArray();
	expect(pages).toEqual(['/', '/game']);
	for (const path of pages) {
		const page = await request.get(path);
		expect(page.status()).toBe(200);
	}
});

test('loads each font, in the styles each page uses', async ({ page }) => {
	// The build downloads the fonts from Google Fonts, and carries on without
	// them if that fails. The page would then quietly fall back to system
	// fonts.
	const loaded = async (): Promise<string[]> =>
		page.evaluate(async () => {
			const { fonts } = globalThis.document;
			await fonts.ready;
			return (
				[...fonts]
					// Astro names each family with a hash on the end, and adds
					// fallbacks sized to match.
					.filter(
						({ family, status }) =>
							status === 'loaded' && !family.includes('fallback'),
					)
					.map(
						({ family, weight, style }) =>
							`${family.replaceAll('"', '').replace(/-\w+$/, '')} ${weight} ${style}`,
					)
					.toSorted((a, b) => a.localeCompare(b))
			);
		});
	await page.goto('/');
	expect(await loaded()).toEqual([
		'Fraunces 400 italic',
		'Fraunces 600 normal',
		'Inter 400 900 normal',
		'JetBrains Mono 400 normal',
	]);
	await page.goto('/game');
	expect(await loaded()).toEqual([
		'Fraunces 600 normal',
		'Inter 400 900 normal',
		'JetBrains Mono 400 normal',
	]);
});
