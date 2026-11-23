import { describe, expect, it } from 'vitest';
import { LEVEL2 } from '../../src/config/levels/level2.ts';
import { autoplay } from '../../src/sim/autopilot.ts';
import { Run } from '../../src/sim/run.ts';
import { testSeeds } from '../helpers/seeds.ts';

describe('autopilot over 500 seeds', () => {
  const results = testSeeds(500).map(seed => autoplay(new Run(LEVEL2, seed)).result!);

  it('finishes every run', () => {
    expect(results.every(r => r.finished)).toBe(true);
  });

  it('stumbles at most once on 95%+ of seeds', () => {
    expect(results.filter(r => r.stumbles <= 1).length / results.length).toBeGreaterThanOrEqual(0.95);
  });

  it('earns 3 stars about 85% of the time', () => {
    const rate = results.filter(r => r.stars === 3).length / results.length;
    expect(rate).toBeGreaterThan(0.78);
    expect(rate).toBeLessThan(0.92);
  });
});
