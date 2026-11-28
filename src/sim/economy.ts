import { EXTRAS, ITEMS, ORDERS, TAX_RATE, type ItemId } from '../config/menu.ts';
import { STUMBLE } from '../config/tuning.ts';

export interface ReceiptLine {
  id: ItemId;
  qty: number;
  price: number;
}

export interface Order {
  stars: 1 | 2 | 3;
  name: string;
  /** what spare cash added past the tier's own order, in the order it was added */
  extras: ItemId[];
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

type Counts = Partial<Record<ItemId, number>>;

function priced(stars: Order['stars'], name: string, extras: ItemId[], counts: Counts): Order {
  const lines = (Object.keys(ITEMS) as ItemId[])
    .filter(id => counts[id])
    .map(id => ({ id, qty: counts[id]!, price: ITEMS[id].price * counts[id]! }));
  const subtotal = lines.reduce((sum, l) => sum + l.price, 0);
  const tax = salesTax(subtotal);
  return { stars, name, extras, lines, subtotal, tax, total: subtotal + tax };
}

const countsOf = (items: readonly { id: ItemId; qty: number }[]): Counts => Object.fromEntries(items.map(i => [i.id, i.qty]));

export const TIERS: readonly Order[] = ORDERS.map(o => priced(o.stars, o.name, [], countsOf(o.items)));

/** The same order with the next item from the extras list added. */
function withExtra(order: Order): Order {
  const id = EXTRAS[order.extras.length % EXTRAS.length];
  const counts = countsOf(order.lines);
  counts[id] = (counts[id] ?? 0) + 1;
  return priced(order.stars, order.name, [...order.extras, id], counts);
}

/** The best tier this much cash pays for, or null if it won't cover the cheapest. Past Alex's Usual, spare cash keeps ordering. */
export function orderFor(cash: number): Order | null {
  let order = [...TIERS].reverse().find(t => cash >= t.total) ?? null;
  if (order?.stars !== 3) return order;
  for (let more = withExtra(order); more.total <= cash; more = withExtra(more)) order = more;
  return order;
}

/** One step up from what this cash buys: the next tier, or Alex's Usual with one more thing. */
export function nextOrder(cash: number): Order {
  const order = orderFor(cash);
  return order?.stars === 3 ? withExtra(order) : TIERS.find(t => cash < t.total)!;
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
