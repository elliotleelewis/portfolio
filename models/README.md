# Models

The game's characters, as modelled in Blender. Each `.glb` here is the source: `pnpm models` gets it ready for the game (compressed, in `src/game/models/`), which loads it before a run. Never edit `src/game/models/` by hand.

So far it's only me: `me.glb`.

## How I'm made

I'm modelled by a script, in Blender (`scripts/models/blender/me.py`), so I can be changed and made again: run `pnpm models:me` with [Blender](https://www.blender.org/download/) 4.2 on the PATH (or `BLENDER` set to it), which writes `models/me.glb`. Then `pnpm models` gets me ready for the game.

The script builds me from scratch:

- **My body** is one continuous skin over a stick skeleton (Blender's Skin modifier, then smoothed), from my neck down to my ankles and fingertips, coloured by what I'm wearing.
- **My head** is shaped from a sphere: a jaw narrowing to my chin, a brow and full cheeks. My eyes, brows, nose, grin and glasses are placed on it by casting rays at its surface.
- **My hair** is a close crop and tufts swept up and back, with a quiff, darker at the roots.
- **My clothes:** the tee's collar and hem, trail shoes on darker soles, and a daypack with a lid, a pocket and straps that follow my shoulders.
- **Light and shade** are baked into my colours: Cycles' ambient occlusion darkens where parts of me shade each other (under my arms and chin, where my clothes meet), so the game gets the depth for nothing. What's painted on my face is left unshaded, so it stays clear.
- **Skinning:** my body bends where Blender's heat weighting says, smoothly from bone to bone at my shoulders, hips and neck. Everything else moves with one bone, as one.
- **Previews:** `pnpm models:me -- --preview DIR` renders me from the front, the side, the back, up close and in my star pose into `DIR`, to look at before trying me in the game.

To change me, change the script (its colours are at the top) and run it again. Whatever made me, the game only needs what's below.

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
- I fit inside my drawing budget, 16,000 triangles counting my shadow (`src/game/draw-budget.test.ts`), so about 8,000 triangles in Blender
