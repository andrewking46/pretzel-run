import { describe, expect, it } from 'vitest';
import { LEVEL2 } from '../../src/config/levels/level2.ts';
import { COINS, LANES } from '../../src/config/tuning.ts';
import { clearanceOf, generateCourse } from '../../src/sim/course.ts';
import { hashString } from '../../src/sim/rng.ts';
import { testSeeds } from '../helpers/seeds.ts';

const seeds = testSeeds(500);
const courses = seeds.map(seed => generateCourse(LEVEL2, seed));

describe('course generation', () => {
  it('is identical for the same seed', () => {
    for (const seed of [1, 42, hashString('pretzel-2026-11-22'), 0xffffffff]) {
      expect(JSON.stringify(generateCourse(LEVEL2, seed))).toEqual(JSON.stringify(generateCourse(LEVEL2, seed)));
    }
  });

  it('differs between seeds', () => {
    const fingerprints = new Set(courses.map(c => c.obstacles.map(o => `${o.type}${o.lane}${o.d.toFixed(1)}`).join()));
    expect(fingerprints.size).toBe(courses.length);
  });

  it('keeps the cash pool between $45 and $90', () => {
    const pools = courses.map(c => c.pool);
    expect(Math.min(...pools)).toBeGreaterThanOrEqual(4500);
    expect(Math.max(...pools)).toBeLessThanOrEqual(9000);
    const avg = pools.reduce((a, b) => a + b, 0) / pools.length;
    expect(avg).toBeGreaterThan(5500);
    expect(avg).toBeLessThan(7500);
  });

  it('pool equals the sum of every coin on the route', () => {
    for (const c of courses) expect(c.coins.reduce((s, k) => s + k.value, 0)).toBe(c.pool);
  });

  it('places exactly one $5 bill between 650 and 1150 m, almost always on a jump-arc apex', () => {
    let onApex = 0;
    for (const c of courses) {
      const fives = c.coins.filter(k => k.value === COINS.value.five);
      expect(fives).toHaveLength(1);
      expect(fives[0].d).toBeGreaterThan(650);
      expect(fives[0].d).toBeLessThan(1150);
      if (fives[0].y > 1.7) onApex++;
    }
    expect(onApex / courses.length).toBeGreaterThan(0.97);
  });

  it('hands out six power-ups near their marks, with no express too close to the finish', () => {
    for (const c of courses) {
      expect(c.powerups).toHaveLength(6);
      LEVEL2.powerups.at.forEach((mark, i) => {
        expect(c.powerups[i].d).toBeGreaterThan(mark - 25 - LEVEL2.powerups.lead);
        expect(c.powerups[i].d).toBeLessThan(mark + 90);
      });
      for (const p of c.powerups.filter(p => p.kind === 'express')) expect(p.d).toBeLessThan(LEVEL2.length - LEVEL2.powerups.expressCutoff);
      expect(c.powerups.some(p => p.kind === 'express')).toBe(true);
    }
  });

  it('keeps every obstacle on the sidewalk and before the finish', () => {
    for (const c of courses) {
      for (const o of c.obstacles) {
        expect(o.meet).toBeGreaterThan(0);
        expect(o.meet).toBeLessThan(LEVEL2.length - LEVEL2.course.endMargin + 1);
        if (o.lane >= 0) expect(o.x).toBe(LANES.x[o.lane]);
      }
    }
  });

  it('never blocks all three lanes with something you must dodge sideways', () => {
    for (const c of courses) {
      const walls = c.obstacles.filter(o => clearanceOf(o) === 'dodge');
      for (const o of walls) {
        const sameRow = walls.filter(w => Math.abs(w.meet - o.meet) < 1.5);
        const covered = LANES.x.filter(x => sameRow.some(w => Math.abs(w.x - x) < w.hw + 0.25));
        expect(covered.length).toBeLessThan(3);
      }
    }
  });

  it('marks Times Square and gives it more tourists', () => {
    const [ts] = courses[0].zones;
    expect(ts.id).toBe('times-square');
    expect(ts.from).toBe(200);
    expect(ts.to).toBe(613);
    const density = (inside: boolean) => {
      let n = 0;
      let len = 0;
      for (const c of courses) {
        n += c.obstacles.filter(o => o.type === 'tourist' && (o.meet > ts.from && o.meet < ts.to) === inside).length;
        len += inside ? ts.to - ts.from : LEVEL2.length - (ts.to - ts.from);
      }
      return n / len;
    };
    expect(density(true)).toBeGreaterThan(density(false) * 1.3);
  });

  it('lays out the cross streets from W 49 St to W 32 St', () => {
    const ints = courses[0].intersections;
    expect(ints[0]).toMatchObject({ street: 49, d0: 40, d1: 53 });
    expect(ints.at(-1)).toMatchObject({ street: 32, d0: 1400, d1: 1413 });
    expect(ints).toHaveLength(18);
  });
});
