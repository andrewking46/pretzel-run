import { describe, expect, it } from 'vitest';
import { LEVEL2 } from '../../src/config/levels/level2.ts';
import { JUMP, LANES, POWERUPS, SIM_DT, STUMBLE, baseSpeed } from '../../src/config/tuning.ts';
import type { SimEvent } from '../../src/sim/events.ts';
import { Player } from '../../src/sim/player.ts';
import { Run } from '../../src/sim/run.ts';
import { testSeeds } from '../helpers/seeds.ts';

const ghost = (seed = 1) => {
  const run = new Run(LEVEL2, seed, { collisions: false, pickups: false });
  run.start();
  return run;
};

/** A run where the only thing on the road is one static tourist, `ahead` meters away in the player's lane. */
const lonelyTourist = (seed: number, ahead = 0.4) => {
  const run = new Run(LEVEL2, seed, { pickups: false });
  run.start();
  const target = run.course.obstacles.find(o => o.type === 'tourist' && o.meet > 300)!;
  for (const o of run.course.obstacles) if (o !== target) o.gone = true;
  run.dist = target.d - ahead;
  run.player.lane = target.lane;
  run.player.x = target.x;
  return run;
};

const stepFor = (run: Run, seconds: number, events: SimEvent[] = []) => {
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
    run.step();
    events.push(...run.drainEvents());
  }
  return events;
};

describe('player movement', () => {
  it('jumps about 1.3 m high for about 0.70 s', () => {
    const p = new Player();
    p.act('jump');
    let peak = 0;
    let t = 0;
    while (p.air) {
      p.update(SIM_DT);
      peak = Math.max(peak, p.y);
      t += SIM_DT;
    }
    expect(peak).toBeCloseTo(JUMP.velocity ** 2 / (2 * JUMP.gravity), 1);
    expect(peak).toBeGreaterThan(1.28);
    expect(t).toBeGreaterThan(0.69);
    expect(t).toBeLessThan(0.72);
  });

  it('changes lanes at 13 m/s', () => {
    const p = new Player();
    p.act('right');
    let t = 0;
    while (p.x < LANES.x[2]) {
      p.update(SIM_DT);
      t += SIM_DT;
    }
    expect(t).toBeCloseTo(1.6 / 13, 1);
  });

  it('buffers a jump pressed up to 0.16 s before landing', () => {
    const late = new Player();
    late.act('jump');
    while (late.vy > 0 || late.y > 0.3) late.update(SIM_DT);
    late.act('jump');
    while (late.air && late.y > 0) {
      if (late.update(SIM_DT) === 'land-jump') break;
    }
    expect(late.air).toBe(true);

    const early = new Player();
    early.act('jump');
    for (let i = 0; i < 12; i++) early.update(SIM_DT);
    early.act('jump');
    let landing = null;
    while (!landing) landing = early.update(SIM_DT);
    expect(landing).toBe('land');
  });

  it('fast-falls when sliding mid-air and slides on landing', () => {
    const p = new Player();
    p.act('jump');
    for (let i = 0; i < 20; i++) p.update(SIM_DT);
    expect(p.act('slide')).toBe('fast-fall');
    expect(p.vy).toBe(-16);
    let landing = null;
    while (!landing) landing = p.update(SIM_DT);
    expect(landing).toBe('land-slide');
    expect(p.sliding).toBe(true);
    expect(p.height).toBe(0.75);
  });

  it('ramps speed from 11 to 17.5 m/s over the first 1100 m', () => {
    expect(baseSpeed(0)).toBe(11);
    expect(baseSpeed(550)).toBe(14.25);
    expect(baseSpeed(1100)).toBe(17.5);
    expect(baseSpeed(1396)).toBe(17.5);
  });
});

