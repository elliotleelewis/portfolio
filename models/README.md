# Models

The game's characters. Each `.glb` here is the source: `pnpm models` gets it ready for the game (compressed, in `src/game/models/`), which loads it before a run. Never edit `src/game/models/` by hand.

So far it's only me: `me.glb`, made by `scripts/models/me.ts`.

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

## How I'm made

I'm modelled in TypeScript, with nothing to install: `pnpm models:me` runs `scripts/models/me.ts`, which builds me from three.js shapes and writes `models/me.glb` with [glTF Transform](https://gltf-transform.dev). Then `pnpm models` gets me ready for the game, and `pnpm shots --grep "me, up close"` takes my portrait, standing and in my star pose, to compare with `main`'s.

The script builds every part of me from paper shapes (faceted balls, prisms, blocks with folded edges, four-sided spikes of hair, and flat cut-outs for my face), in a modeller's axes (Z up, facing −Y), colours them fold by fold from the colours at its top, puts each on the bone it moves with, joins them, and makes my `blink` shape key. To change me, change the script and run it again.

A model that needs more than code can build (sculpting, say) can be made in any 3D program, such as [Blender](https://www.blender.org), and exported to the spec below: the game doesn't care what made it.

## What the game needs of a person

These hold for anyone rigged to the game's humanoid skeleton, however they're made.

### The rest pose

The game turns people from their rest pose, so model them in it:

- Standing on the ground, feet at the origin, facing front (+Z in glTF, −Y in Blender), about 1.9 m tall with hair.
- Arms hanging a little out from the sides, legs straight down.
- In metres, with the scale applied.

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

`_l` is the person's left (screen-right, facing them). Other bones (`spine_01`, `neck_01`, hands, feet, fingers) can be there too, and follow as they're weighted. The bones can lie and roll whichever way the modeller likes: the game turns each joint about the body's own axes, and works out each bone's turn from where its parent now is (`keepUp`). Don't animate them: the game poses people as it plays.

### Materials

Each material is named for its finish: `matte`, `satin`, `gloss`, `metal` or `cast`. The game remakes each one in its finish, like the rest of the world, so roughness and metalness set in a model are ignored. Colours on the vertices and in the material multiply. Each material is a draw call (two, with shadows): in the folded-paper style, one is enough.

### Exporting by hand

The script writes its glTF itself. Exporting a hand-made person from Blender (File › Export › glTF 2.0):

- glTF Binary (`.glb`), the armature and the mesh only, +Y up.
- Data › Mesh: Apply Modifiers, Normals and Vertex Color (Active) on, UVs off.
- Data › Shape Keys and Skinning on; Animation off.
- Data › Armature: Export Deformation Bones Only **off**, or the palms and soles (which skin nothing) are left out.

### What the game checks

The game won't load a person without every bone in the table above, a `blink` shape key, and every material named for its finish. The tests load me the same way, and also check that:

- my hands and feet are where the cartwheel needs them, and my joints turn my bones however I'm posed (`src/game/character.test.ts`)
- I fit inside my drawing budget (`src/game/draw-budget.test.ts`)
