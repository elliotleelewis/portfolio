import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';

import { type StageScene } from '../game/stage-scene';

// The longest step, so a pause (like a hidden tab) doesn't lurch the scene.
const maxStep = 1 / 20;

interface Props {
	scene: StageScene;
	// The scene has been drawn for the first time.
	onFirstFrame: (scene: StageScene) => void;
}

const Frame = ({ scene, onFirstFrame }: Props) => {
	const prepared = useRef<StageScene | undefined>(undefined);
	const fittedSize = useRef('');

	// Steps and draws the scene each frame (priority 1 takes over rendering).
	useFrame(({ gl, size }, delta) => {
		const isFirstFrame = prepared.current !== scene;
		if (isFirstFrame) {
			scene.prepare?.(gl);
			prepared.current = scene;
			fittedSize.current = '';
		}
		const sizeKey = `${String(size.width)}×${String(size.height)}`;
		if (sizeKey !== fittedSize.current) {
			scene.resize(size.width, size.height);
			fittedSize.current = sizeKey;
		}
		scene.step(Math.min(delta, maxStep));
		gl.render(scene.scene, scene.camera);
		if (isFirstFrame) {
			onFirstFrame(scene);
		}
	}, 1);

	return null;
};

/**
 * The WebGL canvas the hero's scenes draw into.
 * @param props - Component props.
 * @param props.scene - The scene to show.
 * @param props.onFirstFrame - Called once a scene has first been drawn.
 * @returns The canvas.
 */
export const SceneCanvas = ({ scene, onFirstFrame }: Props) => (
	// `flat` keeps three's default (no) tone mapping, and "percentage" is its
	// PCF shadow map, so the scenes look as they were designed.
	<Canvas flat shadows="percentage" dpr={[1, 2]}>
		<Frame scene={scene} onFirstFrame={onFirstFrame} />
	</Canvas>
);
