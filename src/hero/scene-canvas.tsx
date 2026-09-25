import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';

import { GalleryWorld } from '../game/components/gallery-world';
import { GameWorld } from '../game/components/world';
import { RENDER_PRIORITY, STEP_PRIORITY } from '../game/frame-order';
import type { StageScene } from '../game/stage-scene';

import type { ShownScene } from './atoms';

// The longest step, so a pause (like a hidden tab) doesn't lurch the scene.
const maxStep = 1 / 20;

interface FrameProps {
	scene: StageScene;
	onFirstFrame: (scene: StageScene) => void;
}

const Frame = ({ scene, onFirstFrame }: FrameProps) => {
	const prepared = useRef<StageScene | undefined>(undefined);
	const drawn = useRef<StageScene | undefined>(undefined);
	const fittedSize = useRef('');

	// First, move the scene on.
	useFrame(({ gl, size }, delta) => {
		if (prepared.current !== scene) {
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
	}, STEP_PRIORITY);

	// Last, once everything that follows it has caught up, draw it.
	useFrame(({ gl }) => {
		gl.render(scene.scene, scene.camera);
		if (drawn.current === scene) {
			return;
		}
		drawn.current = scene;
		onFirstFrame(scene);
	}, RENDER_PRIORITY);

	return null;
};

interface Props {
	shown: ShownScene;
	// A scene has been drawn for the first time.
	onFirstFrame: (scene: StageScene) => void;
}

/**
 * The WebGL canvas the hero's scenes draw into.
 * @param props - Component props.
 * @param props.shown - The scene to show.
 * @param props.onFirstFrame - Called once a scene has first been drawn.
 * @returns The canvas.
 */
export const SceneCanvas = ({ shown, onFirstFrame }: Props) => (
	// `flat` keeps three's default (no) tone mapping, and "percentage" is its
	// PCF shadow map, so the scenes look as they were designed.
	<Canvas flat shadows="percentage" dpr={[1, 2]}>
		<Frame scene={shown.scene} onFirstFrame={onFirstFrame} />
		{/* A fresh world for each scene. */}
		{shown.kind === 'game' ? (
			<GameWorld key={shown.scene.scene.uuid} game={shown.scene} />
		) : (
			<GalleryWorld key={shown.scene.scene.uuid} gallery={shown.scene} />
		)}
	</Canvas>
);
