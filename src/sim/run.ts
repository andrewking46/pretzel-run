import { COINS, NEAR_MISS, PLAYER, POWERUPS, RUN, SIM_DT, baseSpeed } from '../config/tuning.ts';
import type { LevelConfig } from '../config/levels/types.ts';
import { hitsObstacle, overlapsLaterally, reachesCoin, reachesPowerup } from './collisions.ts';
import { clearanceOf, generateCourse, isTall, type Coin, type Course, type Obstacle, type Powerup } from './course.ts';
import { stumbleLoss, tierFor } from './economy.ts';
import type { RunResult, SimEvent } from './events.ts';
import { Player, type Action } from './player.ts';

export type RunMode = 'countdown' | 'run' | 'finish' | 'sold-out' | 'result';

export interface RunOptions {
  /** false: nothing can hit the player (used to measure the course itself) */
  collisions?: boolean;
  /** false: coins and power-ups can't be picked up */
  pickups?: boolean;
}

/** Items near the player, admitted as the player approaches and dropped once behind or finished. Kept in id order. */
class LiveWindow<T extends { id: number; d: number }> {
  readonly items: T[] = [];
  private readonly queue: T[];
  private next = 0;

  constructor(all: readonly T[]) {
    this.queue = [...all].sort((a, b) => a.d - b.d || a.id - b.id);
  }

  advance(dist: number, ahead: number, behind: number, finished: (item: T) => boolean): void {
    while (this.next < this.queue.length && this.queue[this.next].d - dist <= ahead) {
      const item = this.queue[this.next++];
      let i = this.items.length;
      while (i > 0 && this.items[i - 1].id > item.id) i--;
      this.items.splice(i, 0, item);
    }
    let kept = 0;
    for (const item of this.items) if (!finished(item) && item.d - dist >= behind) this.items[kept++] = item;
    this.items.length = kept;
  }
}

/** One run down the level: fixed-step simulation, no rendering, no DOM. */
export class Run {
  readonly course: Course;
  readonly player = new Player();
  readonly level: LevelConfig;
  readonly options: Required<RunOptions>;

  mode: RunMode = 'countdown';
  countdown = RUN.countdown;
  t = 0;
  dist = 0;
  speed = 0;
  timeLeft: number;
  cash = 0;
  found = 0;
  stumbles = 0;
  sliceT = 0;
  catT = 0;
  expressT = 0;
  expressFrom = 0;
  expressTo = 0;
  endT = 0;
  street: number;
  result: RunResult | null = null;

  private events: SimEvent[] = [];
  private readonly obstacleWindow: LiveWindow<Obstacle>;
  private readonly coinWindow: LiveWindow<Coin>;
  private readonly lastLinedUp: Float64Array;
  private readonly passed: Uint8Array;
  private nextStreet = 0;

  constructor(level: LevelConfig, seed: number, options: RunOptions = {}) {
    this.level = level;
    this.course = generateCourse(level, seed);
    this.options = { collisions: true, pickups: true, ...options };
    this.timeLeft = level.timeLimit;
    this.street = level.startStreet;
    this.obstacleWindow = new LiveWindow(this.course.obstacles);
    this.coinWindow = new LiveWindow(this.course.coins);
    this.lastLinedUp = new Float64Array(this.course.obstacles.length).fill(-Infinity);
    this.passed = new Uint8Array(this.course.obstacles.length);
  }

  get seed(): number {
    return this.course.seed;
  }

  get express(): boolean {
    return this.expressT > 0;
  }

  /** Obstacles inside the simulation window, in id order. */
  get nearbyObstacles(): readonly Obstacle[] {
    return this.obstacleWindow.items;
  }

  get nearbyCoins(): readonly Coin[] {
    return this.coinWindow.items;
  }

  get progress(): number {
    return Math.min(1, this.dist / this.level.length);
  }

  /** Skip the countdown (tests, tools). */
  start(): void {
    if (this.mode === 'countdown') this.mode = 'run';
  }

  input(action: Action): void {
    if (this.mode !== 'run' || this.express) return;
    const done = this.player.act(action);
    if (done) this.emit({ type: 'move', action: done });
  }

