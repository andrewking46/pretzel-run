import { storage } from './storage.ts';

export type QualityChoice = 'auto' | 'low' | 'medium' | 'high';
export type Tier = 'low' | 'medium' | 'high';

export interface Settings {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
  quality: QualityChoice;
  /** tier picked by the frame-time probe, remembered between sessions */
  detectedTier: Tier | null;
  /** controls hint has been shown once */
  seenHint: boolean;
}

const KEY = 'pretzel-run/settings/v1';
const prefersReducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const defaults: Settings = {
  music: true,
  sfx: true,
  reducedMotion: prefersReducedMotion,
  quality: 'auto',
  detectedTier: null,
  seenHint: false,
};

type Listener = (s: Settings) => void;

class SettingsStore {
  private value: Settings = { ...defaults, ...storage.get<Partial<Settings>>(KEY, {}) };
  private listeners: Listener[] = [];

  get current(): Settings {
    return this.value;
  }

  get tier(): Tier {
    return this.value.quality === 'auto' ? (this.value.detectedTier ?? 'medium') : this.value.quality;
  }

  update(patch: Partial<Settings>): void {
    this.value = { ...this.value, ...patch };
    storage.set(KEY, this.value);
    for (const l of this.listeners) l(this.value);
  }

  subscribe(l: Listener): void {
    this.listeners.push(l);
  }
}

export const settings = new SettingsStore();
