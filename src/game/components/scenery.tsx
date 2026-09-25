import { useEffect, useMemo, useState } from 'react';
import { DirectionalLight, Vector3 } from 'three';

import { type Mirror } from '../direction';
import { disposeObject } from '../easter-eggs';
import { SYSTEM_ORDER } from '../systems';
import { FOG_COLOR, createMountains } from '../world';

import { useStage, useSystem } from './game-context';

// Where the sun sits relative to what it lights.
const sunOffset = new Vector3(20, 40, 15);

interface SkyProps {
	// Where the haze starts, and where it hides everything.
	near: number;
	far: number;
}

/**
 * The hazy sky, which everything far off fades into.
 * @param props - Component props.
 * @param props.near - Where the haze starts.
 * @param props.far - Where it hides everything.
 * @returns The sky.
 */
export const Sky = ({ near, far }: SkyProps) => (
	<>
		<color attach="background" args={[FOG_COLOR]} />
		<fog attach="fog" args={[FOG_COLOR, near, far]} />
	</>
);

interface LightingProps {
	// How far either side of the focus the sun's shadows reach.
	reach: number;
	// How far the sun's shadows go.
	depth: number;
	/**
	 * Where the sun shines on, each step.
	 * @param into - Where to put it, in world space.
	 * @returns `into`.
	 */
	focus: (into: Vector3) => Vector3;
	// -1 to put the sun on the other side, for a mirrored scene.
	mirror: Mirror;
}

/**
 * Soft, overcast mountain light, and a sun that follows the action so its
 * shadows stay sharp where it matters.
 * @param props - Component props.
 * @param props.reach - How far either side of the focus shadows reach.
 * @param props.depth - How far the sun's shadows go.
 * @param props.focus - Where the sun shines on.
 * @param props.mirror - -1 to put the sun on the other side.
 * @returns The lights.
 */
export const Lighting = ({ reach, depth, focus, mirror }: LightingProps) => {
	const [offset] = useState(() =>
		sunOffset.clone().setX(sunOffset.x * mirror),
	);
	const sun = useMemo(() => {
		const light = new DirectionalLight('#fff3df', 2.2);
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
	const [point] = useState(() => new Vector3());

	useEffect(
		() => () => {
			sun.dispose();
		},
		[sun],
	);

	useSystem(SYSTEM_ORDER.follow, () => {
		focus(point);
		sun.target.position.copy(point);
		sun.position.copy(point).add(offset);
	});

	return (
		<>
			<hemisphereLight args={['#f4f7f9', '#4f5f3c', 2.1]} />
			<primitive object={sun} />
			<primitive object={sun.target} />
		</>
	);
};

/**
 * A ring of distant peaks that stays on the horizon.
 * @returns The mountains.
 */
export const Mountains = () => {
	const stage = useStage();
	const [mountains] = useState(() => createMountains(FOG_COLOR));

	useEffect(
		() => () => {
			disposeObject(mountains);
		},
		[mountains],
	);

	useSystem(SYSTEM_ORDER.follow, () => {
		mountains.position.copy(stage.camera.position);
	});

	return <primitive object={mountains} />;
};
