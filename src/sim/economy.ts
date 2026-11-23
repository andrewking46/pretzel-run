import { ITEMS, ORDERS, TAX_RATE } from '../config/menu.ts';
import { STUMBLE } from '../config/tuning.ts';

export interface ReceiptLine {
  name: string;
  price: number;
}

export interface Tier {
  stars: 1 | 2 | 3;
  name: string;
  lines: ReceiptLine[];
  subtotal: number;
  tax: number;
  total: number;
}

/** Sales tax in cents, rounded half up, computed in integers so there's no float drift. */
export function salesTax(cents: number, rate: number = TAX_RATE): number {
  const perHundredThousand = Math.round(rate * 100_000);
  return Math.floor((cents * perHundredThousand + 50_000) / 100_000);
}

export const TIERS: readonly Tier[] = ORDERS.map(order => {
  const lines = order.items.map(({ id, qty }) => ({
    name: qty > 1 ? `${ITEMS[id].name} x${qty}` : ITEMS[id].name,
    price: ITEMS[id].price * qty,
  }));
  const subtotal = lines.reduce((sum, l) => sum + l.price, 0);
  const tax = salesTax(subtotal);
  return { stars: order.stars, name: order.name, lines, subtotal, tax, total: subtotal + tax };
});

/** The best order this much cash pays for, or null if it won't cover the cheapest. */
export function tierFor(cash: number): Tier | null {
  return [...TIERS].reverse().find(t => cash >= t.total) ?? null;
}

export function nextTier(cash: number): Tier | null {
  return TIERS.find(t => cash < t.total) ?? null;
}

/** Cash knocked loose by a stumble: 20%, rounded to 25¢, at least 25¢, never more than you have. */
export function stumbleLoss(cash: number): number {
  if (cash <= 0) return 0;
  const { cashLossFraction, cashLossStep, minCashLoss } = STUMBLE;
  const loss = Math.max(minCashLoss, Math.round((cash * cashLossFraction) / cashLossStep) * cashLossStep);
  return Math.min(cash, loss);
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
