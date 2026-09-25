import { createPortal } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { type Mesh, MeshLambertMaterial, type Vector3 } from 'three';

import { disposeObject } from '../easter-eggs';
import { type Game } from '../game';
import { SYSTEM_ORDER } from '../systems';
import {
	CHUNK_LENGTH,
	createGroundChunk,
	createLedge,
	shapeGroundChunk,
} from '../world';

import { GameContext, StageContext, useGame, useSystem } from './game-context';
import { OnSlope } from './on-slope';
import { Lighting, Mountains, Sky } from './scenery';
import { Trees } from './trees';

// Ground chunks leapfrog ahead once they're this far behind me.
const groundRecycleDistance = 30;

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
		const ledge = createLedge(material, 60);
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
export const GameWorld = ({ game }: Props) => {
	// The sun follows me down the mountain.
	const focus = (into: Vector3): Vector3 =>
		game.slope.localToWorld(into.copy(game.player));
	return (
		<StageContext value={game}>
			<GameContext value={game}>
				{createPortal(
					<>
						<Sky near={35} far={240} />
						<Lighting reach={30} depth={120} focus={focus} />
						<Mountains />
						<Ground />
						<Trees />
						<OnSlope object={game.character} />
						<OnSlope object={game.bears} />
						<OnSlope object={game.easterEggs} />
						<OnSlope object={game.effects} />
						<primitive object={game.alertPins} />
					</>,
					game.scene,
				)}
			</GameContext>
		</StageContext>
	);
};
