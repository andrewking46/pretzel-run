import type { Command, CommandHandler } from './commands.ts';

// Polled once per frame. Edges only: holding a direction doesn't repeat.
const BUTTONS: [number, Command][] = [
  [14, 'left'], [15, 'right'], [12, 'jump'], [13, 'slide'],
  [0, 'jump'], [1, 'slide'], [9, 'pause'], [8, 'pause'],
];

export class GamepadInput {
  private held = new Set<string>();
  private readonly handle: CommandHandler;

  constructor(handle: CommandHandler) {
    this.handle = handle;
  }

  poll(): void {
    const pads = navigator.getGamepads?.() ?? [];
    const now = new Set<string>();
    for (const pad of pads) {
      if (!pad) continue;
      for (const [i, cmd] of BUTTONS) if (pad.buttons[i]?.pressed) now.add(cmd + (i === 0 || i === 9 ? ':c' : ''));
      const [ax, ay] = pad.axes;
      if (ax < -0.6) now.add('left');
      if (ax > 0.6) now.add('right');
      if (ay < -0.6) now.add('jump');
      if (ay > 0.6) now.add('slide');
    }
    for (const key of now) {
      if (this.held.has(key)) continue;
      const cmd = key.split(':')[0] as Command;
      this.handle(cmd, 'gamepad');
      if (key.endsWith(':c')) this.handle('confirm', 'gamepad');
    }
    this.held = now;
  }
}
