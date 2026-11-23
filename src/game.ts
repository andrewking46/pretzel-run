import { Vector3 } from 'three';
import { Music } from './audio/music.ts';
import { audio } from './audio/sfx.ts';
import { ALEX_FACE_URL } from './config/alex.ts';
import { LINES, POWERUP_NAMES } from './config/copy.ts';
import { LEVEL2 } from './config/levels/level2.ts';
import { SIM_DT } from './config/tuning.ts';
import type { Command, Device } from './input/commands.ts';
import { GamepadInput } from './input/gamepad.ts';
import { listenKeyboard } from './input/keyboard.ts';
import { listenTouch } from './input/touch.ts';
import { Autopilot } from './sim/autopilot.ts';
import { formatMoney } from './sim/economy.ts';
import type { RunResult, SimEvent } from './sim/events.ts';
import { hashString } from './sim/rng.ts';
import { Run } from './sim/run.ts';
import { Stage } from './stage.ts';
import { dailySeed, dateLabel, randomSeed, todayKey } from './ui/daily.ts';
import { Hud } from './ui/hud.ts';
import { Screens, type Best } from './ui/screens.ts';
import { settings, type Tier } from './ui/settings.ts';
import { gameUrl, isTouchDevice, share, shareText } from './ui/share.ts';
import { storage } from './ui/storage.ts';

// Ties it all together: the fixed-step loop, the title attract demo, starting/pausing/finishing runs,
// and turning sim events into sound, HUD and effects.

type Mode = 'title' | 'play' | 'paused' | 'outro' | 'result';

const BEST_KEY = (day: string) => `pretzel-run/best/${day}`;

export class Game {
  readonly stage: Stage;
  private readonly hud = new Hud();
  private readonly screens = new Screens();
  private readonly music = new Music(audio);
  private readonly gamepad: GamepadInput;
  private mode: Mode = 'title';
  private run: Run | null = null;
  private demoPilot = new Autopilot();
  /** dev/test hook: let the autopilot play the real run */
  autopilot: Autopilot | null = null;
  /** dev/test hook: run the simulation faster than real time */
  timeScale = 1;
  private daily = true;
  private dayKey = todayKey();
  private acc = 0;
  private last = performance.now();
  private slowMo = 0;
  private lastDevice: Device = isTouchDevice() ? 'touch' : 'keyboard';
  private readonly face: string | null = __HAS_FACE__ ? ALEX_FACE_URL : null;
  private readonly probe = { t: 0, samples: [] as number[], done: false };
  readonly frameTimes: number[] = [];
  private readonly tmp = new Vector3();

