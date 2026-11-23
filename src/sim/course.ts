import { COINS, JUMP, LANES, OBSTACLES, baseSpeed, clamp, type ObstacleType } from '../config/tuning.ts';
import type { LevelConfig, PatternName, PowerupKind } from '../config/levels/types.ts';
import { PATTERNS, placeIntersection } from './patterns.ts';
import { Rng } from './rng.ts';

export interface Obstacle {
  id: number;
  type: ObstacleType;
  /** -1 when the obstacle spans lanes */
  lane: number;
  x: number;
  /** current distance along the route; movers walk toward the player */
  d: number;
  /** where the pattern intends the player to meet it */
  meet: number;
  speed: number;
  activateAt: number;
  hw: number;
  y0: number;
  y1: number;
  depth: number;
  /** 0..1, picks cosmetic variety (outfit, color) */
  variant: number;
  pose?: 'camera' | 'map';
  flip?: boolean;
  /** dogs: id of the walker holding the leash */
  leashedTo?: number;
  active: boolean;
  hit: boolean;
  knocked: boolean;
  gone: boolean;
  announced: boolean;
}

export interface Coin {
  id: number;
  x: number;
  y: number;
  d: number;
  value: number;
  group: number;
  variant: number;
  taken: boolean;
  magnetized: boolean;
}

export interface Powerup {
  id: number;
  kind: PowerupKind;
  lane: number;
  x: number;
  y: number;
  d: number;
  taken: boolean;
}

export interface Intersection {
  index: number;
  street: number;
  d0: number;
  d1: number;
}

export interface Zone {
  id: string;
  name: string;
  from: number;
  to: number;
}

export interface Course {
  level: LevelConfig;
  seed: number;
  obstacles: Obstacle[];
  coins: Coin[];
  powerups: Powerup[];
  intersections: Intersection[];
  zones: Zone[];
  /** total cash available on the route, in cents */
  pool: number;
}

export type Lane = 0 | 1 | 2;
const ALL_LANES: readonly Lane[] = [0, 1, 2];

/** How an obstacle must be passed if you stay in its lane. */
export type Clearance = 'jump' | 'slide' | 'dodge' | 'none';

export function clearanceOf(o: Pick<Obstacle, 'type' | 'y0' | 'y1'>): Clearance {
  if (OBSTACLES[o.type].harmless) return 'none';
  if (o.y0 > 0.5) return 'slide';
  if (o.y1 < 1.0) return 'jump';
  return 'dodge';
}

export function isTall(o: Pick<Obstacle, 'type' | 'y0' | 'y1'>): boolean {
  return clearanceOf(o) === 'dodge';
}

export function intersectionsOf(level: LevelConfig): Intersection[] {
  const { first, spacing, width, firstStreet, count } = level.crossStreets;
  return Array.from({ length: count }, (_, index) => {
    const d0 = first + spacing * index;
    return { index, street: firstStreet - index, d0, d1: d0 + width };
  });
}

export function zonesOf(level: LevelConfig, intersections: readonly Intersection[]): Zone[] {
  const byStreet = (street: number) => {
    const it = intersections.find(i => i.street === street);
    if (!it) throw new Error(`${level.id}: no cross street W ${street} St`);
    return it;
  };
  return level.districts.map(z => ({ id: z.id, name: z.name, from: byStreet(z.fromStreet).d0, to: byStreet(z.toStreet).d1 }));
}

