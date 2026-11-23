import { LANES, PLAYER } from '../config/tuning.ts';
import { clearanceOf, type Obstacle } from './course.ts';
import type { Run } from './run.ts';

// The autopilot from the prototype, ported. It plays a near-perfect, cash-greedy run and is the yardstick
// for tuning ("a perfect bot gets 3 stars about 85% of the time"). Sloppier profiles approximate people.

export interface AutopilotProfile {
  /** seconds between lane decisions */
  laneCooldown: number;
  /** how much it wants cash relative to safety */
  greed: number;
  /** jump when a low obstacle is this many seconds away */
  jumpLead: number;
  slideLead: number;
  /** extra seconds added to every reaction (people are slower than code) */
  reaction: number;
}

export const PERFECT: AutopilotProfile = { laneCooldown: 0.14, greed: 0.05, jumpLead: 0.22, slideLead: 0.2, reaction: 0 };

interface LaneThreats {
  tall: number;
  low: number;
  high: number;
}

export class Autopilot {
  private cooldown = 0;
  private readonly profile: AutopilotProfile;

  constructor(profile: AutopilotProfile = PERFECT) {
    this.profile = profile;
  }

  step(run: Run, dt: number): void {
    if (run.mode !== 'run' || run.express) return;
    this.cooldown -= dt;
    const pr = this.profile;
    const p = run.player;
    const v = Math.max(run.speed, 8);
    const ahead = run.nearbyObstacles.filter(o => !o.gone && !o.hit && clearanceOf(o) !== 'none' && o.d - run.dist > -2.5 && o.d - run.dist < 40);
    const timeTo = (o: Obstacle) => (o.d - run.dist - o.depth / 2) / (v + (o.active ? o.speed : 0)) - pr.reaction;

    const threats = [0, 1, 2].map((lane): LaneThreats => {
      const t = { tall: 99, low: 99, high: 99 };
      for (const o of ahead) {
        if (Math.abs(LANES.x[lane] - o.x) > o.hw + PLAYER.halfWidth) continue;
        const c = clearanceOf(o);
        const when = timeTo(o);
        if (c === 'slide') t.high = Math.min(t.high, when);
        else if (c === 'jump') t.low = Math.min(t.low, when);
        else t.tall = Math.min(t.tall, when);
      }
      return t;
    });
    const cash = [0, 1, 2].map(lane => {
      let n = 0;
      for (const c of run.nearbyCoins) {
        const z = c.d - run.dist;
        if (!c.taken && z >= 0 && z <= 25 && Math.abs(c.x - LANES.x[lane]) < 0.5) n += c.value;
      }
      return n;
    });

    const cur = p.lane;
    const score = (l: number) => Math.min(threats[l].tall, 3) * 100 + cash[l] * pr.greed - Math.abs(l - cur) * 3 + (l === cur ? 5 : 0);
    if (this.cooldown <= 0) {
      let best = cur;
      for (const l of [0, 1, 2]) if (score(l) > score(best)) best = l;
      if (best !== cur) {
        const next = best > cur ? cur + 1 : cur - 1;
        if (threats[next].tall > 0.18) {
          run.input(best > cur ? 'right' : 'left');
          this.cooldown = pr.laneCooldown;
        }
      }
    }
    const here = threats[p.lane];
    if (here.low < pr.jumpLead && here.low > 0 && !p.air) run.input('jump');
    if (here.high < pr.slideLead && here.high > 0 && !(p.slideT > 0)) run.input('slide');
  }
}

/** Plays a whole run with the autopilot and returns it finished. */
export function autoplay(run: Run, profile: AutopilotProfile = PERFECT, dt = 1 / 120): Run {
  const pilot = new Autopilot(profile);
  run.start();
  for (let i = 0; i < 120 * 300 && run.mode !== 'result'; i++) {
    run.step(dt);
    pilot.step(run, dt);
    run.drainEvents();
  }
  return run;
}
