import { describe, expect, it } from 'vitest';
import { formatClock, formatMoney, nextTier, salesTax, stumbleLoss, tierFor, TIERS } from '../../src/sim/economy.ts';

describe('menu tiers', () => {
  it('match the posted prices with NYC tax', () => {
    expect(TIERS.map(t => [t.subtotal, t.tax, t.total])).toEqual([
      [549, 49, 598],
      [1028, 91, 1119],
      [2885, 256, 3141],
    ]);
    expect(TIERS[2].lines).toEqual([
      { name: 'Original Pretzel x2', price: 1098 },
      { name: 'Cinnamon Sugar Pretzel', price: 579 },
      { name: 'Pretzel Nuggets', price: 729 },
      { name: 'Original Lemonade', price: 479 },
    ]);
  });

  it('rounds tax half up, exactly, for every amount up to $200', () => {
    for (let cents = 0; cents <= 20_000; cents++) {
      const exact = (BigInt(cents) * 8875n + 50_000n) / 100_000n;
      expect(salesTax(cents)).toBe(Number(exact));
    }
  });

  it('picks the best tier the cash covers', () => {
    expect(tierFor(597)).toBeNull();
    expect(tierFor(598)?.stars).toBe(1);
    expect(tierFor(1118)?.stars).toBe(1);
    expect(tierFor(1119)?.stars).toBe(2);
    expect(tierFor(3140)?.stars).toBe(2);
    expect(tierFor(3141)?.stars).toBe(3);
    expect(nextTier(1500)?.stars).toBe(3);
    expect(nextTier(3141)).toBeNull();
  });
});

describe('stumble loss', () => {
  it('drops 20% rounded to 25¢, at least 25¢, never more than you hold', () => {
    expect(stumbleLoss(0)).toBe(0);
    expect(stumbleLoss(10)).toBe(10);
    expect(stumbleLoss(100)).toBe(25);
    expect(stumbleLoss(1000)).toBe(200);
    expect(stumbleLoss(1060)).toBe(200);
    expect(stumbleLoss(1070)).toBe(225);
    expect(stumbleLoss(3141)).toBe(625);
  });
});

describe('formatting', () => {
  it('formats cents and the clock', () => {
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(1725)).toBe('$17.25');
    expect(formatMoney(-305)).toBe('-$3.05');
    expect(formatClock(14.2)).toBe('0:15');
    expect(formatClock(110)).toBe('1:50');
    expect(formatClock(-3)).toBe('0:00');
  });
});
