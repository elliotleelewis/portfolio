# Models

How the game's world is modelled: its art style, and how people are made. Everything is built in TypeScript as the game starts, with nothing to load or install: people by the person builder (`src/game/people/`), and everything else from the shapes and finishes in `src/game/look/`.

## The style: folded paper

Everything in the 3D world (me, the bears, the trees, the easter eggs, the landscape) is made as if folded from coloured paper, to match the site's trail map. Build new things to these rules, and check them against what's there in `pnpm shots`, not against "is this better".

- **Facets, not curves.** Hard, flat facets, as folded paper has. Round things are low-poly: balls are icosahedra of 20 faces (80 for a head), limbs and trunks are prisms of 5 to 7 sides, boxes have their edges folded at most once. No smooth shading, no subdivision.
- **Flat colour per fold.** Each face is one colour, a little lighter or darker (up to 7%) than its paper's, as folds catch the light differently. That variation is painted into the vertex colours, so it costs nothing to draw. No textures.
- **Few papers.** Each thing is made of a handful of colours, each a flat paper: skin, hair, tee, trousers, shoes. Colours come from the world's palette (the site's in `src/styles/global.css` for the scene's light, and each model's own, in its script), and have to read at night under the moon and my lantern.
- **Matte.** Paper is matte: everything is in the `matte` finish, except the odd thing that has to shine (the stove's iron, the Tahoe's paint, glass).
- **No outlines.** Edges show by their facets and their colours alone.
- **Chunky proportions.** People are about four heads tall, with big heads, short limbs and big hands and feet, so they read from the chase camera. Bears and props are just as simplified: their shape at a glance, not their anatomy.
- **Faces cut from paper.** Eyes, mouths, cheeks and glasses are flat shapes stuck on a faceted head: dot eyes, a cut-out grin, round blush, rectangular frames. Never a sculpted face.
- **Likeness from what's recognisable from afar.** A person is recognised by hair (colour and cut), glasses, expression, clothes and what they carry, as you'd recognise them across a field, never by modelling their features. For me, from the hero photo (`src/media/hero.webp`): short, tousled strawberry-blond hair, clear grey rectangular glasses, a big grin, rosy cheeks, ears that stick out a little, a grey tee, dark trousers, brown trail shoes and a grey-green daypack.
- **Stiff paper parts.** Each part moves with one bone, as one: people bend at the joints like paper figures, between separate pieces (an upper arm, an elbow, a forearm), not by stretching.
- **Cheap.** About a thousand triangles a person, in one material: one draw call, two with its shadow. Draw calls are what a phone runs short of.

## How people are made

Everyone in the game, me included, is built by one person builder: `src/game/people/person.ts`. Each person is a `PersonSpec` in `src/game/people/cast.ts`, how they look: skin, hair (colour and cut), a beanie or a cap, brows, stubble, a beard, a moustache or a goatee, glasses, top, a vest, a belt, gloves, trousers or shorts, shoes, a pack, and the faces they pull. The builder makes their paper parts (faceted balls, prisms, blocks with folded edges, four-sided spikes of hair, and flat cut-outs for faces, from `src/game/look/paper.ts`), colours them fold by fold, and puts each on the bone it moves with. To change how someone looks, change their spec.

- **In an easter egg**, a person is `createPerson(spec, personMaterial())`: a joint for each bone, with their parts on it, so they merge and shatter with the rest of their egg.
- **Me**, I'm `personModel(ME, personMaterial())` (`src/game/people/model.ts`): one skinned mesh, each part skinned to its bone, with two shape keys, `blink`, and `knockedOut`, which folds my face away and unfolds the one I wear once a bear gets me (crossed eyes and a wobbly mouth). `createHumanoid` poses it.

`pnpm shots --grep "me, up close"` takes my portrait, standing and in my star pose, to compare with `main`'s.

## What the game needs of a person

These hold for anyone rigged to the game's humanoid skeleton. The builder keeps to them (`BONES` in `person.ts`).

### The rest pose

The game turns people from their rest pose, so model them in it:

- Standing on the ground, feet at the origin, facing front (+Z), about 1.9 m tall with hair.
- Arms hanging a little out from the sides, legs straight down.
- In metres.

### The skeleton

Every person in the game is rigged to the same humanoid skeleton, so the game poses each of them the same way (`createHumanoid` in `src/game/humanoid.ts`): Unreal's mannequin bone names, with a palm and a sole added to each hand and foot. The bones the game turns or reads:

| Bone                       | Where it is                                | What the game does with it                                     |
| -------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `pelvis`                   | The hips. Every other bone is under it.    | Nothing: it moves with all of them.                            |
| `spine_03`                 | The chest.                                 | Bends and twists the chest, which carries the head and arms.   |
| `Head`                     | The top of the neck, where the head turns. | Turns and nods the head.                                       |
| `upperarm_l`, `upperarm_r` | The shoulders.                             | Swings the arms out to the side, right up over the head.       |
| `lowerarm_l`, `lowerarm_r` | The elbows.                                | Bends the elbows.                                              |
| `thigh_l`, `thigh_r`       | The hips.                                  | Swings the legs out to the side, and forward.                  |
| `calf_l`, `calf_r`         | The knees.                                 | Bends the knees.                                               |
| `palm_l`, `palm_r`         | The palms, under the forearms.             | Where the hands touch the ground mid-cartwheel. Skins nothing. |
| `sole_l`, `sole_r`         | The soles, under the shins, on the ground. | Where the feet touch the ground. Skins nothing.                |

`_l` is the person's left (screen-right, facing them). The game turns each joint about the body's own axes, and works out each bone's turn from where its parent now is (`keepUp`), so a model's bones could lie and roll whichever way. Don't animate the bones: the game poses people by their joints as it plays.

### Materials

A person is one material, `personMaterial()`: matte paper, coloured by the vertex colours their folds are painted in. That's one draw call, two with shadows.

### What the tests check

- my hands and feet are where the cartwheel needs them, my joints turn my bones however I'm posed, and I'm my height (`src/game/character.test.ts`)
- I fit inside my drawing budget (`src/game/draw-budget.test.ts`)
- every easter egg's people move only by what it lists in `moving`, and its egg fits inside its budget
