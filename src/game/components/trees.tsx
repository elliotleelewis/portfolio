import { createPortal } from '@react-three/fiber';
import { useLayoutEffect, useState } from 'react';

import { Forest } from '../forest';
import { SYSTEM_ORDER } from '../systems';

import { useGame, useSystem } from './game-context';

/**
 * The trees down the mountainside, plus a few framing the opening shot.
 * @returns The trees.
 */
export const Trees = () => {
	const game = useGame();
	const [forest] = useState(() => new Forest(game.forestHooks));

	// Plant them before the first frame, and clear them up after the run.
	useLayoutEffect(() => {
		game.attachForest(forest);
		return () => {
			forest.dispose();
		};
	}, [game, forest]);

	useSystem(SYSTEM_ORDER.trees, (dt) => {
		forest.update(dt, game.player.z);
	});

	return (
		<>
			<primitive object={forest.framing} />
			{createPortal(<primitive object={forest.group} />, game.slope)}
		</>
	);
};
