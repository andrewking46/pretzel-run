import { describe, expect, it } from 'vitest';
import { orderFor } from '../../src/sim/economy.ts';
import type { RunResult } from '../../src/sim/events.ts';
import { layoutReceipt, RECEIPT_EDGE, receiptRows } from '../../src/ui/share.ts';

const run = (over: Partial<RunResult>): RunResult => ({
  finished: true,
  stars: 3,
  order: null,
  cash: 0,
  timeLeft: 16.2,
  stumbles: 1,
  found: 0,
  pool: 6200,
  foundPct: 0,
  street: 31,
  ...over,
});

// A stand-in for real font metrics: dots and hair spaces are narrow, everything else is 8 wide.
const width = (line: string) => [...line].reduce((w, ch) => w + (ch === '.' ? 4.6 : ch === '\u200A' ? 1.1 : 8), 0);

describe('share receipt', () => {
  it("itemizes what the cash bought, with cash and change, and no link", () => {
    expect(receiptRows(run({ cash: 4810, order: orderFor(4810) }), 'Nov 27')).toEqual([
      "🥨 Alex's Pretzel Run",
      ['3 Original', '16.47'],
      ['1 Cinnamon', '5.79'],
      ['1 Nuggets', '7.29'],
      ['1 Pretzel Dog', '6.49'],
      ['1 Lemonade', '4.79'],
      ['TOTAL w/ tax', '44.45'],
      ['CASH', '48.10'],
      ['CHANGE', '3.65'],
      'Nov 27 · 17s left',
    ]);
  });

  it('declines when he makes it with too little cash, and voids when the batch sells out', () => {
    expect(receiptRows(run({ cash: 410, stars: 0 }), 'Practice')).toEqual([
      "🥨 Alex's Pretzel Run",
      ['1 Original', '5.49'],
      ['TOTAL w/ tax', '5.98'],
      ['CASH', '4.10'],
      ['SHORT', '1.88'],
      '*** DECLINED ***',
      'Practice · 17s left',
    ]);
    expect(receiptRows(run({ finished: false, stars: 0, cash: 2240, timeLeft: 0, street: 37 }), 'Nov 27')).toEqual([
      "🥨 Alex's Pretzel Run",
      '*** ORDER VOID ***',
      'Sold out at W 37 St',
      ['CASH', '22.40'],
      'Nov 27 · out of time',
    ]);
  });

  it('sets every amount flush at the same edge on dot leaders', () => {
    const lines = layoutReceipt(receiptRows(run({ cash: 4810, order: orderFor(4810) }), 'Nov 27'), width).split('\n');
    expect(lines[0]).toBe("🥨 Alex's Pretzel Run");
    expect(lines[1]).toMatch(/^3 Original \u200A*\.{2,} 16\.47$/);
    for (const line of lines.filter(l => l.includes('..'))) {
      expect(width(line)).toBeLessThanOrEqual(RECEIPT_EDGE);
      expect(width(line)).toBeGreaterThan(RECEIPT_EDGE - 1.1);
    }
  });
});
