# Alex's Pretzel Run

A lane runner for the family. Get Alex, in his work suit, down the west sidewalk of 7th Ave from W 50 St to Penn Station before the fresh batch of pretzels sells out, dodging New Yorkers and grabbing enough loose cash on the way to pay for his order.

**Play:** https://andrewking46.github.io/pretzel-run/

## How to play

| | Phone | Keyboard | Gamepad |
|---|---|---|---|
| Change lanes | swipe ← → | ← → or A D | d-pad / stick |
| Jump | swipe ↑ or tap | ↑ W or Space | A |
| Slide | swipe ↓ (mid-air: drop fast) | ↓ or S | B |
| Pause | ⏸ button | P or Esc | Start |

- **Dimes** line the safe path. **Quarters** arc over anything you can jump, so the risky line pays more. There's one **$5 bill** somewhere past Times Square.
- Getting bumped costs 20% of your cash (it never ends the run).
- **Power-ups:** 🍕 Dollar Slice (5 s of speed, and Alex bowls through everyone), 🐈 Bodega Cat (9 s cash magnet), and the Express (skips about two blocks underground, but you miss the cash along the way).
- **Today's Run** uses New York's date, so the whole family gets the same route every day. **Practice** is a random route.
- Your order depends on your cash at the counter: ★ The Original ($5.98), ★★ Pretzel + Lemonade ($11.19), ★★★ Alex's Usual ($31.41).

## Develop

Requires Node 24+.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. In dev, `window.__PR` is a test hook (`__PR.start(false, seed)`, `__PR.autopilot()`, `__PR.teleport(meters)`, `__PR.speed(k)`). Add `?perf` to the URL on any device for a frame-time overlay (tap it to copy the numbers).

## Test

```bash
npm test
```

Runs the simulation tests in Node with no browser: same seed → same course; every one of 500 courses proven to have a hit-free path (an exhaustive search over the real sim); the autopilot finishes with ≤1 stumble on 95%+ of seeds and earns 3★ about 85% of the time; cash pool between $45 and $90; tax and tier math; express landings; moving obstacles meet you where the pattern intends.

```bash
npm run test:e2e
```

Playwright on a 390×844 touch phone and a 1280×800 desktop, against an optimized build that keeps the test hook. It checks:
- the game boots without console errors
- swipes, taps and the keyboard steer Alex
- pause and resume work
- a full autopilot run reaches the receipt

```bash
npm run screenshots
```

Saves the title, countdown, Times Square, cab, express, Penn finish, counter and receipt shots to `tests/screenshots/`. Needs a server running; see the comment at the top of `scripts/screenshots.ts`.

```bash
npm run perf
```

30 seconds of autopilot play per quality tier, plus a 4× CPU-throttled phone proxy. Reports average, p95 and max frame time and draw calls.

```bash
npm run sim:report -- 500
```

Balance numbers for 500 seeds (pool, stars, stumbles, time left).

## Build and deploy

```bash
npm run build
```

Outputs a static site in `dist/` (relative paths, so it works under any subpath). Pushing to `main` runs `.github/workflows/deploy.yml`, which runs the simulation tests, builds, and publishes to GitHub Pages. It works the same on Cloudflare Pages: build command `npm run build`, output folder `dist`.

## Make it yours

- **Alex's look:** `src/config/alex.ts` (hair, eyes, skin, suit, tie, shoes).
- **Face photo:** drop `public/alex-face.png` (a square headshot) in before building, and it shows in a circle on the title, the receipt and the progress bar. It's checked at build time, so nothing 404s without it. If the repo or site is public, so is the photo.
- **Prices and tiers:** `src/config/menu.ts`.
- **Gameplay numbers:** `src/config/tuning.ts`.
- **The route:** `src/config/levels/level2.ts` (streets, Times Square, pattern weights, power-up schedule). Levels are data; the engine never names one.
- **Speech bubbles and quips:** `src/config/copy.ts`.

## Layout

```
src/
  sim/      pure TypeScript simulation: seeded course generator, patterns, player physics,
            collisions, economy, 120 Hz run loop, autopilot, solvability solver (no DOM, no three.js)
  config/   tuning, menu prices, Alex's look, level data, copy
  world/    city blocks (procedural facades, storefronts, props), sky, traffic, sign atlas, materials
  actors/   Alex, pedestrians (rigid-skinned toy people), obstacles, coins, power-ups
  fx/       chase camera, particles, post-processing tiers
  audio/    synthesized sound effects and music
  ui/       HUD, menus, receipt, share, settings
  input/    touch, keyboard, gamepad
tests/      Vitest (sim) and Playwright (e2e); screenshots/
scripts/    balance report, screenshots, perf
```

See `DECISIONS.md` for why things are the way they are, and `CREDITS.md` for what's borrowed (almost nothing).
