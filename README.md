# MTG Life

A Magic: The Gathering life counter PWA for 2–4 player pods, deployed to
[mtg-life.codybarr.dev](https://mtg-life.codybarr.dev).

- **Seats that face their players.** Seven layouts for a phone lying flat on
  the table: Face-off and Flanks (2 players), Wedge and Tee (3), Sides, Round
  table and Two pairs (4). Changing layout morphs each panel into its new seat
  using View Transitions.
- **Tap controls.** Tap the left or right half of a panel for −1/+1. Hold it
  to step by 10 (after 500ms, then every 400ms). Several players can hold at
  once. A running "+3" bubble shows recent changes, and Android devices get
  haptic feedback.
- **Per-player details.** Tap a player's name to open a dialog turned toward
  them. It covers commander damage taken from each opponent (with partner
  support, lethal at 21, and the life loss applied automatically), poison,
  energy, experience, rad, storm, a custom counter, commander tax, monarch and
  initiative, name, and color (12 swatches plus a Web Awesome color picker).
- **Table menu.** The center button sets player count, layout and starting life,
  picks a random first player, and starts a new game with confirmation.
- **Keeps the screen on.** On by default. It re-acquires the wake lock each time
  the app returns to the foreground and can be turned off in the table menu.
- **Works offline.** The game is saved to localStorage after every change, and
  a service worker precaches the app.

## Stack

| Concern                 | Tool                                                   |
| ----------------------- | ------------------------------------------------------ |
| Architecture & view     | [Foldkit](https://foldkit.dev) (Elm architecture)      |
| State, schemas, effects | [Effect](https://effect.website)                       |
| Dialogs, switch, input  | `@foldkit/ui`                                          |
| Build & dev server      | Vite 8 (run under Bun) + `@foldkit/vite-plugin`        |
| Styling                 | Tailwind CSS v4 (`@tailwindcss/vite`)                  |
| Variants                | CVA + tailwind-merge (`src/ui/variants.ts`, `cn`)      |
| Icons                   | Tabler Icons node data, trimmed by `scripts/icons.ts`  |
| Color picker            | Web Awesome `<wa-color-picker>` via `CustomElement`    |
| Tests                   | `bun test` (domain + Foldkit stories), Playwright + axe |
| Deploy                  | Alchemy v2 → Cloudflare static site                    |

## Layout

```
src/
  domain/      pure game rules: players, counters, loss conditions, layouts, colors
  app/         Foldkit program: Model, Message, update, Commands, Subscriptions, init
  view/        table (seats, life zones, chips), dialogs, shared controls
  ui/          cn(), CVA variants, Tabler icon renderer (+ generated icon data)
  entry.ts     boots the Runtime and registers the service worker
index.html     Vite entry
scripts/       service-worker Vite plugin + template, icon generators
e2e/           Playwright + axe-core tests against the production build
alchemy.run.ts Cloudflare deployment
```

## Commands

Tool versions (Bun, pitchfork) are pinned in `mise.toml`.

```bash
mise install
bun install
mise run start       # Vite dev server in the background via pitchfork (http://localhost:3000)
mise run logs        # tail its logs
mise run stop
bun run dev          # or run Vite in the foreground
bun run build        # dist/ with hashed assets, manifest, icons, sw.js
bun run preview      # serve dist/ on :4173
bun run typecheck
bun test             # unit + story tests
bun run test:e2e     # Playwright (phone + tablet) with axe accessibility scans
bun run icons        # regenerate icon data and PWA PNGs after editing either
```

The first time you run the e2e tests, install the browser: `bunx playwright install chromium`.

## Deploying

Alchemy v2 has no `alchemy login`. Set up a Cloudflare profile once:

```bash
bunx alchemy profile edit --add Cloudflare   # browser sign-in or API token
bun run deploy                                # stage "prod" → mtg-life.codybarr.dev
bun run deploy:preview                        # stage "preview" → workers.dev URL
```

The deploy builds the Vite project itself (`Cloudflare.Website.Foldkit`). In CI, set `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` instead of a profile. Alchemy keeps its state in your
Cloudflare account, in a Worker named `alchemy-state-store`.
