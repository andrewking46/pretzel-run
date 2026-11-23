import { JUMP, LANES, PLAYER, SLIDE, STUMBLE } from '../config/tuning.ts';

export type Action = 'left' | 'right' | 'jump' | 'slide';

/** What happened to the player during a physics step, for the run to turn into events. */
export type Landing = 'land' | 'land-slide' | 'land-jump' | null;

export class Player {
  lane = 1;
  x = 0;
  y = 0;
  vy = 0;
  air = false;
  slideT = 0;
  stumbleT = 0;
  recoverT = 0;
  invulnerableT = 0;
  jumpBuffer = 0;
  fastFall = false;

  get sliding(): boolean {
    return this.slideT > 0 && !this.air;
  }

  get stumbling(): boolean {
    return this.stumbleT > 0;
  }

  /** Current body height for collisions. */
  get height(): number {
    return this.sliding ? SLIDE.height : PLAYER.height;
  }

  /** Multiplier on forward speed from stumbling and recovering. Advances those timers. */
  speedFactor(dt: number): number {
    if (this.stumbleT > 0) {
      this.stumbleT -= dt;
      return STUMBLE.speedFactor;
    }
    if (this.recoverT > 0) {
      this.recoverT = Math.max(0, this.recoverT - dt);
      return 1 - (1 - STUMBLE.speedFactor) * (this.recoverT / STUMBLE.recovery);
    }
    return 1;
  }

  /** Applies an input. Returns the action that actually took effect, if any. */
  act(action: Action): Action | 'fast-fall' | null {
    switch (action) {
      case 'left':
        if (this.lane === 0) return null;
        this.lane--;
        return action;
      case 'right':
        if (this.lane === 2) return null;
        this.lane++;
        return action;
      case 'jump':
        if (this.air) {
          this.jumpBuffer = JUMP.bufferTime;
          return null;
        }
        this.takeOff();
        return action;
      case 'slide':
        if (this.air) {
          this.vy = SLIDE.fastFallVelocity;
          this.fastFall = true;
          return 'fast-fall';
        }
        if (this.slideT > 0) return null;
        this.slideT = SLIDE.duration;
        return action;
    }
  }

  update(dt: number): Landing {
    const dx = LANES.x[this.lane] - this.x;
    const step = LANES.changeSpeed * dt;
    this.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;

    let landing: Landing = null;
    if (this.air) {
      // Exact for constant gravity, so the jump traces the same parabola the quarter arcs are laid on.
      this.y += this.vy * dt - 0.5 * JUMP.gravity * dt * dt;
      this.vy -= JUMP.gravity * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.air = false;
        this.vy = 0;
        landing = 'land';
        if (this.fastFall) {
          this.fastFall = false;
          this.slideT = SLIDE.duration;
          landing = 'land-slide';
        } else if (this.jumpBuffer > 0) {
          this.takeOff();
          landing = 'land-jump';
        }
      }
    }
    if (this.slideT > 0) this.slideT -= dt;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.invulnerableT > 0) this.invulnerableT -= dt;
    return landing;
  }

  stumble(): void {
    this.stumbleT = STUMBLE.duration;
    this.recoverT = STUMBLE.recovery;
    this.invulnerableT = STUMBLE.invulnerable;
    this.slideT = 0;
  }

  clone(): Player {
    const q = new Player();
    q.lane = this.lane;
    q.x = this.x;
    q.y = this.y;
    q.vy = this.vy;
    q.air = this.air;
    q.slideT = this.slideT;
    q.stumbleT = this.stumbleT;
    q.recoverT = this.recoverT;
    q.invulnerableT = this.invulnerableT;
    q.jumpBuffer = this.jumpBuffer;
    q.fastFall = this.fastFall;
    return q;
  }

  private takeOff(): void {
    this.air = true;
    this.vy = JUMP.velocity;
    this.slideT = 0;
    this.jumpBuffer = 0;
  }
}
