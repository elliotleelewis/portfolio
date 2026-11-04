# Models

The game's characters, as modelled in Blender. Each `.glb` here is the source: `pnpm models` gets it ready for the game (compressed, in `src/game/models/`), which loads it before a run. Never edit `src/game/models/` by hand.

So far it's only me: `me.glb`.

## How I'm made

I'm made by a script, in Blender (`scripts/models/blender/me.py`), so I can be changed and made again: run `pnpm models:me` with [Blender](https://www.blender.org/download/) 4.2 on the PATH (or `BLENDER` set to it), which writes `models/me.glb`. Then `pnpm models` gets me ready for the game.

The script starts from a game-ready base, not from scratch: the Superhero male from [Quaternius's Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) (CC0, in `base/quaternius/`, with his buzzed hair and textures). His body is modelled to deform, with the edge loops round his shoulders, elbows and hips that a game character needs, and weighted by hand to a full humanoid skeleton. The script makes him me:

- **The rest pose:** from his T-pose to the game's, my arms down a little out from my sides, made his new rest pose.
- **The skeleton:** the bones the game turns renamed to its names (`pelvis` is `body`, `upperarm_l` is `arm.L`, `thigh_l` is `leg.L`, and so on), and `hand` and `foot` added at my palms and soles. His other bones (spine, clavicles, elbows, knees, fingers) come too, posed as they are.
- **Slimmer than a superhero:** the flesh round my arms, neck, chest and legs drawn in toward each bone.
- **Colour:** my skin in the game's skin tone, keeping the painted detail of his face (lips, cheeks, shading) from his texture as lighter and darker. His eyes from theirs, and everything else from the palette at the top of the script.
- **Clothes from my own surface:** a tee and walking trousers made from copies of my skin, cut clean along planes (hem, sleeves, cuffs), smoothed of muscle and loosened round each bone, so they hang rather than cling. They keep my weights, so they bend just as I do. The skin under them is taken away, so it can't poke through.
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

| Bone               | Where it is                              | What the game does with it                                        |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------- |
| `body`             | My hips. Every other bone is under it.   | Nothing: it moves with all of me.                                 |
| `head`             | The top of my neck, where my head turns. | Turns and nods my head.                                           |
| `arm.L`, `arm.R`   | My shoulders.                            | Swings my arms out to the side, right up over my head (135°).     |
| `leg.L`, `leg.R`   | My hips.                                 | Swings my legs out to the side (about 30°), and a little forward. |
| `hand.L`, `hand.R` | My palms, under `arm.L` and `arm.R`.     | Where my hands touch the ground mid-cartwheel.                    |
| `foot.L`, `foot.R` | My soles, under `leg.L` and `leg.R`.     | Where my feet touch the ground.                                   |

`.L` is my left (screen-right, facing me). The bones can lie and roll whichever way Blender likes: the game turns each about my body's own axes, whatever its own are (`keepUp` in `src/game/character.ts`). Don't animate them in Blender: the game poses me as I play.

### Export settings

- Format: glTF Binary (`.glb`).
- Include: the armature and my mesh only (Limit to Selected Objects, with both selected).
- Transform: +Y Up.
- Data › Mesh: Apply Modifiers, Normals and Vertex Color (Active) on. UVs off, as there are no textures.
- Data › Shape Keys: on.
- Data › Armature: Export Deformation Bones Only **off**, or `hand` and `foot` (which skin nothing) are left out.
- Data › Skinning: on.
- Animation: off.

### What the game checks

The game won't load a model without everything it turns: every bone above, the `blink` shape key, and every material named for its finish. The tests load it the same way, and also check that:

- my hands and feet are where the cartwheel needs them, and my joints turn my bones however I'm posed (`src/game/character.test.ts`)
- I fit inside my drawing budget, 36,000 triangles counting my shadow (`src/game/draw-budget.test.ts`), so about 18,000 triangles in Blender, in at most three materials (draw calls are what a phone runs short of)
