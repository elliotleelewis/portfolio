# Working in this repo

Guidance for AI agents (and anyone else) making changes here. Start with [README.md](README.md) for what the site is and how it's laid out.

## Before you say you're done

Run all of these. CI runs the same checks, and a red build blocks the merge.

```sh
pnpm lint
pnpm format
pnpm test
pnpm build
pnpm e2e
```

- `pnpm lint` fails on warnings as well as errors.
- `pnpm lint:fix` and `pnpm format:fix` fix most style problems, including Tailwind class order.
- The end-to-end tests build the site and serve it themselves. If Playwright's own browser isn't installed, point `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at a Chromium you have.
- For changes to the game or the page's look, also look at the result in a browser. The tests can't tell you whether it looks right.

## Code style

ESLint enforces most of this, with strict TypeScript, unicorn, jsdoc, jsx-a11y and Tailwind rules. Prettier handles formatting: tabs, single quotes, trailing commas.

- **Names:**
  - Most things are `camelCase` and types are `PascalCase`.
  - Exported constants are `UPPER_CASE`, but exported functions are `camelCase`.
  - Private members start with `_`, like `_player`.
- **Comments and docs:** functions need JSDoc with `@param` and `@returns`. Game code is written in the first person, from the player's side ("where I am", "a bear got me"), and comments say why rather than what. Match the surrounding code.
- **React components** are typed with `FC`: `const Foo: FC<Props> = ({ bar }) => …`, or `FC` alone when a component takes no props.
- **Type assertions:** avoid `as` and non-null `!`. Narrow the type, or restructure the code, instead.
- **Tailwind:**
  - Use the canonical class names the linter asks for, like `inset-s-4` rather than `start-4`.
  - Use logical classes for anything to the side (`ps`/`pe`, `inset-s`/`inset-e`, `border-s`), never `left`/`right`, so the page mirrors for right-to-left languages.

### Imports

Imports go in groups separated by a blank line: packages first, then parent paths (`../`), then siblings (`./`). Within each group they're sorted by path, character by character, so `./difficulty` comes before `./direction` and `./controller` before `./direction`, and the names inside the braces are sorted too. `pnpm lint:fix` puts them in order.

Import types with `import type { … }`, not `import { type … }`. With `verbatimModuleSyntax` on, the second form still loads the module when the page runs. For example, `src/hero/` importing a type from `src/game/` that way pulled all of three.js into the first page load. The `@typescript-eslint/no-import-type-side-effects` rule catches it.

## Design

The site and the game share one look: a trail map on a misty mountain. Keep new pages and game UI in it, so the game feels like part of the portfolio rather than something bolted on.

- **Colour** comes only from the palette in `src/styles/global.css`, in OKLCH, with light ("a misty morning") and dark ("night on the mountain") values. ESLint turns down Tailwind's own colours (`bg-white`, `text-slate-900`, …) and one-off ones (`bg-[#…]`, `rgb(…)`) anywhere in `src/`. If something really needs a new colour, add a token there, with both modes.
  - `paper` is the page, `surface` cards and panels, `ink` text, `muted` quieter text, and `line` borders and rules.
  - `accent` (the wood stove's amber) is the one highlight: eyebrows, links, focus rings, the board's best moments. Text on it is `on-accent`. Use it sparingly.
  - `danger` is only for errors. `pine` and the `ridge-*` colours are for the landscape (the footer's ridges, shadows).
  - Over the hero's photo and 3D scene: `snow` is light text, on a `scrim` gradient (`from-scrim/70`). Both stay the same in either mode, because the photo doesn't change. `fog` is the scene's haze, shown until it's drawn.
  - The 3D scene is day in light mode and night in dark mode. Its light and air come from the theme: the `--scene-*` colours (haze, sun or moon, and the light from the sky and the ground) and `accent` for my lantern by night. `src/game/atmosphere.ts` reads them and converts the OKLCH to three.js's colours, and sets how bright each light is. Change the colours in `global.css`, not in the game.
  - The 3D world's own colours (grass, rock, bears, easter eggs) are scenery, set in `src/game/`, and aren't part of the palette. The night light changes how they look, so check them in both modes.
- **Type:** Fraunces (`font-display`), semibold, for headings, with `tracking-tight` on the big ones. Inter (`font-sans`) for text. JetBrains Mono (`font-mono`) for numbers, scores and labels, including eyebrows: `font-mono text-xs tracking-[0.25em] text-accent uppercase`. The game's combo callouts can go bolder, as arcade text.
- **Shape:** `rounded-xl` for cards on the page, `rounded-2xl` for cards over the game, `rounded-full` for buttons and pills, and `rounded-lg` for small chips.
- **Focus:** everything you can press shows `focus-visible:ring-4` in `accent`: `ring-accent/50` on the page, and `ring-accent/70` over the busier game.
- **Motion:** gentle fades and rises (`duration-500` to `700`). Anything that moves or pulses for decoration goes behind `motion-safe:`.
- **The game's UI** builds on `Button` (`src/hero/button.tsx`, with a `variant` for what it sits on) and `Card` (`src/hero/card.tsx`). Use them rather than restyling a `<button>` or panel, so buttons, focus rings and cards stay the same everywhere. Cards over the scene are `surface` and `ink`, so they follow the page into dark mode.
- **Check it** in both modes. The e2e accessibility tests check contrast in light and dark, but not whether it looks right: take a screenshot.

## How the code fits together

- **Page:** `src/pages/index.astro` puts the sections from `src/content/` together. Everything is static Astro, except for the hero.
- **Text** goes through [Paraglide](https://paraglidejs.com), so the Astro pages and the React island share one set of messages:
  - Each message is in `messages/en.json`, and is called as a typed function, like `m.hero_play()`, from `../paraglide/messages`. Paraglide compiles them into `src/paraglide/`, which isn't committed. `pnpm install` compiles them (`prepare`), and so does every build and dev server (the Vite plugin in `astro.config.ts`).
  - Name keys by where they're shown, in `snake_case`: `hero_…`, `trail_…`, `gallery_…`, `cookies_…`.
  - Counts use plural variants (see `hero_best`), numbers are formatted with `: number` (see `gallery_smashed`), and dates with `: datetime` (see `role_dates`, which takes months like `2024-04`), rather than choosing words or formatting in code.
  - Bold or links inside a sentence are markup, like `{#score}…{/score}` in `hero_result`, rendered in React with `ParaglideMessage` from `@inlang/paraglide-js-react`. On Astro pages, use `RichText` (`src/components/rich-text.tsx`) for `{#strong}` and `{#link}`: Astro renders it to HTML at build time, with no JavaScript.
  - All of the site's text is in messages, except names (mine, companies', products' and skills'), the patent number, and signs in the game's world, like "POLICE" on the car.
  - The page's `lang` and `dir` come from the locale, in `src/layout/Layout.astro`. `dir` uses `Intl.Locale`'s `getTextInfo()`, which needs Node 24.
  - English is the only language. Adding one means a `messages/{locale}.json`, the locale in `project.inlang/settings.json`, Astro's `i18n` routing, and a `url` strategy for Paraglide, in both `astro.config.ts` and the `prepare` script.
- **`public/llms.txt`** describes me and the site for AI agents, in the [llmstxt.org](https://llmstxt.org) format. It restates what `src/content/` says, so update it when that changes. Keep links in the `##` sections only, and the text plain ASCII.
- **Analytics:** Cloudflare Web Analytics, turned on for the Pages project in Cloudflare's dashboard, which adds its script to each page. It sets no cookies, so the site needs no consent banner. Keep it that way: anything that sets cookies or tracks visitors would need one in the EU and UK. The leaderboard keeps only initials, trees and metres, nothing about who sent them.
- **`src/pages/404.astro`** answers anything not on the site. Without a `404.html`, Cloudflare Pages would answer every unknown path with the home page.
- **Fonts:** every font comes from Google Fonts through Astro's fonts API (`fonts` in `astro.config.ts`, and a `<Font>` per family in `src/layout/Layout.astro`), and the build hosts it with the site. Inter is one variable font for weights 400 to 900, and JetBrains Mono is regular only. Fraunces has one entry per style the site uses (600 for every heading, and 400 italic), each keeping the optical-size axis, so large headings get the display design. Keep one weight per Fraunces entry: asked for several together, Google sends the full variable font. Headings stick to semibold, so no page needs another weight. The build downloads the fonts from Google, and if that fails it carries on without them, so the e2e test "loads each font" checks they're there.
- **Hero photo:** `src/media/hero.webp` is a lossless, full-resolution crop of the original, in Display P3. Astro converts it to sRGB and encodes each size as AVIF, with WebP as a fallback, at the qualities set in `astro.config.ts`. Astro's image cache (`node_modules/.astro`) ignores those settings, so delete it after changing them, or builds keep the old images. The `sizes` in `src/content/Hero.astro` works out how wide the photo is drawn from the hero's layout, so update it if the layout changes. The e2e test "loads a sharp enough photo" checks it.
- **Hero** (`src/hero/`):
  - A React island (`client:load`).
  - `HeroController` runs the scenes and copies what they report into the Jotai atoms in `atoms.ts`. Components read those atoms.
  - Anything kept between visits is an `atomWithStorage` read with `getOnInit: true`, for example `BEST_ATOM` and `EASTER_EGG_HITS_ATOM`. Storage can hold anything, so validate what you read (see `readHits`).
  - The game code is lazily imported, so it stays out of the page's first load.
  - `/game` (`src/pages/game.astro`) is the hero on its own, with `isGamePage`. It has no photo: `controller.ready()` loads a held `Game`, which loops me looking around until `begin()` releases it. Leaving (`controller.leave()`) goes back to the start screen there, and to the photo on the home page.
- **Scenes:** `Game` and `Gallery` in `src/game/` implement `StageScene`. The stage canvas (`src/hero/scene-canvas.tsx`) steps a scene and draws it once per frame.
- **Game parts** are plain classes, such as `Player`, `Forest`, `Bears`, `EasterEggTrail`, `Effects` and `ChaseCamera`.
  - They don't touch React, so they can be unit-tested directly.
  - Each step runs them as systems, in the order set by `SYSTEM_ORDER` in `systems.ts`. Keep new behaviour in its own class or system rather than adding to `Game`.
  - My rig (`character.ts`) and the bears' (`bear.ts`) are built with each joint's pieces merged into one mesh per material, to save draw calls. Animate the joints. To move a piece on its own, keep it out of the merge, as my eyes are for blinking.
- **Worlds:** `src/game/components/` holds React Three Fiber components that add the sky, light, mountains, ground and trees to a scene.
  - `Surroundings` (`scenery.tsx`) is the sky, haze, light and horizon, from the site's theme. It follows the site's mode as it changes, even mid-run, recolouring the lights in place rather than rebuilding them.
  - They join the scene's step with `useSystem`, so tests that fast-forward the game run them too.
  - Components free what they create. Game parts free theirs in `dispose()`.
  - The haze (`src/game/haze.ts`) changes three.js's fog for every material that uses it. It's measured by distance, not depth, and anything it has swallowed fades out, so the far mountains show through rather than a haze-coloured shape. Put anything new on the slope at least `APPEAR_AHEAD` ahead of the player (see `world.ts`), so it arrives already hidden.
- **Easter eggs:** one module each in `src/game/easter-eggs/`, listed in `index.ts`. See the README for how to add one.
  - Each easter egg's parts that share a parent and a material are merged into one mesh to save draw calls (`mergeStill` in `easter-eggs/merge.ts`). Plain parts whose materials differ only in colour merge too, with their colours in the geometry. Glowing, see-through and textured materials keep their own, so animate those rather than a plain material's colour.
  - A part the easter egg moves (or recolours) on its own is put back automatically the moment it changes, and every part is put back before a smash, so each flies off separately.
  - Keep your own references to the parts you animate. Don't find them by walking `children`: merged parts aren't there.
- **Leaderboard:** the site stays static. The leaderboard's API is a Cloudflare Pages Function, all in `functions/`: `functions/api/[[route]].ts` hands everything under `/api` to a [Hono](https://hono.dev) app, `createApp` in `functions/_lib/app.ts`, which is plain TypeScript tested in Node. Pages only turns files that export request handlers into routes, so `_lib/` (and its tests) never becomes one.
  - `src/` and `functions/` share no code. The page calls the API with Hono's typed client (`src/hero/leaderboard.ts`), importing only `AppType` and other types from `functions/`, with `import type`, so TypeScript checks every request and answer and none of the Function's code ends up in the page. Add or change routes in `createApp`, chained, so their types reach the client. ESLint enforces the boundary: `src/` may only `import type` from `functions/` (and `.astro` files nothing at all), and `functions/` may not import from `src/`.
  - The Function has the final say on everything: rude initials, runs that couldn't be real, and whether a run makes the board. It tells the page why it turned a score down (`blocked`, `implausible`). The page only checks a run against the board's `cutoff`, so it asks for initials only when a run can make it.
  - It must never go over Cloudflare's free limits. Keep the whole board in the one D1 row, so a request reads at most a few rows and a saved score writes exactly one. The day's writes are counted in that same write, capped at `DAILY_WRITE_LIMIT`. Don't add tables, indexes, KV, or writes for anything else (no logging, no per-visitor rate limits), and don't fetch the board more than once a page.
  - The leaderboard's code loads with the board, when the game first loads, and Turnstile's script only when there's a score to save, so neither is in the page's first load.
  - What comes into the Function (requests, D1, Turnstile) could hold anything. Its shapes are [Zod](https://zod.dev) schemas (`ENTRY`, `RUN` and `INITIALS` in `functions/_lib/`, and the request's in `app.ts`, checked with `sValidator`). Import `zod/mini`, not `zod`. Read the stored board with `readBoard`, which keeps the good entries if some are bad.
  - Rude initials come from [obscenity](https://github.com/jo3-l/obscenity)'s word list, plus the optional `blockedInitials` secret on the Pages project. Don't put a list of rude words in the repo: tests use a harmless stand-in for the secret.
  - Queries go through [Drizzle](https://orm.drizzle.team), with the table defined in `functions/_lib/schema.ts`. Don't write migrations by hand: change the schema and run `pnpm db:generate`, which writes them to `migrations/`. CI checks they match. Migrations only ever add: the live code runs against them until the deploy finishes.
  - Unit tests run the server on SQLite in memory (`node:sqlite`), through Drizzle's proxy driver, with the same migrations applied.
  - The live site and previews have a database each, in `wrangler.toml`. The deploy job creates and migrates them (`.github/scripts/leaderboard-db.sh`) before deploying.
  - `astro preview` doesn't run the Function, so e2e tests mock `/api/scores` and Turnstile (`mockLeaderboard` in `e2e/leaderboard.ts`). Run it for real with `pnpm exec wrangler pages dev` (see the README).
- **Right-to-left:** the game and gallery mirror for right-to-left pages.
  - The page's direction becomes a `Mirror` (`1` or `-1`, in `src/game/direction.ts`), which flips the chase camera's side, the sun and the gallery row.
  - Steering stays physical: ← always turns screen-left.

## Tests

- **Unit tests** sit next to the code, as `*.test.ts`, in `src/` and `functions/`, and run in Node.
  - Anything that draws on a canvas, such as the bears' "!" badge or the easter eggs' textures, needs a DOM. Add `// @vitest-environment happy-dom` at the top of that test file.
  - Avoid randomness that can make a test flaky: put things exactly where the test needs them.
- **End-to-end tests** are in `e2e/`. They run on a desktop and a phone-sized browser.
  - Every test fails if the page throws an error (`e2e/fixtures.ts`).
  - They run on the site as it's deployed: `astro build`, served by `astro preview`. That's much faster than the dev server. In CI, the e2e job tests the `dist/` the build job made instead of building it again.
  - The game in play is on `globalThis.hero.game` (`expose()` in `controller.ts`), so tests can fast-forward it (`advance(seconds)`) or end a run (`catchPlayer()`). The helpers are in `e2e/hero.ts`. It's there on the live site too, for anyone curious enough to open the console. It reads the controller's current game each time, so it never keeps a finished one in memory.
  - Playwright runs `astro preview` with `ASTRO_PREVIEW_BACKGROUND=1`. Otherwise Astro sends the server to the background when it detects an AI agent, and Playwright thinks it has quit.

## Commits and pull requests

- Commit messages and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org): `feat: …`, `fix: …`, `refactor: …`, `chore: …`. A Git hook and CI both check them.
- Keep each pull request to one change. Say in its description what changed and how you checked it.
- Don't edit `pnpm-lock.yaml` by hand. Renovate keeps the dependencies up to date.
