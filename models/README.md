# Models

The game's characters, as modelled in Blender. Each `.glb` here is the source: `pnpm models` gets it ready for the game (compressed, in `src/game/models/`), which loads it before a run. Never edit `src/game/models/` by hand.

So far it's only me: `me.glb`.

## How I'm made

I'm made by a script, in Blender (`scripts/models/blender/me.py`), so I can be changed and made again: run `pnpm models:me` with [Blender](https://www.blender.org/download/) 4.2 on the PATH (or `BLENDER` set to it), which writes `models/me.glb`. Then `pnpm models` gets me ready for the game.

The script starts from a game-ready base, not from scratch: the Superhero male from [Quaternius's Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) (CC0, in `base/quaternius/`, with his buzzed hair and textures). His body is modelled to deform, with the edge loops round his shoulders, elbows and hips that a game character needs, and weighted by hand to a full humanoid skeleton. The script makes him me:

- **The rest pose:** from his T-pose to the game's, my arms down a little out from my sides, made his new rest pose.
- **The skeleton:** his own, the game's humanoid skeleton (below), with `palm_l`, `palm_r`, `sole_l` and `sole_r` added where my hands and feet touch the ground.
- **Slimmer than a superhero:** the flesh round my arms, neck, chest and legs drawn in toward each bone.
- **Colour:** my skin in the game's skin tone, keeping the painted detail of his face (lips, cheeks, shading) from his texture as lighter and darker. His eyes from theirs, and everything else from the palette at the top of the script.
- **Clothes from my own surface:** a tee and walking trousers made from copies of my skin, cut clean along planes (hem, sleeves, cuffs), smoothed of muscle and loosened round each bone, so they hang rather than cling. They keep my weights, so they bend just as I do. The skin under them is taken away, so it can't poke through.
- **Likeness, from the hero photo** (`src/media/hero.webp`): a rounder, softer face than the base's chiselled one (wider cheeks and jaw, a shorter chin, a broader nose tip), ears that stand out a little, eyes narrowed by a smile with my cheeks pushed up under them, grey-blue eyes, a big toothy grin, rosy cheeks and ears, the mole on my cheek, lighter brows, a higher hairline under short, tousled strawberry-blond hair, and rectangular glasses with clear grey frames.
- **The rest of me:** a collar, trail shoes on darker soles (with my feet), spiky tufts on top of his buzzed hair, clear-framed glasses placed from my eyes, and a daypack whose straps follow my shoulders.
- **Light and shade** baked into my colours (Cycles' ambient occlusion), except on my eyes, brows and glasses, which stay clear.
- **Blinking:** a `blink` shape key squashes my eyes and brings my lids down.
- **Previews:** `pnpm models:me -- --preview DIR` renders me from the front, the side, the back, up close and in my star pose into `DIR`, to look at before trying me in the game.

To change me, change the script (its colours are at the top) and run it again.

## Modelling me by hand

I can also be modelled by hand, in Blender, over the script's version: File › Import › glTF 2.0, `models/me.glb`. Keep the armature and its bones (below), skin the mesh to it (Ctrl+P › With Automatic Weights, then paint the weights), colour it on its vertices (a Color Attribute) or in its materials, name each material for its finish, make a `blink` shape key, and export over `models/me.glb` with the settings below. Then `pnpm models`, `pnpm test` and `pnpm shots --grep "me, up close"`.

### Materials

Each material is named for its finish: `matte` (cloth, skin, hair, wood), `satin` (leather, plastic, paint), `gloss` (glass, lenses, car paint), `metal` or `cast` (iron). The game remakes each one in its finish, like the rest of the world, so roughness and metalness set in Blender are only for the preview. Colours on the vertices and in the material multiply. A see-through material sets its Base Color's alpha below 1. Each material is a draw call (two, with shadows), so use as few as you can: three at most. No textures yet.

### The rest pose

The game turns me from my rest pose, so model me in it:

- Standing on the ground, my feet at the origin, facing front (Blender's −Y), about 1.9 m tall.
- My arms hanging a little out from my sides (about 5°), and my legs straight down.
- In metres, with the scale applied (Ctrl+A › All Transforms).

### The skeleton

Every person in the game is rigged to the same humanoid skeleton, so the game poses each of them the same way (`createHumanoid` in `src/game/humanoid.ts`): Unreal's mannequin skeleton, as Quaternius's characters come, with a palm and a sole added to each hand and foot. The bones the game turns or reads:

| Bone                       | Where it is                              | What the game does with it                                    |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `pelvis`                   | My hips. Every other bone is under it.   | Nothing: it moves with all of me.                             |
| `spine_03`                 | My chest.                                | Bends and twists my chest, which carries my head and arms.    |
| `Head`                     | The top of my neck, where my head turns. | Turns and nods my head.                                       |
| `upperarm_l`, `upperarm_r` | My shoulders.                            | Swings my arms out to the side, right up over my head (135°). |
| `lowerarm_l`, `lowerarm_r` | My elbows.                               | Bends my elbows.                                              |
| `thigh_l`, `thigh_r`       | My hips.                                 | Swings my legs out to the side (about 30°), and forward.      |
| `calf_l`, `calf_r`         | My knees.                                | Bends my knees.                                               |
| `palm_l`, `palm_r`         | My palms, under `hand_l` and `hand_r`.   | Where my hands touch the ground mid-cartwheel. Skins nothing. |
| `sole_l`, `sole_r`         | My soles, under `foot_l` and `foot_r`.   | Where my feet touch the ground. Skins nothing.                |

`_l` is my left (screen-right, facing me). The skeleton's other bones (`spine_01`, `spine_02`, `neck_01`, the clavicles, hands, feet and fingers) can be there too, and follow as they're weighted. The bones can lie and roll whichever way Blender likes: the game turns each joint about my body's own axes, and works out each bone's turn from where its parent now is (`keepUp`). Don't animate them in Blender: the game poses me as I play.

### Export settings

- Format: glTF Binary (`.glb`).
- Include: the armature and my mesh only (Limit to Selected Objects, with both selected).
- Transform: +Y Up.
- Data › Mesh: Apply Modifiers, Normals and Vertex Color (Active) on. UVs off, as there are no textures.
- Data › Shape Keys: on.
- Data › Armature: Export Deformation Bones Only **off**, or the palms and soles (which skin nothing) are left out.
- Data › Skinning: on.
- Animation: off.

### What the game checks

The game won't load a model without everything it turns: every bone in the table above, the `blink` shape key, and every material named for its finish. The tests load it the same way, and also check that:

- my hands and feet are where the cartwheel needs them, and my joints turn my bones however I'm posed (`src/game/character.test.ts`)
- I fit inside my drawing budget, 42,000 triangles counting my shadow (`src/game/draw-budget.test.ts`), so about 21,000 triangles in Blender, in at most three materials (draw calls are what a phone runs short of)
