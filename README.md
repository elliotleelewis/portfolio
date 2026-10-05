# elliotleelewis.com

[![Build](https://github.com/elliotleelewis/portfolio/actions/workflows/main.yml/badge.svg?branch=main&event=push)](https://github.com/elliotleelewis/portfolio/actions/workflows/main.yml?query=branch%3Amain+event%3Apush)

The source for [elliotleelewis.com](https://elliotleelewis.com): Elliot Lewis's portfolio. It's a single page styled like a hiking trail, from the intro and work history ("the trail") to the kit list and contact details ("base camp").

The hero photo doubles as a game. Press play and the photo fades into a low-poly 3D version of me, who strikes a star pose and cartwheels down a mountain. Along the way you flatten trees for points, dodge the bears that climb down to chase you, and smash through easter eggs from a stag do. Every easter egg you smash is unlocked in a gallery, and the best runs go on a shared leaderboard, under three initials like on an arcade cabinet.

## Stack

- [Astro](https://astro.build) for the page, with [Tailwind CSS](https://tailwindcss.com) for styles.
- A [React](https://react.dev) island for the hero, with its state in [Jotai](https://jotai.org) atoms.
- [Paraglide](https://paraglidejs.com) for text, shared by the Astro pages and the React island, in `messages/`.
- [three.js](https://threejs.org) and [React Three Fiber](https://r3f.docs.pmnd.rs) for the game, loaded only when you press play.
- [Vitest](https://vitest.dev) for unit tests and [Playwright](https://playwright.dev) for end-to-end tests.
- Hosted on [Cloudflare Pages](https://pages.cloudflare.com), with one [Pages Function](https://developers.cloudflare.com/pages/functions/) and a [D1](https://developers.cloudflare.com/d1/) database for the leaderboard.

## Getting started

You'll need Node.js 24 and [pnpm](https://pnpm.io). The pnpm version is pinned by `packageManager` in `package.json`.

```sh
pnpm install
pnpm start
```

`pnpm start` serves the site at <http://localhost:4321>, and on your local network so you can try it on a phone.

## Scripts

| Script         | What it does                                                                       |
| -------------- | ---------------------------------------------------------------------------------- |
| `pnpm start`   | Runs the dev server.                                                               |
| `pnpm build`   | Type-checks with `astro check`, then builds the site into `dist/`.                 |
| `pnpm preview` | Serves the built site.                                                             |
| `pnpm lint`    | Lints everything with ESLint. `pnpm lint:fix` fixes what it can.                   |
| `pnpm format`  | Checks formatting with Prettier. `pnpm format:fix` fixes it.                       |
| `pnpm test`    | Runs the unit tests.                                                               |
| `pnpm e2e`     | Builds the site and runs the end-to-end tests on desktop and phone-sized Chromium. |

The end-to-end tests build the site and serve it themselves. They run on desktop and phone-sized Chromium. To use a Chromium you already have instead of Playwright's, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its path.

## How it's laid out

```text
src/
  pages/        The home page, and the game on its own at /game.
  layout/       The HTML shell.
  content/      The page's sections: hero, intro, trail, pack list, base camp, footer.
  components/   Smaller pieces those sections share.
  hero/         The hero's React island: controls, HUD, gallery panel and state.
  game/         The game and the easter egg gallery (plain TypeScript and three.js).
    components/ The React Three Fiber components that build their worlds.
    easter-eggs/ One module per easter egg.
  leaderboard/  The leaderboard's rules and API, shared by the page and the Function.
functions/      The Pages Function that serves the leaderboard, at /api/scores.
migrations/     The leaderboard's D1 table.
e2e/            The Playwright tests.
messages/       The site's text, one file per language, for Paraglide.
project.inlang/ Paraglide's settings.
public/         Static files, like the favicons.
```

### The game

The game is split so most of it can be tested without a browser:

- **The hero** (`src/hero/`) is a React island. `HeroController` starts and stops the scenes and copies what they report (score, distance, game over, the gallery's position) into Jotai atoms for the UI to show. The best score and easter egg smash counts are atoms with storage, so they're kept between visits.
- **The scenes** (`src/game/game.ts` and `src/game/gallery.ts`) are plain classes. Each part of the game is its own class with its own tests, for example `Player`, `Forest`, `Bears`, `EasterEggTrail`, `Effects` and `ChaseCamera`. On each step these run as systems, in the order set by `SYSTEM_ORDER`.
- **The game page** (`src/pages/game.astro`, at `/game`) is the same island on its own, filling the window. There's no photo: the game loads straight away and waits on a start screen of its own, and leaving a run goes back there.
- **The worlds** (`src/game/components/`) are React Three Fiber components that add the sky, light, mountains, ground and trees to a scene and hook into its systems with `useSystem`.

The game in play is also on `hero.game` in the browser's console, on the live site too. Try `hero.game.advance(30)` to skip ahead, or `hero.game.catchPlayer()` to end the run. The end-to-end tests use it the same way.

### The leaderboard

The site stays static. The leaderboard is one Pages Function (`functions/api/scores.ts`) next to it, which keeps the top 10 runs in D1, and it's built to stay inside Cloudflare's free plans however many people play, or however hard anyone hammers it:

- The whole board is one row. Reading it is one row read, and saving a score is one row write, only if the score makes the top 10.
- The row counts its own writes, in that same write, and takes no more than 1,000 scores a day (`DAILY_WRITE_LIMIT`), against D1's free 100,000 rows written.
- Each request reads at most six rows, and Workers' free plan stops at 100,000 requests a day, so reads stay under D1's free 5 million a day. Past that limit, Cloudflare turns requests to `/api/scores` away rather than charging, and the game plays on without the board. The rest of the site is static, so its requests never reach the Function.
- The page fetches the board once, when the game first loads, and only saves a score that makes it.
- [Turnstile](https://developers.cloudflare.com/turnstile/) checks that a person is saving each score. It's free with no limit on checks, and only loads when there's a score to save.

Anyone can still send a made-up score, as with any game in a browser. The Function turns down rude initials and runs that couldn't happen in real play, like one fast-forwarded with `hero.game.advance()`.

### Adding an easter egg

Write a module in `src/game/easter-eggs/` that exports an `EasterEgg` (see `types.ts`), then add it to `ALL_EASTER_EGGS` in `index.ts`. That list sets the order in the gallery. The game places easter eggs down the mountain in a shuffled order.

## Deployment

GitHub Actions (`.github/workflows/main.yml`) lints, tests and builds every pull request and every push to `main`, and deploys each one to Cloudflare Pages. Pull requests get a preview deployment, and `main` is the live site.

### Setting up the leaderboard

Once, in Cloudflare's dashboard, with the account on the Workers Free plan. On the Paid plan, requests past the free allowance are billed rather than turned away.

1. Create a D1 database (Storage & Databases → D1), called `portfolio-leaderboard`, and create its table by running `migrations/0001_leaderboard.sql` in its console, or with `npx wrangler d1 execute portfolio-leaderboard --remote --file=migrations/0001_leaderboard.sql`.
2. Add a Turnstile widget (Turnstile → Add widget) for `elliotleelewis.com`, in Managed mode.
3. In the Pages project's Settings → Bindings, for Production only, bind the database as `leaderboard`. Preview deployments then have no board, so they can't write to the live one.
4. In Settings → Variables and Secrets, for Production, add the widget's secret key as a secret called `turnstileSecret`.
5. In the GitHub repo's Settings → Secrets and variables → Actions → Variables, add the widget's site key as `TURNSTILE_SITE_KEY`. The deploy job builds with it. Without it, the page uses Cloudflare's test key, which the live secret turns down.

Until that's done, `/api/scores` answers 503 and the game plays on without a board.

## Contributing

Commit messages and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org). A Git hook checks commit messages with commitlint, and CI checks pull request titles. [Renovate](https://docs.renovatebot.com) keeps the dependencies up to date.

If you're an AI agent working in this repo, read [AGENTS.md](AGENTS.md) first.
