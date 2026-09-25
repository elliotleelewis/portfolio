import { createPortal } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import {
	DirectionalLight,
	type Mesh,
	MeshLambertMaterial,
	Vector3,
} from 'three';

import { disposeObject } from '../easter-eggs';
import { type Game } from '../game';
import { SYSTEM_ORDER } from '../systems';
import {
	CHUNK_LENGTH,
	FOG_COLOR,
	createGroundChunk,
	createMountains,
	shapeGroundChunk,
} from '../world';

import { GameContext, useGame, useSystem } from './game-context';
import { Trees } from './trees';

// Where the sun sits relative to me.
const sunOffset = new Vector3(20, 40, 15);

// Ground chunks leapfrog ahead once they're this far behind me.
const groundRecycleDistance = 30;

/**
 * The hazy sky, which the far slope fades into.
 * @returns The sky.
 */
const Sky = () => (
	<>
		<color attach="background" args={[FOG_COLOR]} />
		<fog attach="fog" args={[FOG_COLOR, 35, 240]} />
	</>
);

/**
 * Soft, overcast mountain light, and a sun that follows me down the
 * mountain so its shadows stay sharp around me.
 * @returns The lights.
 */
const Lighting = () => {
	const game = useGame();
	const [sun] = useState(() => {
		const light = new DirectionalLight('#fff3df', 2.2);
		light.position.copy(sunOffset);
		light.castShadow = true;
		light.shadow.mapSize.set(2048, 2048);
		light.shadow.camera.left = -30;
		light.shadow.camera.right = 30;
		light.shadow.camera.top = 30;
		light.shadow.camera.bottom = -30;
		light.shadow.camera.far = 120;
		light.shadow.bias = -0.0005;
		light.shadow.normalBias = 0.03;
		return light;
	});
	const [focus] = useState(() => new Vector3());

	useEffect(
		() => () => {
			sun.dispose();
		},
		[sun],
	);

	useSystem(SYSTEM_ORDER.follow, () => {
		game.slope.localToWorld(focus.copy(game.player));
		sun.target.position.copy(focus);
		sun.position.copy(focus).add(sunOffset);
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
const Mountains = () => {
	const game = useGame();
	const [mountains] = useState(() => createMountains(FOG_COLOR));

	useEffect(
		() => () => {
			disposeObject(mountains);
		},
		[mountains],
	);

	useSystem(SYSTEM_ORDER.follow, () => {
		mountains.position.copy(game.camera.position);
	});

	return <primitive object={mountains} />;
};

interface GroundPieces {
	// The flat ledge I start on.
	ledge: Mesh;
	// Strips of mountainside that leapfrog each other as I roll.
	chunks: Mesh[];
}

/**
 * The ground: a flat ledge to start on, then the mountainside.
 * @returns The ground.
 */
const Ground = () => {
	const game = useGame();
	const ground = useMemo((): GroundPieces => {
		const material = new MeshLambertMaterial({
			vertexColors: true,
			flatShading: true,
		});
		const ledge = createGroundChunk(material, 60);
		shapeGroundChunk(ledge, 30);
		const chunks = Array.from({ length: 3 }, (_value, i) => {
			const chunk = createGroundChunk(material);
			shapeGroundChunk(chunk, -CHUNK_LENGTH / 2 - i * CHUNK_LENGTH);
			return chunk;
		});
		return { ledge, chunks };
	}, []);

	useEffect(
		() => () => {
			disposeObject(ground.ledge);
			for (const chunk of ground.chunks) {
				disposeObject(chunk);
			}
		},
		[ground],
	);

	useSystem(SYSTEM_ORDER.follow, () => {
		const playerZ = game.player.z;
		for (const chunk of ground.chunks) {
			// A loop, not an if, so it keeps up even after a big jump.
			while (
				chunk.position.z - CHUNK_LENGTH / 2 >
				playerZ + groundRecycleDistance
			) {
				shapeGroundChunk(chunk, chunk.position.z - CHUNK_LENGTH * 3);
			}
		}
	});

	return (
		<>
			<primitive object={ground.ledge} />
			{createPortal(
				<>
					{ground.chunks.map((chunk) => (
						<primitive key={chunk.uuid} object={chunk} />
					))}
				</>,
				game.slope,
			)}
		</>
	);
};

interface Props {
	game: Game;
}

/**
 * The world around the game: sky, light, mountains and ground, added to the
 * game's own scene.
 * @param props - Component props.
 * @param props.game - The game to build the world for.
 * @returns The world.
 */
export const GameWorld = ({ game }: Props) => (
	<GameContext value={game}>
		{createPortal(
			<>
				<Sky />
				<Lighting />
				<Mountains />
				<Ground />
				<Trees />
			</>,
			game.scene,
		)}
	</GameContext>
);
