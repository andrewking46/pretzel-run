// Close-up of Alex (dev check). Usage: node scripts/_closeup.ts out.jpg [head]
import { chromium } from '@playwright/test';
const head = process.argv[3] === 'head';
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:5173/');
await p.waitForFunction('window.__PR?.mode === "title"');
await p.evaluate(`(() => { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); __PR.start(false, 5); __PR.speed(0.0001); })()`);
await p.waitForTimeout(600);
await p.evaluate((head: boolean) => {
  const s = (window as any).__PR.game.stage;
  const a = s.alex.root.position;
  const cam = s.rig.camera;
  s.rig.update = () => {};
  cam.clearViewOffset();
  cam.fov = head ? 22 : 30;
  cam.aspect = 1.5;
  cam.updateProjectionMatrix();
  cam.position.set(a.x - (head ? 0.5 : 1.2), a.y + (head ? 1.85 : 1.3), a.z - (head ? 1.5 : 3.6));
  cam.lookAt(a.x, a.y + (head ? 1.72 : 0.95), a.z);
}, head);
await p.waitForTimeout(400);
await p.screenshot({ path: process.argv[2], type: 'jpeg', quality: 85 });
await b.close();
