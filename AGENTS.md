# Working in this repo

Guidance for AI agents (and anyone else) making changes here. Start with [README.md](README.md) for what the site is and how it's laid out.

## Before you say you're done

Run all of these. CI runs the same checks, and a red build blocks the merge.

```sh
pnpm lint
pnpm format
pnpm test
pnpm build
pnpm test:e2e
```

- **Check `pnpm lint` by its exit code, not by scanning the output.** When imports are out of order, the `import/order` rule crashes with `TypeError: sourceCode.getTokenOrCommentBefore is not a function`. The crash hides every other error in the file. See [Imports](#imports).
- `pnpm lint:fix` and `pnpm format:fix` fix most style problems, including Tailwind class order.
- The end-to-end tests start their own dev server. If Playwright's own browser isn't installed, point `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at a Chromium you have.
- For changes to the game or the page's look, also look at the result in a browser. The tests can't tell you whether it looks right.

## Code style

ESLint enforces most of this, with strict TypeScript, unicorn, jsdoc, jsx-a11y and Tailwind rules. Prettier handles formatting: tabs, single quotes, trailing commas.

- **Names:**
  - Most things are `camelCase` and types are `PascalCase`.
  - Exported constants are `UPPER_CASE`, but exported functions are `camelCase`.
  - Private members start with `_`, like `_player`.
- **Comments and docs:** functions need JSDoc with `@param` and `@returns`. Game code is written in the first person, from the player's side ("where I am", "a bear got me"), and comments say why rather than what. Match the surrounding code.
- **Type assertions:** avoid `as` and non-null `!`. Narrow the type, or restructure the code, instead.
- **Tailwind:**
  - Use the canonical class names the linter asks for, like `inset-s-4` rather than `start-4`.
  - Use logical classes for anything to the side (`ps`/`pe`, `inset-s`/`inset-e`, `border-s`), never `left`/`right`, so the page mirrors for right-to-left languages.

### Imports

Imports go in groups separated by a blank line: packages first, then parent paths (`../`), then siblings (`./`). Within each group they're sorted by path, character by character, so `./difficulty` comes before `./direction` and `./controller` before `./direction`. Get this wrong and the lint run crashes (see above).

Import types with `import type { … }`, not `import { type … }`. With `verbatimModuleSyntax` on, the second form still loads the module when the page runs. For example, `src/hero/` importing a type from `src/game/` that way pulled all of three.js into the first page load. The `@typescript-eslint/no-import-type-side-effects` rule catches it.

## How the code fits together

- **Page:** `src/pages/index.astro` puts the sections from `src/content/` together. Everything is static Astro, except for the hero.
- **Hero** (`src/hero/`):
  - A React island (`client:load`).
  - `HeroController` runs the scenes and copies what they report into the Jotai atoms in `atoms.ts`. Components read those atoms.
  - Anything kept between visits is an `atomWithStorage` read with `getOnInit: true`, for example `BEST_ATOM` and `EASTER_EGG_HITS_ATOM`. Storage can hold anything, so validate what you read (see `readHits`).
  - The game code is lazily imported, so it stays out of the page's first load.
- **Scenes:** `Game` and `Gallery` in `src/game/` implement `StageScene`. The stage canvas (`src/hero/scene-canvas.tsx`) steps a scene and draws it once per frame.
- **Game parts** are plain classes, such as `Player`, `Forest`, `Bears`, `EasterEggTrail`, `Effects` and `ChaseCamera`.
  - They don't touch React, so they can be unit-tested directly.
  - Each step runs them as systems, in the order set by `SYSTEM_ORDER` in `systems.ts`. Keep new behaviour in its own class or system rather than adding to `Game`.
- **Worlds:** `src/game/components/` holds React Three Fiber components that add the sky, light, mountains, ground and trees to a scene.
  - They join the scene's step with `useSystem`, so tests that fast-forward the game run them too.
  - Components free what they create. Game parts free theirs in `dispose()`.
  - The haze (`src/game/haze.ts`) changes three.js's fog for every material that uses it. It's measured by distance, not depth, and anything it has swallowed fades out, so the far mountains show through rather than a haze-coloured shape. Put anything new on the slope at least `APPEAR_AHEAD` ahead of the player (see `world.ts`), so it arrives already hidden.
- **Easter eggs:** one module each in `src/game/easter-eggs/`, listed in `index.ts`. See the README for how to add one.
- **Right-to-left:** the game and gallery mirror for right-to-left pages.
  - The page's direction becomes a `Mirror` (`1` or `-1`, in `src/game/direction.ts`), which flips the chase camera's side, the sun and the gallery row.
  - Steering stays physical: ← always turns screen-left.

## Tests

- **Unit tests** sit next to the code, as `*.test.ts`, and run in Node.
  - Anything that draws on a canvas, such as the bears' "!" badge or the easter eggs' textures, needs a DOM. Add `// @vitest-environment happy-dom` at the top of that test file.
  - Avoid randomness that can make a test flaky: put things exactly where the test needs them.
- **End-to-end tests** are in `e2e/`. They run on a desktop and a phone-sized browser.
  - Every test fails if the page throws an error (`e2e/fixtures.ts`).
  - In development builds, the game is exposed on `globalThis.heroTest`, so tests can fast-forward it (`advance(seconds)`) or end a run (`catchPlayer()`). The helpers are in `e2e/hero.ts`.
  - Playwright runs `astro dev` itself, with `ASTRO_DEV_BACKGROUND=1`. Otherwise Astro sends the server to the background when it detects an AI agent, and Playwright thinks it has quit.

## Commits and pull requests

- Commit messages and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org): `feat: …`, `fix: …`, `refactor: …`, `chore: …`. A Git hook and CI both check them.
- Keep each pull request to one change. Say in its description what changed and how you checked it.
- Don't edit `pnpm-lock.yaml` by hand. Renovate keeps the dependencies up to date.
