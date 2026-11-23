import { QUIPS } from '../config/copy.ts';
import { TAX_LABEL } from '../config/menu.ts';
import { formatClock, formatMoney, nextTier, TIERS } from '../sim/economy.ts';
import type { RunResult } from '../sim/events.ts';
import { pretzelDataUrl } from './icons.ts';
import { settings, type QualityChoice } from './settings.ts';
import { isTouchDevice } from './share.ts';

// Menus: title, pause, settings, the pretzel-counter cutaway and the result card with its receipt.

export type ScreenId = 'sTitle' | 'sPause' | 'sSettings' | 'sResult';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface Best {
  finished: boolean;
  stars: number;
  cash: number;
}

export class Screens {
  private current: ScreenId | null = 'sTitle';
  private settingsReturn: ScreenId = 'sTitle';
  private printing = 0;

  constructor() {
    $('p1').textContent = formatMoney(TIERS[0].total);
    $('p2').textContent = formatMoney(TIERS[1].total);
    $('p3').textContent = formatMoney(TIERS[2].total);
    $('ctrlHint').textContent = isTouchDevice()
      ? 'Swipe ← → to dodge · swipe ↑ or tap to jump · swipe ↓ to slide'
      : 'Arrows or WASD · ↑ / Space jumps · ↓ slides · P pauses · Enter starts';
    for (const span of document.querySelectorAll<HTMLElement>('.counter-case span')) span.style.backgroundImage = `url(${pretzelDataUrl()})`;
    this.bindSettings();
    $('bSettings').onclick = () => this.openSettings('sTitle');
    $('bSettings2').onclick = () => this.openSettings('sPause');
    $('bSettingsDone').onclick = () => this.show(this.settingsReturn);
  }

  get open(): ScreenId | null {
    return this.current;
  }

  show(id: ScreenId | null): void {
    this.current = id;
    for (const s of document.querySelectorAll<HTMLElement>('.screen')) s.classList.toggle('on', s.id === id);
    if (id) {
      const first = $(id).querySelector<HTMLElement>('.btn');
      if (!isTouchDevice()) first?.focus({ preventScroll: true });
    }
  }

  title(dailyLabel: string, best: Best | null, face: string | null): void {
    $('dailyLbl').textContent = `${dailyLabel} · same route for the whole family`;
    $('bestToday').textContent = best ? `Today's best: ${best.finished ? '★'.repeat(best.stars) || '—' : 'sold out'} ${formatMoney(best.cash)}` : '';
    for (const id of ['faceTitle', 'faceResult']) {
      const el = $(id);
      el.classList.toggle('hidden', !face);
      if (face) el.style.backgroundImage = `url(${face})`;
    }
    this.show('sTitle');
  }

  counter(on: boolean): void {
    $('sCounter').classList.toggle('hidden', !on);
  }

