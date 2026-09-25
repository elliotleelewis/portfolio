import { createPortal } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { type Object3D, type Vector3 } from 'three';

import { type Mirror } from '../direction';
import { disposeObject } from '../easter-eggs';
import { type Gallery } from '../gallery';
import { createGalleryGround, createGalleryTrees } from '../gallery-scenery';

import { StageContext } from './game-context';
import { Lighting, Mountains, Sky } from './scenery';

interface SceneryProps {
	// How many easter eggs are in the row.
	count: number;
	// -1 to mirror it, along with the row.
	mirror: Mirror;
	// Makes the scenery for a row that long.
	create: (count: number) => Object3D;
}

/**
 * Some of the gallery's fixed scenery, freed when it goes.
 * @param props - Component props.
 * @param props.count - How many easter eggs are in the row.
 * @param props.create - Makes the scenery.
 * @param props.mirror - -1 to mirror it.
 * @returns The scenery.
 */
const Scenery = ({ count, create, mirror }: SceneryProps) => {
	const scenery = useMemo(() => {
		const object = create(count);
		// three.js turns mirrored faces back round itself.
		object.scale.x = mirror;
		return object;
	}, [count, create, mirror]);

	useEffect(
		() => () => {
			disposeObject(scenery);
		},
		[scenery],
	);

	return <primitive object={scenery} />;
};

interface Props {
	gallery: Gallery;
}

/**
 * The world around the easter egg gallery: sky, light, mountains, ground and
 * trees, added to the gallery's own scene.
 * @param props - Component props.
 * @param props.gallery - The gallery to build the world for.
 * @returns The world.
 */
export const GalleryWorld = ({ gallery }: Props) => {
	// The sun lights whatever the camera is looking at.
	const focus = (into: Vector3): Vector3 => into.copy(gallery.focus);
	return (
		<StageContext value={gallery}>
			{createPortal(
				<>
					<Sky near={30} far={160} />
					<Lighting
						reach={14}
						depth={90}
						focus={focus}
						mirror={gallery.mirror}
					/>
					<Mountains />
					<Scenery
						count={gallery.count}
						create={createGalleryGround}
						mirror={gallery.mirror}
					/>
					<Scenery
						count={gallery.count}
						create={createGalleryTrees}
						mirror={gallery.mirror}
					/>
				</>,
				gallery.scene,
			)}
		</StageContext>
	);
};