/** Everything a pattern needs to place obstacles, cash and decide randomly. */
export class CourseBuilder {
  readonly rng: Rng;
  readonly obstacles: Obstacle[] = [];
  readonly coins: Coin[] = [];
  readonly powerups: Powerup[] = [];
  pool = 0;
  private groups = 0;

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  /** Places an obstacle so that, if it moves, it meets a player running at base speed at `meet`. */
  obstacle(type: ObstacleType, lane: number, meet: number, extra: Partial<Obstacle> = {}): Obstacle {
    const spec = OBSTACLES[type];
    const speed = spec.u ?? 0;
    const activateAt = spec.act ?? 0;
    const lead = speed ? (speed * activateAt) / (baseSpeed(meet) + speed) : 0;
    const o: Obstacle = {
      id: this.obstacles.length,
      type,
      lane,
      x: lane < 0 ? 0 : LANES.x[lane],
      d: meet + lead,
      meet,
      speed,
      activateAt,
      hw: spec.hw,
      y0: spec.h[0],
      y1: spec.h[1],
      depth: spec.depth,
      variant: this.rng.float(),
      active: !speed,
      hit: false,
      knocked: false,
      gone: false,
      announced: false,
      ...extra,
    };
    this.obstacles.push(o);
    return o;
  }

  coin(x: number, y: number, d: number, value: number, group: number): Coin {
    const c: Coin = { id: this.coins.length, x, y, d, value, group, variant: this.rng.float(), taken: false, magnetized: false };
    this.coins.push(c);
    this.pool += value;
    return c;
  }

  /** A line of dimes along a lane: the safe path. */
  coinLine(lane: number, d: number, count: number, spacing: number, y: number = COINS.lineHeight): void {
    const group = this.groups++;
    for (let i = 0; i < count; i++) this.coin(LANES.x[lane], y, d + i * spacing, COINS.value.dime, group);
  }

  /** Quarters along the jump parabola over `d`, optionally with a $1 bill at the apex: the risky path pays more. */
  coinArc(lane: number, d: number, withBill: boolean): void {
    const { count, tStart, tSpan, baseHeight } = COINS.arc;
    const apexT = JUMP.velocity / JUMP.gravity;
    const v = baseSpeed(d);
    const group = this.groups++;
    for (let i = 0; i < count; i++) {
      const t = tStart + (i / (count - 1)) * tSpan;
      const y = baseHeight + JUMP.velocity * t - (JUMP.gravity / 2) * t * t;
      const apex = i === (count - 1) / 2;
      this.coin(LANES.x[lane], y, d + (t - apexT) * v, withBill && apex ? COINS.value.single : COINS.value.quarter, group);
    }
  }

  powerup(kind: PowerupKind, lane: Lane, d: number, y: number): void {
    this.powerups.push({ id: this.powerups.length, kind, lane, x: LANES.x[lane], y, d, taken: false });
  }

  lane(): Lane {
    return this.rng.int(0, 2) as Lane;
  }

  /** A random lane that isn't any of `not`. */
  otherLane(...not: number[]): Lane {
    return this.rng.pick(ALL_LANES.filter(l => !not.includes(l)));
  }

  /** True if nothing you'd have to dodge sideways (too tall to jump, too low to slide under) is met in `lane` within [from, to]. */
  laneOpen(lane: Lane, from: number, to: number): boolean {
    const x = LANES.x[lane];
    return !this.obstacles.some(o => isTall(o) && Math.abs(o.x - x) < o.hw + 0.25 && o.meet > from && o.meet < to);
  }
}

function patternWeight(level: LevelConfig, name: PatternName, df: number, zone: Zone | undefined): number {
  const w = level.course.patterns.find(p => p.name === name);
  if (!w || df <= (w.minDifficulty ?? -1)) return 0;
  const multiplier = zone ? (level.districts.find(z => z.id === zone.id)?.weightMultipliers[name] ?? 1) : 1;
  return Math.max(0, (w.base + (w.perDifficulty ?? 0) * df) * multiplier);
}

function pickPattern(b: CourseBuilder, level: LevelConfig, df: number, room: number, zone: Zone | undefined): PatternName | null {
  const options = level.course.patterns
    .map(p => ({ name: p.name, weight: PATTERNS[p.name].length <= room ? patternWeight(level, p.name, df, zone) : 0 }))
    .filter(o => o.weight > 0);
  if (!options.length) return null;
  let r = b.rng.float() * options.reduce((sum, o) => sum + o.weight, 0);
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.name;
  }
  return options[options.length - 1].name;
}

