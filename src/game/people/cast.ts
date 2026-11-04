import type { PersonSpec } from './person';

// Everyone in the game, by how they look (models/README.md, "The style").

// Me, from the hero photo (src/media/hero.webp): short, tousled
// strawberry-blond hair, clear grey rectangular glasses, a big grin, rosy
// cheeks, a grey tee, dark trousers, trail shoes and a grey-green daypack.
export const ME: PersonSpec = {
	seed: 4,
	skin: '#f0c7ad',
	blush: '#e9a08e',
	hair: { colour: '#d8b48e', under: '#bf9671', style: 'spiky' },
	glasses: '#b9b6ae',
	top: { colour: '#8c918a', sleeves: 'short' },
	trousers: '#3f454c',
	shoes: '#6a5440',
	soles: '#2e2925',
	pack: { colour: '#55605a', dark: '#414a45' },
	mouths: ['grin', 'knockedOut'],
};

// The stoker, by the wood stove: a heathered oatmeal beanie over wavy dark
// hair, dark brows, light stubble, a black quarter-zip, a silver chain,
// black joggers, boots and a black backpack. A calm smile, until the stove
// catches and he shouts.
export const STOKER: PersonSpec = {
	seed: 11,
	skin: '#f0c9ae',
	hair: { colour: '#2e1e15', under: '#241710', style: 'wavy' },
	beanie: { colour: '#b3a999', cuff: '#a39886' },
	brows: '#2e1e15',
	stubble: '#d4ab93',
	top: { colour: '#1d1e21', sleeves: 'long', zip: '#6a6c70' },
	chain: '#d9dcdf',
	trousers: '#2b2d31',
	shoes: '#4b3a2c',
	soles: '#1f1a16',
	pack: { colour: '#26272b', dark: '#1c1d20' },
	mouths: ['smile', 'shout'],
};
