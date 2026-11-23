import { describe, expect, it } from 'vitest';
import { LEVEL2 } from '../../src/config/levels/level2.ts';
import { solveCourse } from '../../src/sim/solver.ts';
import { testSeeds } from '../helpers/seeds.ts';

// 500 seeds are proven in five shards of 100 so Vitest can run them in parallel.
describe('every course has a hit-free path (seeds 201–300)', () => {
  it('solver reaches the finish without a collision', () => {
    const failures = testSeeds(100, 200)
      .map(seed => ({ seed, ...solveCourse(LEVEL2, seed) }))
      .filter(r => !r.solved)
      .map(r => `seed ${r.seed} stuck at ${r.reached.toFixed(1)} m`);
    expect(failures).toEqual([]);
  });
});
