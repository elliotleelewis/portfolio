import { readFileSync } from 'node:fs';
import path from 'node:path';

import { readCharacterModel } from '../character';

// My model, read from disk, as the page fetches it before a run.
const file = readFileSync(path.join(import.meta.dirname, 'me.glb'));
await readCharacterModel(
	file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
);
