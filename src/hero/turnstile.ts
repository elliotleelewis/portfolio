// Cloudflare Turnstile, which checks that a person (not a bot) is saving a
// score. It's only loaded when there's a score to save.

// Cloudflare's test key, which always passes, for development and tests.
const testSiteKey = '1x00000000000000000000AA';
const scriptUrl =
	'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileOptions {
	sitekey: string;
	action: string;
	appearance: 'always' | 'execute' | 'interaction-only';
	callback: (token: string) => void;
	// eslint-disable-next-line @typescript-eslint/naming-convention -- Turnstile's name for it.
	'expired-callback': () => void;
	// eslint-disable-next-line @typescript-eslint/naming-convention -- Turnstile's name for it.
	'error-callback': () => void;
}

// The parts of Turnstile's API the page uses.
export interface Turnstile {
	render: (container: HTMLElement, options: TurnstileOptions) => string;
	remove: (id: string) => void;
}

// The script, once it's been asked for.
const script: { loading?: Promise<Turnstile> } = {};

const isTurnstile = (value: unknown): value is Turnstile =>
	typeof value === 'object' &&
	value !== null &&
	'render' in value &&
	typeof value.render === 'function' &&
	'remove' in value &&
	typeof value.remove === 'function';

/**
 * The site key for the Turnstile widget.
 * @returns The key set for the build, or Cloudflare's test key.
 */
export const siteKey = (): string => {
	// An empty string where the build's variable isn't set.
	const key = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;
	return key === undefined || key === '' ? testSiteKey : key;
};

const load = async (): Promise<Turnstile> => {
	const element = document.createElement('script');
	element.src = scriptUrl;
	element.async = true;
	const isLoaded = await new Promise<boolean>((resolve) => {
		element.addEventListener('load', () => {
			resolve(true);
		});
		element.addEventListener('error', () => {
			resolve(false);
		});
		document.head.append(element);
	});
	const turnstile: unknown = Reflect.get(globalThis, 'turnstile');
	if (!isLoaded || !isTurnstile(turnstile)) {
		element.remove();
		throw new Error('Turnstile failed to load');
	}
	return turnstile;
};

/**
 * Loads Turnstile's script, once.
 * @returns Turnstile, once it's ready.
 */
export const loadTurnstile = async (): Promise<Turnstile> => {
	script.loading ??= load();
	try {
		return await script.loading;
	} catch (error) {
		// Let the next score try again.
		script.loading = undefined;
		throw error;
	}
};
