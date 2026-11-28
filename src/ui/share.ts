import { ITEMS } from '../config/menu.ts';
import { formatMoney, TIERS } from '../sim/economy.ts';
import type { RunResult } from '../sim/events.ts';

// What "Share with the group chat" sends: the run as a register receipt, as plain text. Amounts sit flush
// right on dot leaders, measured in the font Messages draws bubbles in (the system font at 17 pt). Every
// line stays inside RECEIPT_EDGE, so nothing wraps on a 375-pt-wide phone in a group chat even at the
// largest standard text size: there a bubble holds about 232 pt of 23-pt text, which is 171 pt at 17.

/** Where amounts end, in points of 17-pt system font. */
export const RECEIPT_EDGE = 164;

/** A plain line, or a label and an amount to set flush right. */
export type ReceiptRow = string | readonly [label: string, amount: string];

const HAIR_SPACE = '\u200A';

/** Receipts print amounts without "$", which also keeps iOS from underlining them as money. */
const amount = (cents: number) => formatMoney(cents).replace('$', '');

export function receiptRows(r: RunResult, label: string): ReceiptRow[] {
  const head = "🥨 Alex's Pretzel Run";
  if (!r.finished) return [head, '*** ORDER VOID ***', `Sold out at W ${r.street} St`, ['CASH', amount(r.cash)], `${label} · out of time`];

  const order = r.order ?? TIERS[0];
  const settled: ReceiptRow[] = r.order
    ? [['CHANGE', amount(r.cash - order.total)]]
    : [['SHORT', amount(order.total - r.cash)], '*** DECLINED ***'];
  return [
    head,
    ...order.lines.map(l => [`${l.qty} ${ITEMS[l.id].short}`, amount(l.price)] as const),
    ['TOTAL w/ tax', amount(order.total)],
    ['CASH', amount(r.cash)],
    ...settled,
    `${label} · ${Math.ceil(r.timeLeft)}s left`,
  ];
}

/** Joins the rows, padding each amount with dots and then hair spaces until it ends at RECEIPT_EDGE. */
export function layoutReceipt(rows: readonly ReceiptRow[], width: (line: string) => number): string {
  return rows.map(row => (typeof row === 'string' ? row : flushRight(row, width))).join('\n');
}

function flushRight([label, value]: readonly [string, string], width: (line: string) => number): string {
  const line = (dots: string, hair = '') => `${label} ${hair}${dots} ${value}`;
  let dots = '..';
  while (dots.length < 60 && width(line(`${dots}.`)) <= RECEIPT_EDGE) dots += '.';
  let hair = '';
  while (hair.length < 8 && width(line(dots, hair + HAIR_SPACE)) <= RECEIPT_EDGE) hair += HAIR_SPACE;
  return line(dots, hair);
}

export function shareText(r: RunResult, label: string): string {
  const probe = document.body.appendChild(document.createElement('span'));
  probe.style.cssText = 'all:initial;position:absolute;visibility:hidden;white-space:pre;font-family:system-ui;font-size:17px';
  try {
    return layoutReceipt(receiptRows(r, label), line => ((probe.textContent = line), probe.getBoundingClientRect().width));
  } finally {
    probe.remove();
  }
}

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

/** Share sheet on phones, clipboard on computers. Text only: the receipt is the whole message. */
export async function share(text: string): Promise<'shared' | 'copied' | 'manual' | 'cancelled'> {
  if (isTouchDevice() && navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'manual';
  }
}
