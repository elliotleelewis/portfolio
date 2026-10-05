import {
	type FC,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from 'react';
import {
	type Color,
	DirectionalLight,
	HemisphereLight,
	PointLight,
	Vector3,
} from 'three';

import {
	type Atmosphere,
	readAtmosphere,
	setLights,
	setStars,
} from '../atmosphere';
import type { Mirror } from '../direction';
import { disposeObject } from '../easter-eggs';
import { SYSTEM_ORDER } from '../systems';
import { createMountains, createStars } from '../world';

import { useStage, useSystem } from './game-context';

// Where the sun sits relative to what it lights.
const sunOffset = new Vector3(20, 40, 15);
// Where my lantern hangs, above what it lights.
const lanternOffset = new Vector3(0, 5, 0);

const dark = '(prefers-color-scheme: dark)';

/**
 * Whether the site's in dark mode: the theme picked with the theme picker
 * (data-theme on the page), or else the device's.
 * @returns True in dark mode.
 */
const isDark = (): boolean => {
	const { theme } = document.documentElement.dataset;
	return theme === undefined ? matchMedia(dark).matches : theme === 'dark';
};

/**
 * Listens for the site switching between light and dark mode, whether the
 * device switches or a theme's picked.
 * @param onChange - Called when it might have.
 * @returns Stops listening.
 */
const subscribe = (onChange: () => void): (() => void) => {
	const query = matchMedia(dark);
	query.addEventListener('change', onChange);
	const picked = new MutationObserver(onChange);
	picked.observe(document.documentElement, {
		attributeFilter: ['data-theme'],
	});
	return () => {
		query.removeEventListener('change', onChange);
		picked.disconnect();
	};
};

/**
 * The atmosphere from the site's theme: day in light mode, and night in
 * dark mode. It changes with the site's mode, even mid-run.
 * @returns The atmosphere.
 */
const useAtmosphere = (): Atmosphere => {
	const isNight = useSyncExternalStore(subscribe, isDark, () => false);
	return useMemo(() => {
		const style = getComputedStyle(document.documentElement);
		return readAtmosphere(
			(name) => style.getPropertyValue(name),
			isNight ? 'night' : 'day',
		);
	}, [isNight]);
};

interface SkyProps {
	fog: Color;
	// Where the haze starts, and where it hides everything.
	near: number;
	far: number;
}

/**
 * The hazy sky, which everything far off fades into.
 * @param props - Component props.
 * @param props.fog - The haze's colour.
 * @param props.near - Where the haze starts.
 * @param props.far - Where it hides everything.
 * @returns The sky.
 */
const Sky: FC<SkyProps> = ({ fog, near, far }) => (
	<>
		<color attach="background" args={[fog]} />
		<fog attach="fog" args={[fog, near, far]} />
	</>
);

interface LightingProps {
	atmosphere: Atmosphere;
	// How far either side of the focus the sun's shadows reach.
	reach: number;
	// How far the sun's shadows go.
	depth: number;
	/**
	 * Where the light falls, each step.
	 * @param into - Where to put it, in world space.
	 * @returns `into`.
	 */
	focus: (into: Vector3) => Vector3;
	// -1 to put the sun on the other side, for a mirrored scene.
	mirror: Mirror;
}

/**
 * Soft mountain light, and a sun (or moon) that follows the action so its
 * shadows stay sharp where it matters. By night, my lantern lights the way.
 * @param props - Component props.
 * @param props.atmosphere - The atmosphere.
 * @param props.reach - How far either side of the focus shadows reach.
 * @param props.depth - How far the sun's shadows go.
 * @param props.focus - Where the light falls.
 * @param props.mirror - -1 to put the sun on the other side.
 * @returns The lights.
 */
const Lighting: FC<LightingProps> = ({
	atmosphere,
	reach,
	depth,
	focus,
	mirror,
}) => {
	const [offset] = useState(() =>
		sunOffset.clone().setX(sunOffset.x * mirror),
	);
	const sun = useMemo(() => {
		const light = new DirectionalLight();
		light.position.copy(offset);
		light.castShadow = true;
		light.shadow.mapSize.set(2048, 2048);
		const shadow = light.shadow.camera;
		shadow.left = -reach;
		shadow.right = reach;
		shadow.top = reach;
		shadow.bottom = -reach;
		shadow.far = depth;
		light.shadow.bias = -0.0005;
		light.shadow.normalBias = 0.03;
		return light;
	}, [reach, depth, offset]);
	const [sky] = useState(() => new HemisphereLight());
	// No shadows: the moon's are enough, and they'd cost six renders a frame.
	const [lantern] = useState(() => new PointLight(undefined, 0, 30, 1.6));
	const [point] = useState(() => new Vector3());

	useLayoutEffect(() => {
		setLights({ sun, sky, lantern }, atmosphere);
	}, [atmosphere, sun, sky, lantern]);

	useEffect(
		() => () => {
			sun.dispose();
		},
		[sun],
	);

	useEffect(
		() => () => {
			sky.dispose();
			lantern.dispose();
		},
		[sky, lantern],
	);

	useSystem(SYSTEM_ORDER.follow, () => {
		focus(point);
		sun.target.position.copy(point);
		sun.position.copy(point).add(offset);
		lantern.position.copy(point).add(lanternOffset);
	});

	return (
		<>
			<primitive object={sky} />
			<primitive object={sun} />
			<primitive object={sun.target} />
			<primitive object={lantern} />
		</>
	);
};

interface HorizonProps {
	atmosphere: Atmosphere;
}

/**
 * A ring of distant peaks that stays on the horizon, and by night the stars
 * above them.
 * @param props - Component props.
 * @param props.atmosphere - The atmosphere.
 * @returns The horizon.
 */
const Horizon: FC<HorizonProps> = ({ atmosphere }) => {
	const stage = useStage();
	// The peaks fade into the haze, so they're rebuilt when it changes.
	const mountains = useMemo(
		() => createMountains(atmosphere.fog),
		[atmosphere.fog],
	);
	const [stars] = useState(() => createStars(atmosphere.sun));

	useEffect(
		() => () => {
			disposeObject(mountains);
		},
		[mountains],
	);

	useEffect(
		() => () => {
			disposeObject(stars);
		},
		[stars],
	);

	useLayoutEffect(() => {
		setStars(stars, atmosphere);
	}, [atmosphere, stars]);

	useSystem(SYSTEM_ORDER.follow, () => {
		mountains.position.copy(stage.camera.position);
		stars.position.copy(stage.camera.position);
	});

	return (
		<>
			<primitive object={mountains} />
			<primitive object={stars} />
		</>
	);
};

interface Props extends Omit<LightingProps, 'atmosphere'> {
	// Where the haze starts, and where it hides everything.
	near: number;
	far: number;
}

/**
 * Everything around a scene that comes from the site's theme: the sky and
 * haze, the light, and the horizon. Day in light mode, night in dark.
 * @param props - Component props.
 * @param props.near - Where the haze starts.
 * @param props.far - Where it hides everything.
 * @param props.reach - How far either side of the focus shadows reach.
 * @param props.depth - How far the sun's shadows go.
 * @param props.focus - Where the light falls.
 * @param props.mirror - -1 to put the sun on the other side.
 * @returns The surroundings.
 */
export const Surroundings: FC<Props> = ({ near, far, ...lighting }) => {
	const atmosphere = useAtmosphere();
	return (
		<>
			<Sky fog={atmosphere.fog} near={near} far={far} />
			<Lighting atmosphere={atmosphere} {...lighting} />
			<Horizon atmosphere={atmosphere} />
		</>
	);
};