  /** Returns and clears the events emitted since the last drain. */
  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  step(dt: number = SIM_DT): void {
    this.t += dt;
    if (this.mode === 'countdown') return this.tickCountdown(dt);
    if (this.mode === 'result' || this.advance(dt)) return;
    this.movePlayer(dt);
    this.updateObstacles(dt);
    this.updateCoins(dt);
    this.updatePowerups();
    this.trackStreet();
  }

  private emit(e: SimEvent): void {
    this.events.push(e);
  }

  private tickCountdown(dt: number): void {
    const before = Math.ceil(this.countdown);
    this.countdown -= dt;
    const now = Math.ceil(this.countdown);
    if (now !== before && now > 0 && now <= 3) this.emit({ type: 'countdown', n: now });
    if (this.countdown <= 0) {
      this.mode = 'run';
      this.emit({ type: 'go' });
    }
  }

  /** Forward motion, power-up timers, express travel and the run/finish/sold-out transitions. Returns true once the run is over. */
  private advance(dt: number): boolean {
    const p = this.player;
    let v = baseSpeed(this.dist) * p.speedFactor(dt);
    if (this.sliceT > 0) {
      this.sliceT -= dt;
      v *= POWERUPS.slice.speedFactor;
    }
    if (this.catT > 0) this.catT -= dt;

    let landed = false;
    if (this.expressT > 0) {
      this.expressT -= dt;
      v = (this.expressTo - this.expressFrom) / POWERUPS.express.duration;
      landed = this.expressT <= 0;
    }
    if (this.mode === 'finish') v = baseSpeed(this.dist) * RUN.finishCoastFactor;
    if (this.mode === 'sold-out') v = Math.max(0, this.speed - RUN.soldOutDecel * dt);

    this.speed = v;
    this.dist = landed ? this.expressTo : this.dist + v * dt;
    if (landed) this.landExpress();

    if (this.mode === 'run') {
      const before = Math.ceil(this.timeLeft);
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      const now = Math.ceil(this.timeLeft);
      if (now !== before && now <= RUN.tickBelow && now > 0) this.emit({ type: 'tick', seconds: now });
      if (this.dist >= this.level.length) {
        this.mode = 'finish';
        this.endT = 0;
        this.emit({ type: 'finish' });
      } else if (this.timeLeft <= 0) {
        this.mode = 'sold-out';
        this.endT = 0;
        this.emit({ type: 'sold-out' });
      }
      return false;
    }
    this.endT += dt;
    const limit = this.mode === 'finish' ? RUN.finishCoastTime : RUN.soldOutTime;
    if (this.endT <= limit) return false;
    this.complete();
    return true;
  }

  private movePlayer(dt: number): void {
    const landing = this.player.update(dt);
    if (this.mode === 'finish' || this.mode === 'sold-out') this.player.lane = 1;
    if (landing) this.emit({ type: 'land', then: landing === 'land-slide' ? 'slide' : landing === 'land-jump' ? 'jump' : null });
  }

  private updateObstacles(dt: number): void {
    const p = this.player;
    const running = this.mode === 'run' && !this.express;
    this.obstacleWindow.advance(this.dist, RUN.windowAhead, RUN.windowBehind, o => o.gone);
    for (const o of this.obstacleWindow.items) {
      if (!o.active && o.d - this.dist < o.activateAt) {
        o.active = true;
        this.emit({ type: 'activate', obstacle: o });
      }
      if (o.active && o.speed && !o.hit) o.d -= o.speed * dt;
      const z = o.d - this.dist;

      if (!o.announced && ((o.type === 'cab' && z > 0 && z < RUN.honkRange) || (o.type === 'pigeons' && z < RUN.pigeonScareRange))) {
        o.announced = true;
        this.emit({ type: 'announce', obstacle: o });
      }
      if (clearanceOf(o) === 'none' || !running || o.hit) continue;
      if (isTall(o)) this.watchNearMiss(o, z);
      if (!this.options.collisions || !hitsObstacle(p, o, z)) continue;
      if (this.sliceT > 0) {
        o.hit = true;
        o.knocked = true;
        this.emit({ type: 'knock', obstacle: o });
        continue;
      }
      if (p.invulnerableT > 0) continue;
      o.hit = true;
      this.stumble(o);
    }
  }

