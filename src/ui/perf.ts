import type { Game } from '../game.ts';

// ?perf overlay: rolling frame-time stats and draw calls, tap to copy. For checking real phones.

export class PerfMeter {
  private readonly el = document.getElementById('perf')!;
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
    this.el.classList.remove('hidden');
    this.el.onclick = () => void navigator.clipboard?.writeText(this.el.textContent ?? '').catch(() => {});
    setInterval(() => this.render(), 500);
  }

  private render(): void {
    const t = this.game.frameTimes.slice(-240);
    if (!t.length) return;
    const sorted = [...t].sort((a, b) => a - b);
    const avg = t.reduce((a, b) => a + b, 0) / t.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const info = this.game.stage.renderer.info.render;
    const r = this.game.stage.renderer;
    this.el.textContent = [
      `tier ${this.game.stage.currentTier}  dpr ${r.getPixelRatio().toFixed(2)}`,
      `avg ${avg.toFixed(1)}ms  p95 ${p95.toFixed(1)}ms  max ${sorted[sorted.length - 1].toFixed(1)}ms`,
      `fps ${(1000 / avg).toFixed(0)}  draws ${info.calls}  tris ${(info.triangles / 1000).toFixed(0)}k`,
      `${navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 60)}`,
    ].join('\n');
  }
}
