import type { Command, CommandHandler } from './commands.ts';

const KEYS: Record<string, Command> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'slide', KeyS: 'slide',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm',
};

export function listenKeyboard(handle: CommandHandler): void {
  window.addEventListener('keydown', e => {
    const cmd = KEYS[e.code];
    if (!cmd) return;
    // let buttons and form controls keep Space/Enter when focused on a menu
    const t = e.target as HTMLElement | null;
    if ((cmd === 'confirm' || e.code === 'Space') && t && t.closest('button, input, textarea')) return;
    e.preventDefault();
    if (!e.repeat) handle(cmd, 'keyboard');
  });
}
