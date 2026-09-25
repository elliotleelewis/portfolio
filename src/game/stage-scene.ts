import type { Camera, Scene, WebGLRenderer } from 'three';

/**
 * Something the hero's stage draws: the game or the easter egg gallery. The
 * stage owns the renderer and the frame loop; a scene steps and is drawn.
 */
export interface StageScene {
	readonly scene: Scene;
	readonly camera: Camera;
	// Called once, before the first frame, with the renderer that draws it.
	prepare?: (renderer: WebGLRenderer) => void;
	resize: (width: number, height: number) => void;
	step: (dt: number) => void;
	dispose: () => void;
}
