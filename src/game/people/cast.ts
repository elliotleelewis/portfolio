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

// The outhouse's occupant: slicked-back dark hair down to his collar, thick
// brows, stubble and a huge grin, a navy half-zip windbreaker with white
// piping and a teal collar, open over a grey tee and a silver chain, dark
// trousers and white trainers. And white gloves, their fingertips brown.
export const OCCUPANT: PersonSpec = {
	seed: 23,
	skin: '#d7a17c',
	hair: { colour: '#2a1c15', under: '#211611', style: 'slicked' },
	brows: '#211611',
	stubble: '#b7876a',
	top: {
		colour: '#1e2a4c',
		sleeves: 'long',
		zip: '#e9ecef',
		collar: '#3f6d77',
		piping: '#e9ecef',
		under: '#8b8e8d',
	},
	gloves: { colour: '#f6f6f3', tips: '#5b3a1d' },
	chain: '#d9dcdf',
	trousers: '#34373d',
	shoes: '#eeeeec',
	soles: '#bdbdb8',
	mouths: ['grin'],
};

// The jailbreak's prisoner: short dark hair, spiky at the front, a full dark
// beard and a grin, a maroon hooded long-sleeve, khakis and grey trainers.
// (The officer's taken his backpack.)
export const PRISONER: PersonSpec = {
	seed: 31,
	skin: '#cf9a74',
	hair: { colour: '#1c1411', under: '#1c1411', style: 'crop' },
	brows: '#1c1411',
	beard: '#1f1612',
	moustache: '#1f1612',
	top: { colour: '#6b1f2c', sleeves: 'long', hood: true },
	trousers: '#b8a68b',
	shoes: '#3b3b3e',
	soles: '#262629',
	mouths: ['grin'],
};

// The police officer after him: a navy uniform, a hi-vis vest, a duty belt,
// a peaked cap with a chequered band, and a big moustache.
export const OFFICER: PersonSpec = {
	seed: 37,
	skin: '#efc3a2',
	hair: { colour: '#6b4a33', under: '#5a3d2a', style: 'short' },
	brows: '#6b4a33',
	moustache: '#6b4a33',
	cap: {
		colour: '#18233b',
		band: ['#f2f2f2', '#111111'],
		peak: '#0e0e10',
		badge: '#d9b84a',
	},
	top: { colour: '#1d2a44', sleeves: 'long' },
	vest: { colour: '#c9e23a', stripes: '#dfe3e6' },
	belt: '#0e0e10',
	trousers: '#15181f',
	shoes: '#0d0d0d',
	soles: '#050505',
	mouths: ['smile'],
};