  /** Fills the result card and prints the receipt a line at a time. */
  result(r: RunResult, onLine: (i: number, last: boolean) => void): void {
    const stars = r.stars;
    $('rStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < stars ? '' : 'off'}">★</span>`).join('');
    $('rVerdict').textContent = !r.finished ? 'Sold out!' : r.tier ? r.tier.name : 'Not enough cash';
    const pool = !r.finished ? QUIPS.sold : QUIPS[stars as 0 | 1 | 2 | 3];
    let quip: string = pool[Math.floor(Math.random() * pool.length)];
    if (!r.finished) quip += ` He only made it to W ${r.street} St.`;
    $('rQuip').textContent = quip;
    $('rTime').textContent = r.finished ? formatClock(r.timeLeft) : '0:00';
    $('rStum').textContent = String(r.stumbles);
    $('rPct').textContent = `${r.foundPct}%`;
    $('copied').textContent = '';
    $('shareText').classList.add('hidden');
    $('bShare').textContent = isTouchDevice() && 'share' in navigator ? 'Share with the group chat' : 'Copy for the group chat';

    const lines = receiptLines(r);
    const box = $('rReceipt');
    box.replaceChildren();
    const job = ++this.printing;
    lines.forEach((html, i) => {
      setTimeout(() => {
        if (job !== this.printing) return;
        const row = document.createElement('div');
        row.innerHTML = html;
        box.appendChild(row.firstElementChild ?? row);
        onLine(i, i === lines.length - 1);
      }, 250 + i * 110);
    });
    this.show('sResult');
  }

  shareFeedback(text: string, outcome: string): void {
    const msg = $('copied');
    if (outcome === 'copied') msg.textContent = 'Copied. Paste it in the family chat.';
    else if (outcome === 'shared') msg.textContent = 'Shared!';
    else if (outcome === 'manual') {
      const ta = $<HTMLTextAreaElement>('shareText');
      ta.value = text;
      ta.classList.remove('hidden');
      ta.focus();
      ta.select();
      msg.textContent = 'Copy the text below.';
    }
  }

  qualityNote(text: string): void {
    $('qualityNote').textContent = text;
  }

  private openSettings(from: ScreenId): void {
    this.settingsReturn = from;
    this.syncSettings();
    this.show('sSettings');
  }

  private syncSettings(): void {
    const s = settings.current;
    $<HTMLInputElement>('optMusic').checked = s.music;
    $<HTMLInputElement>('optSfx').checked = s.sfx;
    $<HTMLInputElement>('optMotion').checked = s.reducedMotion;
    for (const b of $('optQuality').querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('on', b.dataset.q === s.quality);
  }

  private bindSettings(): void {
    $<HTMLInputElement>('optMusic').onchange = e => settings.update({ music: (e.target as HTMLInputElement).checked });
    $<HTMLInputElement>('optSfx').onchange = e => settings.update({ sfx: (e.target as HTMLInputElement).checked });
    $<HTMLInputElement>('optMotion').onchange = e => settings.update({ reducedMotion: (e.target as HTMLInputElement).checked });
    for (const b of $('optQuality').querySelectorAll<HTMLButtonElement>('button')) {
      b.onclick = () => {
        settings.update({ quality: b.dataset.q as QualityChoice });
        this.syncSettings();
      };
    }
  }
}

function receiptLines(r: RunResult): string[] {
  const now = new Date();
  const ln = (a: string, b: string, cls = '') => `<div class="ln ${cls}"><span>${a}</span><span>${b}</span></div>`;
  const out = [
    `<div class="c hd">AUNTIE ANNE'S</div>`,
    `<div class="c">PENN STATION · 7 AV &amp; W 32 ST</div>`,
    `<div class="c">${now.toLocaleDateString('en-US')} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>`,
    `<div class="dash"></div>`,
  ];
  if (!r.finished) {
    out.push(`<div class="c bad">FRESH BATCH: SOLD OUT</div>`, `<div class="dash"></div>`, ln('CASH IN POCKET', formatMoney(r.cash)));
  } else if (!r.tier) {
    const t = TIERS[0];
    out.push(ln(t.lines[0].name, formatMoney(t.lines[0].price)), ln(TAX_LABEL, formatMoney(t.tax)), `<div class="dash"></div>`);
    out.push(ln('TOTAL', formatMoney(t.total), 'tot'), ln('CASH', formatMoney(r.cash)), `<div class="c bad">*** DECLINED ***</div>`);
    out.push(`<div class="c note">${formatMoney(t.total - r.cash)} short of ${t.name}</div>`);
  } else {
    const t = r.tier;
    for (const l of t.lines) out.push(ln(l.name, formatMoney(l.price)));
    out.push(`<div class="dash"></div>`, ln('Subtotal', formatMoney(t.subtotal)), ln(TAX_LABEL, formatMoney(t.tax)));
    out.push(ln('TOTAL', formatMoney(t.total), 'tot'), ln('CASH', formatMoney(r.cash)), ln('CHANGE', formatMoney(r.cash - t.total)));
    const next = nextTier(r.cash);
    if (next) out.push(`<div class="dash"></div>`, `<div class="c note">${formatMoney(next.total - r.cash)} short of ${next.name}</div>`);
  }
  out.push(`<div class="dash"></div>`, `<div class="c note">THANK YOU · COME BACK HUNGRY</div>`);
  return out;
}
