// Headless balance report: plays N seeds with the autopilot and prints the numbers tuning targets refer to.
// Usage: node scripts/sim-report.ts [seeds=500] [profile=perfect|casual]
import { LEVEL2 } from '../src/config/levels/level2.ts';
import { autoplay, PERFECT, type AutopilotProfile } from '../src/sim/autopilot.ts';
import { formatMoney } from '../src/sim/economy.ts';
import type { RunResult } from '../src/sim/events.ts';
import { Run } from '../src/sim/run.ts';

const CASUAL: AutopilotProfile = { laneCooldown: 0.3, greed: 0.02, jumpLead: 0.22, slideLead: 0.2, reaction: 0.12 };

const n = Number(process.argv[2] ?? 500);
const profile = process.argv[3] === 'casual' ? CASUAL : PERFECT;
const rows: (RunResult & { express: boolean })[] = [];
const t0 = performance.now();
for (let s = 1; s <= n; s++) {
  const seed = Math.imul(s, 2654435761) >>> 0;
  const run = autoplay(new Run(LEVEL2, seed), profile);
  const r = run.result!;
  const express = run.course.powerups.find(p => p.kind === 'express' && p.taken);
  rows.push({ ...r, express: !!express });
}
const ms = performance.now() - t0;
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (f: (r: (typeof rows)[number]) => boolean) => `${((rows.filter(f).length / n) * 100).toFixed(1)}%`;
const pools = rows.map(r => r.pool);
console.log(`${n} seeds, ${process.argv[3] ?? 'perfect'} autopilot, ${(ms / n).toFixed(1)} ms/run`);
console.log(`pool    min ${formatMoney(Math.min(...pools))}  avg ${formatMoney(Math.round(avg(pools)))}  max ${formatMoney(Math.max(...pools))}`);
console.log(`cash    avg ${formatMoney(Math.round(avg(rows.map(r => r.cash))))}  found ${avg(rows.map(r => r.foundPct)).toFixed(1)}% of pool`);
console.log(`stars   3★ ${pct(r => r.stars === 3)}  2★ ${pct(r => r.stars === 2)}  1★ ${pct(r => r.stars === 1)}  0★ ${pct(r => r.stars === 0)}  sold out ${pct(r => !r.finished)}`);
console.log(`stumble avg ${avg(rows.map(r => r.stumbles)).toFixed(3)}  ≤1 on ${pct(r => r.stumbles <= 1)}  max ${Math.max(...rows.map(r => r.stumbles))}`);
console.log(`time    left avg ${avg(rows.map(r => r.timeLeft)).toFixed(1)}s  min ${Math.min(...rows.map(r => r.timeLeft)).toFixed(1)}s   express ridden ${pct(r => r.express)}`);
