import { useAtom, useAtomValue } from 'jotai';
import { type FC, useEffect, useState, useSyncExternalStore } from 'react';

import { m } from '../paraglide/messages';

import { MODE_ATOM, PHASE_ATOM, THEME_ATOM, WAITING_ATOM } from './atoms';
import {
	type Device,
	THEMES,
	type Theme,
	applyTheme,
	deviceFor,
	readTheme,
} from './theme';

/**
 * An icon, drawn in the text's colour.
 * @param props - Component props.
 * @param props.children - Its lines.
 * @returns The icon.
 */
const Icon: FC<{ children: React.ReactNode }> = ({ children }) => (
	<svg
		viewBox="0 0 24 24"
		className="size-4.5"
		fill="none"
		stroke="currentColor"
		strokeWidth={2}
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		{children}
	</svg>
);

const sun = (
	<Icon>
		<circle cx="12" cy="12" r="4" />
		<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
	</Icon>
);

const moon = (
	<Icon>
		<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
	</Icon>
);

const devices: Record<Device, React.ReactNode> = {
	laptop: (
		<Icon>
			<rect x="4" y="5" width="16" height="11" rx="1.5" />
			<path d="M2 19h20" />
		</Icon>
	),
	tablet: (
		<Icon>
			<rect x="4" y="2" width="16" height="20" rx="2" />
			<path d="M11 18h2" />
		</Icon>
	),
	phone: (
		<Icon>
			<rect x="7" y="2" width="10" height="20" rx="2" />
			<path d="M11 18h2" />
		</Icon>
	),
};

/**
 * Light, dark, or the device's theme, for the whole site, kept for next
 * time. The device's is shown as the device I'm on: a laptop, a tablet or
 * a phone.
 * @returns The picker.
 */
const Picker: FC = () => {
	const [stored, setTheme] = useAtom(THEME_ATOM);
	const theme = readTheme(stored);
	// Out of the way of a run, where the score sits. The game page's start
	// screen has a game behind it, waiting.
	const mode = useAtomValue(MODE_ATOM);
	const phase = useAtomValue(PHASE_ATOM);
	const isWaiting = useAtomValue(WAITING_ATOM);
	const isRunning = mode === 'game' && phase === 'playing' && !isWaiting;
	const [device] = useState(() =>
		deviceFor(
			matchMedia('(pointer: coarse)').matches,
			Math.min(screen.width, screen.height),
		),
	);

	useEffect(() => {
		applyTheme(theme);
	}, [theme]);

	const options: Record<Theme, { label: string; icon: React.ReactNode }> = {
		light: { label: m.hero_theme_light(), icon: sun },
		dark: { label: m.hero_theme_dark(), icon: moon },
		system: { label: m.hero_theme_system(), icon: devices[device] },
	};

	return (
		<fieldset
			id="hero-theme"
			data-device={device}
			data-hide={isRunning ? '' : undefined}
			className="absolute inset-s-4 top-4 flex gap-0.5 rounded-full bg-surface/70 p-1 text-ink shadow-sm backdrop-blur-sm transition-[opacity,visibility] duration-500 data-hide:invisible data-hide:opacity-0 starting:opacity-0"
		>
			<legend className="sr-only">{m.hero_theme_label()}</legend>
			{THEMES.map((option) => (
				<label
					key={option}
					title={options[option].label}
					className="flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors not-has-checked:hover:bg-surface has-checked:bg-ink has-checked:text-paper has-focus-visible:ring-4 has-focus-visible:ring-accent/70"
				>
					<input
						type="radio"
						name="hero-theme"
						value={option}
						checked={theme === option}
						className="sr-only"
						onChange={() => {
							setTheme(option);
						}}
					/>
					{options[option].icon}
					<span className="sr-only">{options[option].label}</span>
				</label>
			))}
		</fieldset>
	);
};

const stopListening = (): void => {
	// There was nothing to listen for.
};

/**
 * Listens for nothing: whether the page is running never changes.
 * @returns Stops listening.
 */
const subscribe = (): (() => void) => stopListening;

/**
 * The theme picker, once the page is running: what's picked, and the
 * device's icon, are only known in the browser.
 * @returns The picker, in the browser.
 */
export const ThemePicker: FC = () => {
	const isBrowser = useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);
	return isBrowser ? <Picker /> : null;
};