function powerupBag(b: CourseBuilder, level: LevelConfig): PowerupKind[] {
  const kinds = level.powerups.bag.map(slot => (typeof slot === 'string' ? slot : b.rng.chance(slot.chance) ? slot.either[0] : slot.either[1]));
  return b.rng.shuffle(kinds);
}

/** Upgrades random dime lines to quarter lines until the route holds at least `minPool`. */
function topUpPool(b: CourseBuilder, minPool: number): void {
  const dimeGroups = [...new Set(b.coins.filter(c => c.value === COINS.value.dime).map(c => c.group))];
  b.rng.shuffle(dimeGroups);
  for (const group of dimeGroups) {
    if (b.pool >= minPool) return;
    for (const c of b.coins) {
      if (c.group !== group) continue;
      b.pool += COINS.value.quarter - c.value;
      c.value = COINS.value.quarter;
    }
  }
}

export function generateCourse(level: LevelConfig, seed: number): Course {
  const b = new CourseBuilder(seed);
  const { rng } = b;
  const cfg = level.course;
  const intersections = intersectionsOf(level);
  const zones = zonesOf(level, intersections);
  const end = level.length - cfg.endMargin;
  const kinds = powerupBag(b, level);
  const marks = level.powerups.at.map(at => at + rng.range(-level.powerups.jitter, level.powerups.jitter));

  let d = cfg.start;
  let lastIntersection = -1;
  let nextPowerup = 0;
  while (d < end) {
    const it = intersections.find(i => i.d1 + cfg.clearance > d && i.d0 < level.length);
    const df = clamp(d / level.length, 0, 1);
    const room = Math.min(it ? it.d0 - cfg.clearance : end, end) - d;
    const zone = zones.find(z => d > z.from && d < z.to);
    const name = room >= cfg.minRoom ? pickPattern(b, level, df, room, zone) : null;
    if (!name) {
      if (it && it.index !== lastIntersection) {
        placeIntersection(b, it, level);
        lastIntersection = it.index;
        d = it.d1 + rng.range(cfg.afterIntersection[0], cfg.afterIntersection[1]);
      } else {
        d += cfg.idleStep;
      }
      continue;
    }

    PATTERNS[name].place(b, d, df);

    // A power-up waits in the gap just before the pattern, in a lane that isn't blocked right after it.
    if (nextPowerup < marks.length && d > marks[nextPowerup]) {
      const pd = d - level.powerups.lead;
      const lane = rng.shuffle([0, 1, 2] as Lane[]).find(l => b.laneOpen(l, pd - 2, pd + 10)) ?? b.lane();
      b.powerup(kinds[nextPowerup], lane, pd, level.powerups.height);
      nextPowerup++;
    }
    d += PATTERNS[name].length + (cfg.gap.easy + (cfg.gap.hard - cfg.gap.easy) * df) + rng.range(0, cfg.gap.jitter);
  }

  // Victory dimes up the middle into Penn.
  const fc = level.finishCoins;
  b.coinLine(fc.lane, level.length - fc.before, fc.count, fc.spacing);

  // One $5 bill on a jump-arc apex deep in the route (or, if that stretch has no arcs, its highest coin).
  const bill = level.bonusBill;
  const inRange = b.coins.filter(c => c.d > bill.from && c.d < bill.to);
  const apexes = inRange.filter(c => c.y > bill.minHeight);
  const five = apexes.length ? rng.pick(apexes) : inRange.reduce((hi, c) => (c.y > hi.y ? c : hi));
  b.pool += COINS.value.five - five.value;
  five.value = COINS.value.five;

  // An express this late would have nowhere to land; it becomes a cat instead.
  for (const p of b.powerups) if (p.kind === 'express' && p.d > level.length - level.powerups.expressCutoff) p.kind = 'cat';

  topUpPool(b, cfg.minPool);

  return { level, seed, obstacles: b.obstacles, coins: b.coins, powerups: b.powerups, intersections, zones, pool: b.pool };
}
