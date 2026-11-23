import type { AudioEngine } from './sfx.ts';

// A tiny looping groove (from the prototype's sequencer, extended): bass, hats, snare, chords,
// and a melody that comes in on the second pass. It speeds up a touch as the clock runs down.

const CHORDS = [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67]];
const MELODY = [72, -1, 74, -1, 76, -1, 79, 76, -1, 74, -1, 72, -1, 69, -1, -1];
const MELODY_B = [76, -1, 79, -1, 81, 79, -1, 76, 74, -1, 72, -1, 74, -1, 76, -1];
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class Music {
  private on = false;
  private next = 0;
  private step = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly audio: AudioEngine;
  tempo = 140;

  constructor(audio: AudioEngine) {
    this.audio = audio;
  }

  start(): void {
    const c = this.audio.ctx;
    if (!c) return;
    this.on = true;
    this.next = c.currentTime + 0.06;
    this.step = 0;
    this.tempo = 140;
    this.timer ??= setInterval(() => this.tick(), 25);
  }

  stop(): void {
    this.on = false;
  }

  private tick(): void {
    const c = this.audio.ctx;
    if (!this.on || !c) return;
    const spb = 60 / this.tempo / 4;
    while (this.next < c.currentTime + 0.12) {
      this.play(this.step, this.next - c.currentTime);
      this.step++;
      this.next += spb;
    }
  }

  private play(st: number, w: number): void {
    const a = this.audio;
    const bus = a.musicBus;
    const bar = Math.floor(st / 16) % 4;
    const s = st % 16;
    const ch = CHORDS[bar];
    const section = Math.floor(st / 64) % 4;
    if ([0, 3, 6, 8, 11, 14].includes(s)) a.tone(mtof(ch[0] - 12 + (s === 6 || s === 14 ? 12 : 0)), 0.14, 'triangle', 0.32, w, null, bus);
    if (s % 2 === 1) a.noise(0.03, 0.05, w, 8000, 'highpass', bus);
    if (s === 4 || s === 12) a.noise(0.1, 0.12, w, 1500, 'bandpass', bus);
    if (s === 0 || s === 8 || s === 10) a.tone(120, 0.12, 'sine', 0.5, w, 45, bus);
    if (s === 2 || s === 7 || s === 13) for (const n of ch.slice(1)) a.tone(mtof(n), 0.09, 'square', 0.03, w, null, bus);
    const mel = section === 1 ? MELODY : section === 3 ? MELODY_B : null;
    if (mel && mel[s] > 0) a.tone(mtof(mel[s] + (bar === 3 ? -2 : 0)), 0.12, 'square', 0.045, w, null, bus);
  }
}
