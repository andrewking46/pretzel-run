import type { CommandHandler } from './commands.ts';

// Swipe anywhere. One action per gesture, fired the moment the finger passes the threshold;
// a quick tap without movement jumps (it can only be recognised on release).
const TAP_MS = 300;
const TAP_SLOP = 14;

export function listenTouch(surface: HTMLElement, handle: CommandHandler): void {
  let gesture: { id: number; x: number; y: number; t: number; fired: boolean } | null = null;
  const threshold = () => Math.max(22, Math.min(window.innerWidth, window.innerHeight) * 0.045);

  surface.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), fired: false };
    surface.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  surface.addEventListener('pointermove', e => {
    if (!gesture || gesture.fired || e.pointerId !== gesture.id) return;
    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    const th = threshold();
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    gesture.fired = true;
    const device = e.pointerType === 'mouse' ? 'keyboard' : 'touch';
    if (Math.abs(dx) > Math.abs(dy)) handle(dx < 0 ? 'left' : 'right', device);
    else handle(dy < 0 ? 'jump' : 'slide', device);
  });
  const end = (e: PointerEvent) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const quick = performance.now() - gesture.t < TAP_MS;
    const still = Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < TAP_SLOP;
    if (!gesture.fired && quick && still) handle('jump', e.pointerType === 'mouse' ? 'keyboard' : 'touch');
    gesture = null;
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', () => (gesture = null));

  // No pull-to-refresh, page scroll, pinch or double-tap zoom while playing.
  const block = (e: Event) => {
    if ((e.target as HTMLElement).closest('.screen')) return;
    e.preventDefault();
  };
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', block);
  document.addEventListener('dblclick', block);
  document.addEventListener('contextmenu', e => e.preventDefault());
}
