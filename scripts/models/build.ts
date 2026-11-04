// Gets the models ready for the game (`pnpm models`): each one in models/,
// however it was made, is tidied, compressed and written to
// src/game/models/, which the game loads. See models/README.md.
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const from = path.join(import.meta.dirname, '../../models');
const to = path.join(import.meta.dirname, '../../src/game/models');

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
	.registerExtensions(ALL_EXTENSIONS)
	.registerDependencies({
		'meshopt.decoder': MeshoptDecoder,
		'meshopt.encoder': MeshoptEncoder,
	});

const files = readdirSync(from).filter((name) => name.endsWith('.glb'));
for (const file of files) {
	const document = await io.read(path.join(from, file));
	await document.transform(
		// Only what's drawn, each piece of data once, and each vertex once.
		prune(),
		dedup(),
		weld(),
		// Squeezed into fewer bytes, which the game unpacks as it loads.
		meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
	);
	await io.write(path.join(to, file), document);
	console.log(`${file}: ready for the game`);
}
