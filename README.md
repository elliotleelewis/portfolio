# elliotleelewis.com

[![Build](https://github.com/elliotleelewis/portfolio/actions/workflows/main.yml/badge.svg?branch=main&event=push)](https://github.com/elliotleelewis/portfolio/actions/workflows/main.yml?query=branch%3Amain+event%3Apush)

The source for [elliotleelewis.com](https://elliotleelewis.com): Elliot Lewis's portfolio. It's a single page styled like a hiking trail, from the intro and work history ("the trail") to the kit list and contact details ("base camp").

The hero photo doubles as a game. Press play and the photo fades into a low-poly 3D version of me, who strikes a star pose and cartwheels down a mountain. Along the way you flatten trees for points, dodge the bears that climb down to chase you, and smash through easter eggs from a stag do. Every easter egg you smash is unlocked in a gallery.

## Stack

- [Astro](https://astro.build) for the page, with [Tailwind CSS](https://tailwindcss.com) for styles.
- A [React](https://react.dev) island for the hero, with its state in [Jotai](https://jotai.org) atoms.
- [three.js](https://threejs.org) and [React Three Fiber](https://r3f.docs.pmnd.rs) for the game, loaded only when you press play.
- [Vitest](https://vitest.dev) for unit tests and [Playwright](https://playwright.dev) for end-to-end tests.
- Hosted on [Cloudflare Pages](https://pages.cloudflare.com).

## Getting started

You'll need Node.js 24 and [pnpm](https://pnpm.io). The pnpm version is pinned by `packageManager` in `package.json`.

```sh
pnpm install
pnpm start
```

`pnpm start` serves the site at <http://localhost:4321>, and on your local network so you can try it on a phone.

## Scripts

| Script          | What it does                                                       |
| --------------- | ------------------------------------------------------------------ |
| `pnpm start`    | Runs the dev server.                                               |
| `pnpm build`    | Type-checks with `astro check`, then builds the site into `dist/`. |
| `pnpm preview`  | Serves the built site.                                             |
| `pnpm lint`     | Lints everything with ESLint. `pnpm lint:fix` fixes what it can.   |
| `pnpm format`   | Checks formatting with Prettier. `pnpm format:fix` fixes it.       |
| `pnpm test`     | Runs the unit tests.                                               |
| `pnpm test:e2e` | Runs the end-to-end tests on desktop and phone-sized Chromium.     |

The end-to-end tests start their own dev server. To use a Chromium you already have instead of Playwright's, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its path.

## How it's laid out

```text
src/
  pages/        The page itself.
  layout/       The HTML shell and analytics.
  content/      The page's sections: hero, intro, trail, pack list, base camp, footer.
  components/   Smaller pieces those sections share.
  hero/         The hero's React island: controls, HUD, gallery panel and state.
  game/         The game and the easter egg gallery (plain TypeScript and three.js).
    components/ The React Three Fiber components that build their worlds.
    easter-eggs/ One module per easter egg.
e2e/            The Playwright tests.
public/         Static files, like the favicons.
```

### The game

The game is split so most of it can be tested without a browser:

- **The hero** (`src/hero/`) is a React island. `HeroController` starts and stops the scenes and copies what they report (score, distance, game over, the gallery's position) into Jotai atoms for the UI to show. The best score and easter egg smash counts are atoms with storage, so they're kept between visits.
- **The scenes** (`src/game/game.ts` and `src/game/gallery.ts`) are plain classes. Each part of the game is its own class with its own tests, for example `Player`, `Forest`, `Bears`, `EasterEggTrail`, `Effects` and `ChaseCamera`. On each step these run as systems, in the order set by `SYSTEM_ORDER`.
- **The worlds** (`src/game/components/`) are React Three Fiber components that add the sky, light, mountains, ground and trees to a scene and hook into its systems with `useSystem`.

### Adding an easter egg

Write a module in `src/game/easter-eggs/` that exports an `EasterEgg` (see `types.ts`), then add it to `ALL_EASTER_EGGS` in `index.ts`. That list sets the order in the gallery. The game places easter eggs down the mountain in a shuffled order.

## Deployment

GitHub Actions (`.github/workflows/main.yml`) lints, tests and builds every pull request and every push to `main`, and deploys each one to Cloudflare Pages. Pull requests get a preview deployment, and `main` is the live site.

## Contributing

Commit messages and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org). A Git hook checks commit messages with commitlint, and CI checks pull request titles. [Renovate](https://docs.renovatebot.com) keeps the dependencies up to date.

If you're an AI agent working in this repo, read [AGENTS.md](AGENTS.md) first.