describe('a run', () => {
  it('counts down 3, 2, 1, then goes', () => {
    const run = new Run(LEVEL2, 1);
    const events = stepFor(run, 3.3).map(e => (e.type === 'countdown' ? e.n : e.type));
    expect(events).toEqual([3, 2, 1, 'go']);
    expect(run.mode).toBe('run');
  });

  it('stumbles: 12% speed, linear recovery, 1.5 s of invulnerability, drops 20% of cash', () => {
    const run = lonelyTourist(1);
    run.cash = 1000;
    const events = stepFor(run, 0.2);
    expect(events.filter(e => e.type === 'hit')).toHaveLength(1);
    expect(run.stumbles).toBe(1);
    expect(run.cash).toBe(800);
    expect(run.speed / baseSpeed(run.dist)).toBeCloseTo(STUMBLE.speedFactor, 5);
    stepFor(run, STUMBLE.duration - 0.2 + STUMBLE.recovery / 2);
    expect(run.speed / baseSpeed(run.dist)).toBeCloseTo((1 + STUMBLE.speedFactor) / 2, 1);
    stepFor(run, STUMBLE.recovery / 2 + 0.05);
    expect(run.speed / baseSpeed(run.dist)).toBeCloseTo(1, 3);
    expect(run.player.invulnerableT).toBeGreaterThan(0);
    stepFor(run, 0.2);
    expect(run.player.invulnerableT).toBeLessThanOrEqual(0);
  });

  it('sells out when the clock runs down, ticking through the last 10 seconds', () => {
    const run = ghost();
    run.timeLeft = 10.5;
    const events = stepFor(run, 12.5);
    expect(events.filter(e => e.type === 'tick').map(e => (e.type === 'tick' ? e.seconds : 0))).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(events.some(e => e.type === 'sold-out')).toBe(true);
    expect(run.mode).toBe('result');
    expect(run.result).toMatchObject({ finished: false, stars: 0 });
  });

  it('finishes at Penn and prices the order', () => {
    const run = ghost();
    run.cash = 1500;
    stepFor(run, 120);
    expect(run.result).toMatchObject({ finished: true, stars: 2, cash: 1500 });
    expect(run.result!.timeLeft).toBeGreaterThan(5);
    expect(run.street).toBe(32);
  });

  it('never lands an express past FINISH − 40, even when boarded late', () => {
    const run = new Run(LEVEL2, 7, { collisions: false });
    run.start();
    run.dist = LEVEL2.length - 120;
    run.course.powerups.push({ id: 99, kind: 'express', lane: 1, x: run.player.x, y: 0.8, d: run.dist + 0.5, taken: false });
    const events = stepFor(run, 0.1);
    expect(events.some(e => e.type === 'express-start')).toBe(true);
    const landed = stepFor(run, POWERUPS.express.duration);
    expect(landed.some(e => e.type === 'express-land')).toBe(true);
    expect(run.dist).toBeLessThanOrEqual(LEVEL2.length - POWERUPS.express.finishMargin + baseSpeed(run.dist) * 0.1);
  });

  it('lands every express within the route on real runs, clearing the landing zone', () => {
    for (const seed of testSeeds(40)) {
      const run = new Run(LEVEL2, seed, { collisions: false });
      run.start();
      while (run.mode !== 'result') {
        const express = run.express;
        run.step();
        const events = run.drainEvents();
        if (express && events.some(e => e.type === 'express-land')) {
          expect(run.dist).toBe(run.expressTo);
          expect(run.dist).toBeLessThanOrEqual(LEVEL2.length - POWERUPS.express.finishMargin);
          const blocking = run.course.obstacles.filter(o => !o.gone && o.type !== 'pigeons' && o.d > run.dist - 2 && o.d < run.dist + 24);
          expect(blocking).toEqual([]);
        }
        // ride every express we can reach: steer toward power-ups
        const pw = run.course.powerups.find(p => !p.taken && p.d - run.dist > 0 && p.d - run.dist < 20);
        if (pw && pw.lane !== run.player.lane) run.input(pw.lane > run.player.lane ? 'right' : 'left');
      }
    }
  });

  it('moving obstacles meet a base-speed runner where the pattern put them (±3 m)', () => {
    let checked = 0;
    for (const seed of testSeeds(100)) {
      const run = ghost(seed);
      const movers = run.course.obstacles.filter(o => o.speed > 0);
      const met = new Map<number, number>();
      while (run.mode === 'run') {
        run.step();
        run.drainEvents();
        for (const o of movers) if (!met.has(o.id) && o.d - run.dist <= 0) met.set(o.id, run.dist);
      }
      for (const o of movers) {
        expect(Math.abs(met.get(o.id)! - o.meet)).toBeLessThanOrEqual(3);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('reports a near miss when you dodge out of a tall obstacle’s lane at the last moment', () => {
    const late = lonelyTourist(3, 3);
    late.input(late.player.lane === 0 ? 'right' : 'left');
    expect(stepFor(late, 0.5).map(e => e.type)).toContain('near-miss');

    const early = lonelyTourist(3, 12);
    early.input(early.player.lane === 0 ? 'right' : 'left');
    const events = stepFor(early, 1.2).map(e => e.type);
    expect(events).not.toContain('near-miss');
    expect(events).not.toContain('hit');
  });
});
