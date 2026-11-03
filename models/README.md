# Models

The game's characters, as modelled in Blender. Each `.glb` here is the source: `pnpm models` gets it ready for the game (compressed, in `src/game/models/`), which loads it before a run. Never edit `src/game/models/` by hand.

So far it's only me: `me.glb`.

## Modelling me

1. **Open the template.** In Blender, File › Import › glTF 2.0, and pick `models/me.glb`. It's me as the game draws me now, already skinned to the skeleton the game turns. Model over it, or replace the mesh altogether.
2. **Keep the skeleton.** Keep the armature, its bones and their names (below). Move a bone if its joint should be somewhere else. Extra bones are fine (a spine, elbows, fingers), but the game only turns the ones below for now.
3. **Skin to it.** Parent the mesh to the armature (Ctrl+P › With Automatic Weights), then paint the weights so my shoulders, hips and neck bend smoothly. Up to four bones per vertex.
4. **Colour it.** Paint colours on the vertices (a Color Attribute), or give each material a Base Color, or both (they multiply). No textures yet.
5. **Name each material for its finish:** `matte` (cloth, skin, hair, wood), `satin` (leather, plastic, paint), `gloss` (glass, lenses, car paint), `metal` or `cast` (iron). The game remakes each material in its finish, like the rest of the world, so roughness and metalness set in Blender are only for the preview. A see-through material sets its Base Color's alpha below 1. Each material is a draw call (two, with shadows), so use as few as you can: three at most.
6. **Make a `blink` shape key** that shuts my eyes, from the Basis with them open.
7. **Export:** File › Export › glTF 2.0, as `models/me.glb` (replacing the template). See the settings below.
8. **Get it ready:** `pnpm models`. Then `pnpm test`, which checks it (below), and `pnpm shots --grep "me, up close"` for my portrait, to compare with `main`'s in `shots/out/compare.html`.

To start again from the template, `pnpm models:template` writes it back to `models/me.glb`, from the procedural version of me in `scripts/models/me.ts`.

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
- I fit inside my drawing budget, 22,000 triangles counting my shadow (`src/game/draw-budget.test.ts`), so about 10,000 triangles in Blender
