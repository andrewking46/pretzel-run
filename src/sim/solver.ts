import { LANES, PLAYER, SIM_DT, SIM_HZ } from '../config/tuning.ts';
import type { LevelConfig } from '../config/levels/types.ts';
import { hitsObstacle } from './collisions.ts';
import { clearanceOf, type Obstacle } from './course.ts';
import { Player, type Action } from './player.ts';
import { Run } from './run.ts';

// Proves a course can be run end to end without a single hit.
//
// With no hits and no power-ups, the player's speed depends only on distance, so every obstacle moves
// the same way whatever the player does. That lets one shared world advance while we track the set of
// every distinct player state reachable without a collision, branching on each possible input at
// `decisionHz`. If that set is ever empty, no input sequence survives; if it reaches the finish, one does.

export interface SolveResult {
  solved: boolean;
  /** how far the longest surviving path got */
  reached: number;
  /** most distinct player states tracked at once */
  peakStates: number;
}

const ACTIONS: readonly Action[] = ['left', 'right', 'jump', 'slide'];

// States that land in the same bucket are merged and one real representative is kept. Merging can only
// make the search miss a path, never invent one, so a "solved" verdict is always backed by real inputs.
function stateKey(p: Player): number {
  const lane = p.lane;
  const x = Math.round(p.x * 2.5) + 8;
  const y = Math.round(p.y * 5);
  const vy = Math.round(p.vy * 0.5) + 16;
  const slide = Math.ceil(p.slideT * 6);
  const flags = (p.air ? 1 : 0) | (p.fastFall ? 2 : 0);
  return ((((lane * 32 + x) * 32 + y) * 64 + vy) * 16 + slide) * 4 + flags;
}

function branch(frontier: readonly Player[]): Player[] {
  const next = new Map<number, Player>();
  const add = (p: Player) => {
    const k = stateKey(p);
    if (!next.has(k)) next.set(k, p);
  };
  for (const p of frontier) {
    add(p);
    for (const a of ACTIONS) {
      if (a === 'jump' && p.air) continue;
      const q = p.clone();
      if (q.act(a)) add(q);
    }
  }
  return [...next.values()];
}

/** Any state can be grounded, done sliding and centred in any lane within ~0.85 s; nothing can reach contact for ~1.5 s. */
const OPEN_ROAD = 40;

function openRoadAhead(world: Run): boolean {
  return !world.nearbyObstacles.some(o => !o.gone && clearanceOf(o) !== 'none' && o.d - world.dist > -3 && o.d - world.dist < OPEN_ROAD);
}

function settledInEveryLane(): Player[] {
  return [0, 1, 2].map(lane => {
    const p = new Player();
    p.lane = lane;
    p.x = LANES.x[lane];
    return p;
  });
}

export function solveCourse(level: LevelConfig, seed: number, decisionHz = 30): SolveResult {
  const world = new Run(level, seed, { collisions: false, pickups: false });
  world.start();
  const every = Math.max(1, Math.round(SIM_HZ / decisionHz));
  let frontier = [new Player()];
  let peakStates = 1;

  for (let step = 0; world.mode === 'run'; step++) {
    if (step % every === 0) {
      // On open road every surviving state can settle into any lane long before the next obstacle
      // arrives, so the reachable set is just "standing in some lane".
      frontier = openRoadAhead(world) ? settledInEveryLane() : branch(frontier);
      peakStates = Math.max(peakStates, frontier.length);
    }
    world.step(SIM_DT);
    world.drainEvents();
    const contact: Obstacle[] = world.nearbyObstacles.filter(
      o => !o.gone && clearanceOf(o) !== 'none' && Math.abs(o.d - world.dist) <= o.depth / 2 + PLAYER.halfDepth,
    );
    const survivors: Player[] = [];
    for (const p of frontier) {
      p.update(SIM_DT);
      if (!contact.some(o => hitsObstacle(p, o, o.d - world.dist))) survivors.push(p);
    }
    frontier = survivors;
    if (!frontier.length) return { solved: false, reached: world.dist, peakStates };
  }
  return { solved: world.mode === 'finish' || world.dist >= level.length, reached: world.dist, peakStates };
}
