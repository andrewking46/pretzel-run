// Every sound is synthesized with WebAudio: nothing to download, nothing to license.

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private sfxOn = true;
  musicOn = true;
  private sleepTimer: ReturnType<typeof setTimeout> | undefined;

  /** Must run inside a user gesture on iOS. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      this.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.75;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
    this.sfxBus.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.3 : 0;
    this.musicBus.connect(this.master);
    const blip = c.createBufferSource();
    blip.buffer = c.createBuffer(1, 1, 22050);
    blip.connect(this.master);
    blip.start(0);
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.3 : 0, this.ctx.currentTime, 0.05);
  }

  suspend(): void {
    clearTimeout(this.sleepTimer);
    void this.ctx?.suspend().catch(() => {});
  }

  resume(): void {
    clearTimeout(this.sleepTimer);
    if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  /**
   * A running audio context keeps the audio hardware awake even when it's silent, so the menus, pause
   * and the result card let it sleep once their last sound has played. The next tap wakes it (unlock).
   */
  sleepSoon(ms = 1500): void {
    clearTimeout(this.sleepTimer);
    if (this.ctx) this.sleepTimer = setTimeout(() => this.suspend(), ms);
  }

  tone(f: number, dur: number, type: OscillatorType = 'square', vol = 0.15, when = 0, f2: number | null = null, dest?: AudioNode): void {
    const c = this.ctx;
    if (!c || (!dest && !this.sfxOn)) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise(dur: number, vol = 0.2, when = 0, freq = 2000, type: BiquadFilterType = 'bandpass', dest?: AudioNode, q = 1): void {
    const c = this.ctx;
    if (!c || (!dest && !this.sfxOn)) return;
    if (!this.noiseBuf) {
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    s.buffer = this.noiseBuf;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest ?? this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.03);
  }

  // ---- the sound kit
  coin(value: number): void {
    if (value >= 500) {
      [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.14, 'square', 0.09, i * 0.07));
      this.tone(2349, 0.5, 'triangle', 0.08, 0.36);
    } else if (value >= 100) {
      [784, 1046, 1318].forEach((f, i) => this.tone(f, i === 2 ? 0.16 : 0.06, 'square', 0.08, i * 0.06));
    } else {
      const base = value >= 25 ? 1175 : 1046;
      this.tone(base, 0.05, 'square', 0.065);
      this.tone(base * 1.5, 0.1, 'square', 0.065, 0.045);
    }
  }
  jump(): void { this.tone(320, 0.16, 'triangle', 0.16, 0, 660); }
  slide(): void { this.noise(0.3, 0.14, 0, 900, 'lowpass'); }
  lane(): void { this.noise(0.07, 0.06, 0, 2600, 'bandpass', undefined, 0.8); }
  whoosh(): void { this.noise(0.22, 0.12, 0, 1400, 'bandpass', undefined, 0.6); this.tone(500, 0.2, 'sine', 0.04, 0, 200); }
  land(): void { this.noise(0.06, 0.08, 0, 400, 'lowpass'); }
  hit(): void { this.tone(150, 0.32, 'sawtooth', 0.17, 0, 55); this.noise(0.2, 0.28, 0, 600, 'lowpass'); }
  bonk(): void { this.tone(260, 0.12, 'square', 0.12, 0, 120); this.tone(520, 0.08, 'triangle', 0.08, 0.02, 900); }
  bell(): void { this.tone(2093, 0.4, 'sine', 0.12); this.tone(2637, 0.35, 'sine', 0.06); this.tone(2093, 0.4, 'sine', 0.1, 0.17); }
  honk(): void { this.tone(370, 0.34, 'square', 0.06); this.tone(466, 0.34, 'square', 0.05); }
  meow(): void { this.tone(620, 0.12, 'sine', 0.14, 0, 900); this.tone(900, 0.3, 'sine', 0.14, 0.11, 500); }
  power(): void { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.1, 'square', 0.08, i * 0.05)); }
  flap(): void { for (let i = 0; i < 6; i++) this.noise(0.05, 0.07, i * 0.045, 1800); }
  tick(): void { this.tone(1800, 0.03, 'square', 0.05); }
  count(): void { this.tone(523, 0.12, 'square', 0.08); }
  go(): void { this.tone(523, 0.12, 'square', 0.1); this.tone(1046, 0.28, 'square', 0.1, 0.12); }
  express(): void {
    this.noise(2.2, 0.15, 0, 260, 'lowpass');
    this.tone(85, 2.2, 'sawtooth', 0.045, 0, 70);
    for (let i = 0; i < 8; i++) this.noise(0.05, 0.08, 0.25 + i * 0.26, 500, 'bandpass');
    this.tone(660, 0.14, 'sine', 0.1, 0.05);
    this.tone(523, 0.32, 'sine', 0.1, 0.19);
  }
  doors(): void { this.tone(784, 0.18, 'sine', 0.08); this.tone(622, 0.34, 'sine', 0.08, 0.2); }
  register(): void {
    this.noise(0.08, 0.2, 0, 3500, 'highpass');
    this.tone(1568, 0.5, 'sine', 0.14, 0.08);
    this.tone(2093, 0.7, 'sine', 0.12, 0.14);
    this.noise(0.12, 0.1, 0.14, 6000, 'highpass');
  }
  printer(n: number): void { for (let i = 0; i < n; i++) this.noise(0.05, 0.05, i * 0.11, 2200, 'bandpass', undefined, 3); }
  sad(): void { [392, 370, 349, 330].forEach((f, i) => this.tone(f, i === 3 ? 0.8 : 0.28, 'sawtooth', 0.08, i * 0.32, i === 3 ? 300 : null)); }
  cheer(): void {
    this.noise(1.4, 0.12, 0, 1600, 'bandpass', undefined, 0.5);
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'square', 0.07, i * 0.09));
  }
}

export const audio = new AudioEngine();
