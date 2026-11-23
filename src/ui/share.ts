import { formatClock, formatMoney } from '../sim/economy.ts';
import type { RunResult } from '../sim/events.ts';

export function shareText(r: RunResult, label: string, route: string): string {
  const stars = '⭐'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  const head = `🥨 Alex's Pretzel Run · ${label}`;
  const verdict = r.finished ? `${stars} ${r.tier ? r.tier.name : 'Not enough cash'}` : `❌ Sold out at W ${r.street} St`;
  const stum = `${r.stumbles} stumble${r.stumbles === 1 ? '' : 's'}`;
  const tail = `${formatMoney(r.cash)} · ${r.finished ? `${formatClock(r.timeLeft)} left` : 'out of time'} · ${stum}`;
  return [head, route, verdict, tail].join('\n');
}

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

/** The game's own address, without query or hash, so the link unfurls into the preview card. */
export const gameUrl = (): string => new URL('./', location.href).href;

/** Share sheet on phones, clipboard on computers. Both carry the link so Messages shows the preview card. */
export async function share(text: string, url: string): Promise<'shared' | 'copied' | 'manual' | 'cancelled'> {
  if (isTouchDevice() && navigator.share) {
    try {
      await navigator.share({ text, url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'manual';
  }
}
