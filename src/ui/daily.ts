import { hashString } from '../sim/rng.ts';

// Today's Run uses New York's date, so the whole family gets the same route the same day
// wherever they are.

let newYork: Intl.DateTimeFormat | null = null;

export function todayKey(now = new Date()): string {
  try {
    // building a formatter is slow (tens of ms on a phone), so make it once
    newYork ??= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    return newYork.format(now);
  } catch {
    const d = now;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

export function dailySeed(key = todayKey()): number {
  return hashString(`pretzel-${key}`);
}

export function dateLabel(key = todayKey()): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}
