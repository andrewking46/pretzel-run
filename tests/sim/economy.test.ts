import { describe, expect, it } from 'vitest';
import { formatClock, formatMoney, nextOrder, orderFor, salesTax, stumbleLoss, TIERS } from '../../src/sim/economy.ts';

describe('menu tiers', () => {
  it('match the posted prices with NYC tax', () => {
    expect(TIERS.map(t => [t.subtotal, t.tax, t.total])).toEqual([
      [549, 49, 598],
      [1028, 91, 1119],
      [2885, 256, 3141],
    ]);
    expect(TIERS[2].lines).toEqual([
      { id: 'original', qty: 2, price: 1098 },
      { id: 'cinnamon', qty: 1, price: 579 },
      { id: 'nuggets', qty: 1, price: 729 },
      { id: 'lemonade', qty: 1, price: 479 },
    ]);
  });

  it('rounds tax half up, exactly, for every amount up to $200', () => {
    for (let cents = 0; cents <= 20_000; cents++) {
      const exact = (BigInt(cents) * 8875n + 50_000n) / 100_000n;
      expect(salesTax(cents)).toBe(Number(exact));
    }
  });

  it('picks the best tier the cash covers', () => {
    expect(orderFor(597)).toBeNull();
    expect(orderFor(598)?.stars).toBe(1);
    expect(orderFor(1118)?.stars).toBe(1);
    expect(orderFor(1119)?.stars).toBe(2);
    expect(orderFor(3140)).toMatchObject({ stars: 2, extras: [] });
    expect(orderFor(3141)).toMatchObject({ stars: 3, extras: [], total: 3141 });
    expect(nextOrder(500)).toBe(TIERS[0]);
    expect(nextOrder(1500)).toBe(TIERS[2]);
  });

  it("keeps ordering past Alex's Usual while the cash lasts", () => {
    expect(orderFor(3847)?.extras).toEqual([]);
    expect(orderFor(3848)).toMatchObject({ extras: ['dog'], subtotal: 3534, tax: 314, total: 3848 });
    expect(orderFor(4810)).toMatchObject({
      name: "Alex's Usual",
      extras: ['dog', 'original'],
      total: 4445,
      lines: [
        { id: 'original', qty: 3, price: 1647 },
        { id: 'cinnamon', qty: 1, price: 579 },
        { id: 'nuggets', qty: 1, price: 729 },
        { id: 'dog', qty: 1, price: 649 },
        { id: 'lemonade', qty: 1, price: 479 },
      ],
    });
    expect(orderFor(7098)?.extras).toEqual(['dog', 'original', 'nuggets', 'lemonade', 'cinnamon', 'dog']);
    expect(nextOrder(3141)).toMatchObject({ extras: ['dog'], total: 3848 });
  });

  it('never spends more than it has, and the next step up always costs more', () => {
    for (let cash = 0; cash <= 12_000; cash++) {
      const order = orderFor(cash);
      if (order) expect(order.total).toBeLessThanOrEqual(cash);
      expect(nextOrder(cash).total).toBeGreaterThan(cash);
    }
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
