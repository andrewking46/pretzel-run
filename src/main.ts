import './style.css';
import { Game } from './game.ts';
import { autoplay, Autopilot } from './sim/autopilot.ts';
import { PerfMeter } from './ui/perf.ts';

// Boot: wait (briefly) for the display fonts so painted signs use them, then start.

async function boot(): Promise<void> {
  const fonts = Promise.all(['400 40px "Bebas Neue"', '800 20px Archivo'].map(f => document.fonts?.load(f).catch(() => null)));
  await Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]);
  const game = new Game(document.getElementById('stage')!);

  if (new URLSearchParams(location.search).has('perf')) new PerfMeter(game);

  if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
    // Test hook for Playwright and the console. Stripped from production builds.
    (window as unknown as Record<string, unknown>).__PR = {
      game,
      get run() {
        return game.current;
      },
      get mode() {
        return game.state;
      },
      start: (daily = false, seed?: number) => game.start(daily, seed),
      autopilot: (on = true) => (game.autopilot = on ? new Autopilot() : null),
      autoplay,
      speed: (k: number) => (game.timeScale = k),
      frameTimes: () => [...game.frameTimes],
      renderInfo: () => ({ ...game.stage.renderer.info.render }),
      tier: () => game.stage.currentTier,
      /** jump the current run to distance d (screenshots, perf runs) */
      teleport(d: number) {
        const r = game.current;
        if (!r) return;
        r.start();
        r.dist = d;
        game.stage.prime();
      },
      /** drop an express card right in front of Alex */
      forceExpress() {
        const r = game.current;
        if (!r) return;
        r.course.powerups.push({ id: 900 + r.course.powerups.length, kind: 'express', lane: r.player.lane as 0 | 1 | 2, x: r.player.x, y: 0.8, d: r.dist + 0.3, taken: false });
      },
    };
  }
}

void boot();
