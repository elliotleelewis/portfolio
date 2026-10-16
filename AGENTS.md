# Working in this repo

Guidance for AI agents (and anyone else) making changes here. Start with [README.md](README.md) for what the site is, how it's laid out, and how the game and leaderboard work. This file is the rules.

## Before you say you're done

Run all of these. CI runs the same checks, and a red build blocks the merge.

```sh
pnpm lint
pnpm format
pnpm knip
pnpm test
pnpm build
pnpm e2e
```

- `pnpm lint` fails on warnings too. It also checks this file with [agnix](https://github.com/agent-sh/agnix); `pnpm exec agnix explain <rule>` says why a rule fired. `pnpm lint:fix` and `pnpm format:fix` fix most of it, including import order and Tailwind class order.
- `pnpm knip` fails on unused dependencies, files and exports. Delete them, or stop exporting what only its own file uses. If something is used in a way it can't see, say so in `knip.ts`.
- The build needs Node 24: the page's `dir` comes from `Intl.Locale`'s `getTextInfo()`.
- If Playwright's own browser isn't installed, point `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at a Chromium you have.
- For changes to the game or the page's look, take screenshots in light and dark mode. The tests can't tell you whether it looks right.

## Don't break these

- **No cookies or tracking.** Analytics is Cloudflare Web Analytics, which sets none, so the site needs no consent banner. The leaderboard keeps only initials, trees and metres.
- **Privacy pages first.** Before collecting, storing or sending anything new (including a new third party), update `src/pages/privacy.astro` (what leaves the device; bump its `UPDATED` date) or `src/pages/cookies.astro` (every cookie and storage key, and a button to clear them). Each keeps to its own job and links to the other. Don't frame them around one country's law.
- **The leaderboard stays inside Cloudflare's free limits.** The whole board is one D1 row: a request reads at most a few rows, and a saved score writes exactly one, which also counts the day's writes (`DAILY_WRITE_LIMIT`). No new tables, indexes, KV, logging or per-visitor rate limits, and the page fetches the board at most once.
- **Migrations only add.** The live code runs against them until the deploy finishes. Change `functions/_lib/schema.ts` and run `pnpm db:generate`; never write them by hand.
- **`src/` and `functions/` share no code.** `src/` may only `import type` from `functions/` (`.astro` files nothing), and `functions/` never imports from `src/`. ESLint enforces it.
- **The first page load stays small.** The game, the leaderboard's code and Turnstile all load lazily. Import types with `import type { … }`, never `import { type … }`: under `verbatimModuleSyntax` the second still loads the module (it once pulled three.js into the first load).
- **The page mirrors for right-to-left.** Use logical Tailwind classes for anything to the side (`ps`/`pe`, `inset-s`/`inset-e`, `border-s`), never `left`/`right`.
- **Colour follows the visitor's theme pick.** Use a `light-dark()` token, never `prefers-color-scheme` or Tailwind's `dark:`, which ignore the pick.
- **`public/llms.txt`** restates `src/content/`, so update it when that changes. Links only in the `##` sections, plain ASCII.
- **Licences:** every package sent to browsers is credited in `/licenses.txt`, and the build fails on one without a permissive licence. See `astro.config.ts`.

## Code style

ESLint (strict TypeScript, unicorn, jsdoc, jsx-a11y, Tailwind) and oxfmt (tabs, single quotes, trailing commas) enforce most of it.

- **Names:** `camelCase`, types `PascalCase`, exported constants `UPPER_CASE` (exported functions stay `camelCase`), private members `_player`.
- **Comments:** functions need JSDoc with `@param` and `@returns`. Comments say why, not what. Game code is in the first person, from the player's side ("where I am", "a bear got me").
- **React components** are typed with `FC`: `const Foo: FC<Props> = ({ bar }) => …`.
- **No `as` or non-null `!`.** Narrow the type, or restructure.
- **Imports:** groups of packages, then `../`, then `./`. `pnpm lint:fix` sorts them.

## Design

The site and the game share one look: a trail map on a misty mountain. Keep new pages and game UI in it.

- **Colour** comes only from the palette in `src/styles/global.css`: OKLCH tokens, each `light-dark(light, dark)` ("a misty morning", "night on the mountain"). ESLint rejects Tailwind's own and one-off colours in `src/`. A new colour is a new token, with both modes.
  - `paper` page, `surface` cards and panels, `ink` text, `muted` quieter text, `line` borders and rules.
  - `accent` (the wood stove's amber) is the one highlight, used sparingly: eyebrows, links, focus rings, the board's best moments. Text on it is `on-accent`.
  - `danger` only for errors. `pine` and `ridge-*` only for the landscape.
  - Over the hero's photo and scene: `snow` text on a `scrim` gradient (`from-scrim/70`), the same in both modes. `fog` is the scene's haze before it's drawn.
  - The 3D scene is day in light mode, night in dark. Its light comes from the `--scene-*` tokens and `accent` (my lantern), read by `src/game/atmosphere.ts`: change them in `global.css`, not the game. The world's own colours (grass, rock, bears, easter eggs) are set in `src/game/`; check them under the night light too.
- **Light and dark mode** follow the device unless the visitor picks one (`src/hero/theme-picker.tsx`), which sets `data-theme` on `<html>`.
- **Type:** Fraunces (`font-display`) semibold for headings, `tracking-tight` on big ones. Inter (`font-sans`) for text. JetBrains Mono (`font-mono`) for numbers, scores and labels; eyebrows are `font-mono text-xs tracking-[0.25em] text-accent uppercase`. Combo callouts can go bolder.
- **Shape:** `rounded-xl` cards on the page, `rounded-2xl` cards over the game, `rounded-full` buttons and pills, `rounded-lg` small chips.
- **Focus:** anything pressable has `focus-visible:ring-4`, `ring-accent/50` on the page and `ring-accent/70` over the game.
- **Motion:** gentle fades and rises (`duration-500` to `700`). Decorative motion goes behind `motion-safe:`.
- **Hidden panels** fade rather than leave the page, so each is `inert` while hidden. `e2e/keyboard.spec.ts` checks Tab only lands on what's visible.
- **Game UI** builds on `Button` (`src/hero/button.tsx`, with a `variant`) and `Card` (`src/hero/card.tsx`), not restyled `<button>`s or panels.

## Code

- **Text** is all in `messages/en.json`, through [Paraglide](https://paraglidejs.com): `m.hero_play()` from `../paraglide/messages` (compiled into the uncommitted `src/paraglide/`). Only names (mine, companies', products', skills'), the patent number and signs in the game's world stay in code.
  - Keys are `snake_case`, named by where they're shown: `hero_…`, `trail_…`, `gallery_…`, `privacy_…`, `cookies_…`.
  - Counts use plural variants (`hero_best`), numbers `: number` (`gallery_smashed`), dates `: datetime` (`role_dates`), not code.
  - Bold or links mid-sentence are markup (`{#score}…{/score}`): `ParaglideMessage` in React, `RichText` (`src/components/rich-text.tsx`) on Astro pages.
  - Lists of three or more take the Oxford comma, `llms.txt` included.
- **Hero** (`src/hero/`), a React island: `HeroController` runs the scenes and copies what they report into Jotai atoms (`atoms.ts`). Anything kept between visits is an `atomWithStorage` with `getOnInit: true`; validate what you read (see `readHits`).
- **Game** (`src/game/`): parts are plain classes that don't touch React, run as systems in `SYSTEM_ORDER` (`systems.ts`). Put new behaviour in its own class or system, not in `Game`.
  - World components (`src/game/components/`) join the step with `useSystem`. `Surroundings` recolours its lights in place when the theme changes; it doesn't rebuild them.
  - Components free what they create; game parts free theirs in `dispose()`.
  - Put anything new on the slope at least `APPEAR_AHEAD` ahead of the player (`world.ts`), so it arrives inside the haze.
  - My rig (`character.ts`) and the bears' (`bear.ts`) merge each joint's pieces into one mesh per material. Animate joints; keep a piece out of the merge to move it alone, as my eyes are.
  - Right-to-left: the page's `Mirror` (`direction.ts`) flips the camera's side, the sun and the gallery row. Steering stays physical: ← turns screen-left.
- **Easter eggs** (`src/game/easter-eggs/`, listed in `index.ts`) merge parts that share a parent and material (`mergeStill` in `merge.ts`). Keep your own references to parts you animate, never walk `children`, and animate glowing, see-through or textured materials rather than a plain one's colour.
- **Leaderboard** (`functions/`): a Hono app, `createApp` in `functions/_lib/app.ts`. Chain new routes there so their types reach the page's client (`src/hero/leaderboard.ts`).
  - The Function decides everything (rude initials, implausible runs, whether a run makes the board) and says why it turned one down. The page only checks the board's `cutoff` before asking for initials.
  - Only the site saves scores: a POST from another `Origin` is turned down, and the Turnstile token must be for the `score` action on the request's hostname. Every answer has Hono's `secureHeaders`, and a saved score is never cached.
  - Validate everything coming in (requests, D1, Turnstile) with Zod schemas, from `zod/mini`. Read the board with `readBoard`.
  - Never put rude words in the repo: the extra list is the `blockedInitials` secret, and tests use a harmless stand-in.
  - Queries go through Drizzle. Unit tests run it on in-memory `node:sqlite` with the same migrations.

## Tests

- **Unit tests** sit next to the code as `*.test.ts` and run in Node. Anything drawing on a canvas needs `// @vitest-environment happy-dom` at the top. Place things exactly rather than rely on randomness.
- **End-to-end tests** (`e2e/`) run on a desktop and a phone-sized browser, against `astro build` served by `astro preview`.
  - Any page error fails the test (`e2e/fixtures.ts`).
  - WebGL draws are dropped, so no test can check how the scene looks.
  - A test over 10 seconds fails. Check one state per test, and fast-forward the game (`advance(seconds)`, `catchPlayer()`, helpers in `e2e/hero.ts`) rather than wait. Animations end instantly unless the test sets `test.use({ animations: 'play' })`.
  - `astro preview` doesn't run the Function, so tests mock `/api/scores` and Turnstile (`mockLeaderboard` in `e2e/leaderboard.ts`).

## Commits and pull requests

- [Conventional Commits](https://www.conventionalcommits.org) for commit messages and PR titles (`feat: …`, `fix: …`, `refactor: …`, `chore: …`). A Git hook and CI check them.
- One change per pull request. Say what changed and how you checked it.
- Change dependencies in `package.json` and run `pnpm install`; never edit `pnpm-lock.yaml` by hand. Renovate keeps them up to date.