  private watchNearMiss(o: Obstacle, z: number): void {
    const p = this.player;
    if (z > 0) {
      if (overlapsLaterally(p.x, o)) this.lastLinedUp[o.id] = this.t;
      return;
    }
    if (this.passed[o.id] || z > -(o.depth / 2 + PLAYER.halfDepth)) return;
    this.passed[o.id] = 1;
    if (this.sliceT <= 0 && !overlapsLaterally(p.x, o) && this.t - this.lastLinedUp[o.id] <= NEAR_MISS.window) {
      this.emit({ type: 'near-miss', obstacle: o });
    }
  }

  private stumble(o: Obstacle): void {
    this.stumbles++;
    this.player.stumble();
    const loss = stumbleLoss(this.cash);
    this.cash -= loss;
    this.emit({ type: 'hit', obstacle: o, loss });
  }

  private updateCoins(dt: number): void {
    this.coinWindow.advance(this.dist, COINS.windowAhead, COINS.windowBehind, c => c.taken);
    if (!this.options.pickups || this.express) return;
    const p = this.player;
    const cat = POWERUPS.cat;
    for (const c of this.coinWindow.items) {
      if (c.taken) continue;
      let z = c.d - this.dist;
      if (this.catT > 0 && z < cat.range && z > cat.behind) {
        c.magnetized = true;
        const k = Math.min(1, dt * cat.pullRate);
        c.x += (p.x - c.x) * k;
        c.y += (p.y + cat.targetHeight - c.y) * k;
        c.d -= z * k * cat.depthPull;
        z = c.d - this.dist;
      }
      if (!reachesCoin(p, c, z)) continue;
      c.taken = true;
      this.cash += c.value;
      this.found += c.value;
      this.emit({ type: 'coin', coin: c });
    }
  }

  private updatePowerups(): void {
    if (!this.options.pickups || this.express || this.mode !== 'run') return;
    for (const pw of this.course.powerups) {
      if (pw.taken) continue;
      const z = pw.d - this.dist;
      if (z > POWERUPS.windowAhead || z < POWERUPS.windowBehind || !reachesPowerup(this.player, pw, z)) continue;
      pw.taken = true;
      this.applyPowerup(pw);
    }
  }

  private applyPowerup(pw: Powerup): void {
    this.emit({ type: 'powerup', powerup: pw });
    if (pw.kind === 'slice') this.sliceT = POWERUPS.slice.duration;
    else if (pw.kind === 'cat') this.catT = POWERUPS.cat.duration;
    else this.boardExpress();
  }

  private boardExpress(): void {
    const ex = POWERUPS.express;
    const span = Math.min(ex.distance, this.level.length - ex.finishMargin - this.dist);
    if (span <= ex.minDistance) return;
    this.expressT = ex.duration;
    this.expressFrom = this.dist;
    this.expressTo = this.dist + span;
    // Alex is in the subway car now: whatever he was doing on the sidewalk is over.
    const p = this.player;
    Object.assign(p, { y: 0, vy: 0, air: false, slideT: 0, fastFall: false, jumpBuffer: 0, stumbleT: 0, recoverT: 0 });
    this.emit({ type: 'express-start', from: this.expressFrom, to: this.expressTo });
  }

  private landExpress(): void {
    const ex = POWERUPS.express;
    this.player.invulnerableT = ex.landingInvulnerable;
    for (const o of this.course.obstacles) {
      if (o.type !== 'pigeons' && o.d > this.dist - ex.clearBehind && o.d < this.dist + ex.clearAhead) o.gone = true;
    }
    this.emit({ type: 'express-land' });
  }

  private trackStreet(): void {
    const ints = this.course.intersections;
    while (this.nextStreet < ints.length && ints[this.nextStreet].d0 <= this.dist + 1) {
      this.street = ints[this.nextStreet++].street;
      this.emit({ type: 'street', street: this.street });
    }
  }

  private complete(): void {
    const finished = this.mode === 'finish';
    const tier = finished ? tierFor(this.cash) : null;
    const pool = this.course.pool;
    this.result = {
      finished,
      stars: tier ? tier.stars : 0,
      tier,
      cash: this.cash,
      timeLeft: finished ? this.timeLeft : 0,
      stumbles: this.stumbles,
      found: this.found,
      pool,
      foundPct: pool ? Math.round((this.found / pool) * 100) : 0,
      street: this.street,
    };
    this.mode = 'result';
    this.emit({ type: 'result', result: this.result });
  }
}
