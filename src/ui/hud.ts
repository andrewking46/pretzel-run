import type { Camera, Vector3 } from 'three';
import { RUN } from '../config/tuning.ts';
import { formatClock, formatMoney, TIERS } from '../sim/economy.ts';
import type { Run } from '../sim/run.ts';
import type { Device } from '../input/commands.ts';
import { pretzelDataUrl } from './icons.ts';

// The in-run HUD: plain DOM over the canvas. Updated only when values change.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hud {
  private readonly root = $('hud');
  private readonly cash = $('cash');
  private readonly fill = $('tierFill');
  private readonly ticks = [...this.root.querySelectorAll<HTMLElement>('.tierbar .tick')];
  private readonly timer = $('timer');
  private readonly time = $('timeLeft');
  private readonly street = $('streetName');
  private readonly blocks = $('blocksLeft');
  private readonly progress = $('progressFill');
  private readonly dot = $('progressDot');
  private readonly powerups = $('powerups');
  private readonly popups = $('popups');
  private readonly floaters = $('floaters');
  private readonly hint = $('hint');
  private readonly countdown = $('countdown');
  private readonly express = $('express');
  private last = { cash: -1, time: '', street: -1, slice: false, cat: false, low: false };
  private hintUntil = 0;

  constructor() {
    const top = TIERS[2].total;
    TIERS.forEach((t, i) => (this.ticks[i].style.left = `${(t.total / top) * 100}%`));
    for (const el of document.querySelectorAll<HTMLElement>('.pretzel-icon')) el.style.backgroundImage = `url(${pretzelDataUrl()})`;
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }

  setFace(url: string | null): void {
    if (url) this.dot.style.backgroundImage = `url(${url})`;
  }

  reset(run: Run): void {
    this.last = { cash: -1, time: '', street: -1, slice: false, cat: false, low: false };
    this.popups.replaceChildren();
    this.floaters.replaceChildren();
    this.countdown.replaceChildren();
    this.powerups.replaceChildren();
    this.showExpress(false);
    this.update(run);
  }

  update(run: Run): void {
    if (run.cash !== this.last.cash) {
      const up = run.cash > this.last.cash && this.last.cash >= 0;
      const down = run.cash < this.last.cash;
      this.cash.textContent = formatMoney(run.cash);
      this.cash.classList.remove('bump', 'loss');
      if (up || down) {
        void this.cash.offsetWidth;
        this.cash.classList.add(up ? 'bump' : 'loss');
      }
      const top = TIERS[2].total;
      this.fill.style.width = `${Math.min(100, (run.cash / top) * 100)}%`;
      TIERS.forEach((t, i) => this.ticks[i].classList.toggle('got', run.cash >= t.total));
      this.last.cash = run.cash;
    }
    const time = formatClock(run.timeLeft);
    if (time !== this.last.time) {
      this.time.textContent = time;
      this.last.time = time;
    }
    const low = run.timeLeft <= RUN.warnBelow && run.mode === 'run';
    if (low !== this.last.low) {
      this.timer.classList.toggle('low', low);
      this.last.low = low;
    }
    if (run.street !== this.last.street) {
      this.street.textContent = `7 AV & W ${run.street} ST`;
      this.street.parentElement!.classList.remove('flip');
      void this.street.offsetWidth;
      this.street.parentElement!.classList.add('flip');
      this.last.street = run.street;
    }
    const finish = run.level.landmarks.finishStreet;
    const left = Math.max(0, run.street - finish);
    this.blocks.textContent = run.dist >= run.level.length - 70 ? 'PENN STATION AHEAD' : `${left} BLOCK${left === 1 ? '' : 'S'} TO PENN`;
    const pct = `${run.progress * 100}%`;
    this.progress.style.width = pct;
    this.dot.style.left = pct;
    this.ring('slice', run.sliceT, 5, '🍕', '#ffb347');
    this.ring('cat', run.catT, 9, '🐈', '#ffd28a');
    if (this.hintUntil && performance.now() > this.hintUntil) this.hideHint();
  }

  private ring(kind: 'slice' | 'cat', t: number, total: number, icon: string, color: string): void {
    let el = this.powerups.querySelector<HTMLElement>(`[data-k="${kind}"]`);
    if (t <= 0) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.className = 'pu';
      el.dataset.k = kind;
      el.innerHTML = `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,.15)"/><circle class="arc" cx="28" cy="28" r="24" stroke="${color}" stroke-dasharray="150.8" /></svg><span>${icon}</span>`;
      this.powerups.appendChild(el);
    }
    (el.querySelector('.arc') as SVGCircleElement).style.strokeDashoffset = `${150.8 * (1 - t / total)}`;
  }

  popup(text: string, color = '#fff', small = false): void {
    const el = document.createElement('div');
    el.className = `popup${small ? ' small' : ''}`;
    el.textContent = text;
    el.style.color = color;
    this.popups.appendChild(el);
    while (this.popups.children.length > 3) this.popups.firstElementChild!.remove();
    setTimeout(() => el.remove(), 1400);
  }

  floater(text: string, color: string, world: Vector3, camera: Camera): void {
    const p = project(world, camera);
    if (!p) return;
    const el = document.createElement('div');
    el.className = 'floater';
    el.textContent = text;
    el.style.color = color;
    el.style.transform = `translate(${p.x + (Math.random() - 0.5) * 30}px, ${p.y}px) translate(-50%, -100%)`;
    this.floaters.appendChild(el);
    while (this.floaters.children.length > 8) this.floaters.firstElementChild!.remove();
    setTimeout(() => el.remove(), 800);
  }

  bubble(text: string, world: Vector3, camera: Camera): void {
    const p = project(world, camera);
    if (!p) return;
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    el.style.transform = `translate(${Math.min(window.innerWidth - 170, Math.max(8, p.x - 24))}px, ${Math.max(90, p.y - 56)}px)`;
    this.floaters.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  count(n: number | 'GO'): void {
    const tag = n === 3 ? '<span class="tag">GET ALEX HIS PRETZELS</span>' : '';
    this.countdown.innerHTML = `${tag}<span class="${n === 'GO' ? 'go' : ''}">${n === 'GO' ? 'GO!' : n}</span>`;
    if (n === 'GO') setTimeout(() => this.countdown.replaceChildren(), 700);
  }

  showHint(device: Device): void {
    this.hint.innerHTML =
      device === 'touch'
        ? 'SWIPE ← → TO DODGE<small>SWIPE ↑ OR TAP TO JUMP · SWIPE ↓ TO SLIDE</small>'
        : device === 'gamepad'
          ? 'D-PAD ← → TO DODGE<small>A JUMPS · B SLIDES</small>'
          : '← → OR A / D TO DODGE<small>↑ / SPACE JUMP · ↓ SLIDE · P PAUSE</small>';
    this.hint.classList.remove('hidden');
    this.hintUntil = performance.now() + 5000;
  }

  hideHint(): void {
    this.hint.classList.add('hidden');
    this.hintUntil = 0;
  }

  showExpress(on: boolean, nextStreet?: number): void {
    if (on) {
      $('expressNext').textContent = `NEXT STOP: W ${nextStreet} ST`;
      this.express.classList.remove('hidden', 'out');
    } else if (!this.express.classList.contains('hidden')) {
      this.express.classList.add('out');
      setTimeout(() => this.express.classList.add('hidden'), 300);
    }
  }
}

export function project(world: Vector3, camera: Camera): { x: number; y: number } | null {
  const v = world.clone().project(camera);
  if (v.z > 1) return null;
  return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
}