  constructor(container: HTMLElement) {
    this.stage = new Stage(container);
    this.stage.setTier(settings.tier);
    this.stage.onTierChange = () => this.stage.warmUp();
    this.applySettings();
    settings.subscribe(() => this.applySettings());
    this.hud.setFace(this.face);

    const handle = (cmd: Command, device: Device) => this.command(cmd, device);
    listenKeyboard(handle);
    listenTouch(container, handle);
    this.gamepad = new GamepadInput(handle);
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.mode === 'play') this.pause();
        audio.suspend();
      } else audio.resume();
    });
    const resize = () => this.stage.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    resize();
    this.bindButtons();
    this.toTitle();
    this.stage.warmUp();
    requestAnimationFrame(this.frame);
  }

  get current(): Run | null {
    return this.run;
  }

  get state(): Mode {
    return this.mode;
  }

  // ------------------------------------------------------------------ flow

  toTitle(): void {
    this.mode = 'title';
    this.music.stop();
    this.hud.show(false);
    this.hud.showExpress(false);
    this.screens.counter(false);
    this.dayKey = todayKey();
    this.startDemo();
    this.screens.title(dateLabel(this.dayKey), storage.get<Best | null>(BEST_KEY(this.dayKey), null), this.face);
  }

  start(daily: boolean, seed?: number): void {
    audio.unlock();
    this.daily = daily;
    this.dayKey = todayKey();
    const s = seed ?? (daily ? dailySeed(this.dayKey) : randomSeed());
    this.run = new Run(LEVEL2, s);
    this.stage.load(this.run);
    this.stage.rig.startFlyIn();
    this.hud.reset(this.run);
    this.hud.show(true);
    this.screens.show(null);
    this.screens.counter(false);
    this.mode = 'play';
    this.acc = 0;
  }

  pause(): void {
    if (this.mode !== 'play') return;
    this.mode = 'paused';
    this.music.stop();
    this.screens.show('sPause');
  }

  resume(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'play';
    this.screens.show(null);
    if (this.run?.mode === 'run') this.music.start();
    this.last = performance.now();
  }

  private startDemo(): void {
    this.run = new Run(LEVEL2, hashString(`title-${Math.floor(Math.random() * 4)}`));
    this.run.start();
    this.demoPilot = new Autopilot();
    this.stage.load(this.run);
  }

  private command(cmd: Command, device: Device): void {
    if (cmd !== 'pause' && cmd !== 'confirm') this.lastDevice = device;
    if (cmd === 'pause') {
      if (this.mode === 'play') this.pause();
      else if (this.mode === 'paused') this.resume();
      return;
    }
    if (cmd === 'confirm') {
      if (this.mode === 'title' && this.screens.open === 'sTitle') this.start(true);
      else if (this.mode === 'paused') this.resume();
      else if (this.mode === 'result') this.start(this.daily);
      return;
    }
    if (this.mode === 'play' && this.run) this.run.input(cmd);
  }

  private bindButtons(): void {
    const on = (id: string, f: () => void) => ((document.getElementById(id) as HTMLButtonElement).onclick = f);
    on('bDaily', () => this.start(true));
    on('bPractice', () => this.start(false));
    on('pauseBtn', () => this.pause());
    on('bResume', () => this.resume());
    on('bRestart', () => this.start(this.daily));
    on('bQuit', () => this.toTitle());
    on('bAgain', () => this.start(this.daily));
    on('bMenu', () => this.toTitle());
    on('bShare', async () => {
      const r = this.run?.result;
      if (!r) return;
      const text = shareText(r, this.daily ? dateLabel(this.dayKey) : 'Practice', LEVEL2.title);
      const url = gameUrl();
      this.screens.shareFeedback(`${text}\n${url}`, await share(text, url));
    });
  }

  private applySettings(): void {
    const s = settings.current;
    audio.setMusic(s.music);
    audio.setSfx(s.sfx);
    if (settings.tier !== this.stage.currentTier) this.stage.setTier(settings.tier);
    this.screens.qualityNote(s.quality === 'auto' ? `Auto picked ${this.stage.currentTier} for this device.` : '');
  }

  // ------------------------------------------------------------------ loop

  private frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 600) this.frameTimes.shift();
    this.gamepad.poll();

    const run = this.run;
    if (run && (this.mode === 'play' || this.mode === 'title' || this.mode === 'outro')) {
      let simDt = dt;
      if (this.slowMo > 0) {
        this.slowMo -= dt;
        simDt *= 0.35;
      }
      this.acc += simDt * this.timeScale;
      while (this.acc >= SIM_DT) {
        run.step(SIM_DT);
        if (this.mode === 'title') this.demoPilot.step(run, SIM_DT);
        else this.autopilot?.step(run, SIM_DT);
        this.acc -= SIM_DT;
        const events = run.drainEvents();
        if (this.mode !== 'title') for (const e of events) this.react(e, run);
      }
      if (this.mode === 'title' && run.mode === 'result') this.startDemo();
    }
    if (run && this.mode !== 'title') this.hud.update(run);
    this.stage.frame(this.mode === 'paused' ? 0 : dt, settings.current.reducedMotion);
    this.stage.render();
    if (this.mode === 'title') this.probeQuality(dt);
  };

  /** Auto quality: watch frame times on the title screen and step down if this device is struggling. */
  private probeQuality(dt: number): void {
    const p = this.probe;
    if (p.done || settings.current.quality !== 'auto') return;
    p.t += dt;
    if (p.t < 1.2) return;
    p.samples.push(dt * 1000);
    if (p.t < 3.4) return;
    const sorted = [...p.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const tier = this.stage.currentTier;
    const down: Record<Tier, Tier> = { high: 'medium', medium: 'low', low: 'low' };
    if (median > 21 && tier !== 'low') {
      settings.update({ detectedTier: down[tier] });
      p.t = 0;
      p.samples = [];
      return;
    }
    if (!settings.current.detectedTier) settings.update({ detectedTier: tier });
    p.done = true;
  }

  // ------------------------------------------------------------------ events

  private react(e: SimEvent, run: Run): void {
    const alex = () => this.stage.alex.focus(this.tmp);
    const cam = this.stage.rig.camera;
    switch (e.type) {
      case 'countdown':
        this.hud.count(e.n);
        audio.count();
        break;
      case 'go':
        this.hud.count('GO');
        audio.go();
        this.music.start();
        if (!settings.current.seenHint) {
          this.hud.showHint(this.lastDevice);
          settings.update({ seenHint: true });
        }
        break;
      case 'move':
        if (e.action === 'left' || e.action === 'right') audio.lane();
        else if (e.action === 'jump') audio.jump();
        else if (e.action === 'slide') audio.slide();
        else audio.whoosh();
        this.hud.hideHint();
        break;
      case 'land':
        if (e.then === 'slide') audio.slide();
        else if (e.then === 'jump') audio.jump();
        else audio.land();
        break;
      case 'hit': {
        audio.hit();
        navigator.vibrate?.(70);
        this.stage.rig.shake(0.5);
        if (e.loss > 0) {
          this.stage.coins?.spill(this.stage.alex.root.position.clone(), e.loss, run.speed);
          this.hud.floater(`-${formatMoney(e.loss)}`, '#ff8b80', alex(), cam);
        }
        const lines = LINES[e.obstacle.type];
        const at = this.stage.obstacles?.anchor(e.obstacle);
        if (lines && at) this.hud.bubble(lines[Math.floor(Math.random() * lines.length)], at, cam);
        break;
      }
      case 'knock':
        audio.bonk();
        this.hud.popup('BONK!', '#ffb347', true);
        break;
      case 'near-miss':
        audio.whoosh();
        this.hud.popup('CLOSE ONE', '#bfe9ff', true);
        break;
      case 'activate':
        if (e.obstacle.type === 'ebike') audio.bell();
        break;
      case 'announce':
        if (e.obstacle.type === 'cab') {
          audio.honk();
          this.hud.popup('BLOCKING THE BOX!', '#ffd60a', true);
        } else audio.flap();
        break;
      case 'coin': {
        const v = e.coin.value;
        audio.coin(v);
        const p = alex();
        this.stage.particles.sparkle(p.x, p.y + 0.3, p.z - 0.6, v >= 100 ? [0.7, 1, 0.6] : [1, 0.95, 0.75], v >= 25 ? 7 : 4, 2.2, -run.speed);
        if (v >= 500) {
          this.hud.popup('FOUND A FIVE!', '#c3f584');
          this.hud.floater('+$5!', '#c3f584', p, cam);
          if (!settings.current.reducedMotion) this.slowMo = 0.5;
        } else if (v >= 100) this.hud.floater('+$1', '#c3f584', p, cam);
        else if (v >= 25 || Math.random() < 0.3) this.hud.floater(`+${v}¢`, '#fff6c9', p, cam);
        break;
      }
      case 'powerup': {
        const [name, sub] = POWERUP_NAMES[e.powerup.kind];
        if (e.powerup.kind === 'slice') audio.power();
        else if (e.powerup.kind === 'cat') audio.meow();
        this.hud.popup(name, e.powerup.kind === 'express' ? '#9ae6df' : '#ffd28a');
        this.hud.popup(sub, '#fff', true);
        navigator.vibrate?.(30);
        break;
      }
      case 'express-start': {
        audio.express();
        const next = Math.max(run.level.landmarks.finishStreet + 1, run.street - Math.round((e.to - e.from) / LEVEL2.crossStreets.spacing));
        this.hud.showExpress(true, next);
        break;
      }
      case 'express-land':
        audio.doors();
        this.hud.showExpress(false);
        this.hud.popup('BACK ON 7TH AVE', '#fff', true);
        break;
      case 'tick':
        audio.tick();
        if (e.seconds <= 5) this.music.tempo = 150;
        break;
      case 'sold-out':
        this.music.stop();
        audio.sad();
        this.hud.popup('SOLD OUT!', '#ff6b6b');
        break;
      case 'finish': {
        this.music.stop();
        audio.cheer();
        this.stage.swingToPenn();
        this.hud.show(false);
        this.stage.particles.confetti(2.2, 3.2, -(run.level.length + 2), 70);
        this.mode = 'outro';
        break;
      }
      case 'result':
        this.finish(e.result);
        break;
      case 'street':
        break;
    }
  }

  private finish(r: RunResult): void {
    this.mode = 'outro';
    if (this.daily) {
      const key = BEST_KEY(this.dayKey);
      const best = storage.get<Best | null>(key, null);
      const score = (b: Best) => (b.finished ? 1e7 : 0) + b.stars * 1e6 + b.cash;
      const mine: Best = { finished: r.finished, stars: r.stars, cash: r.cash };
      if (!best || score(mine) > score(best)) storage.set(key, mine);
    }
    const reveal = () => {
      this.screens.counter(false);
      this.hud.show(false);
      this.mode = 'result';
      this.screens.result(r, (_i, last) => {
        audio.printer(1);
        if (!last) return;
        if (r.finished && r.tier) audio.register();
        else audio.sad();
      });
    };
    if (r.finished) {
      // let the camera swing and Alex ride the escalator down, then cut to the counter
      setTimeout(() => {
        this.screens.counter(true);
        audio.register();
      }, 1100);
      setTimeout(reveal, 2600);
    } else setTimeout(reveal, 400);
  }
}
