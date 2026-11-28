// Battery and memory check, against the e2e build on a phone profile (4x CPU throttle, medium tier):
// how busy the main thread is and how many frames get drawn on each screen, then GPU objects and JS heap
// after five more runs, which should hold steady (growth means something isn't being freed).
// Usage: npm run build:e2e && npx vite preview --outDir dist-e2e --port 4173 --host 127.0.0.1 &  node scripts/battery.ts
import { chromium } from '@playwright/test';

const base = process.env.PERF_URL ?? 'http://127.0.0.1:4173';
const GPU = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'];

const browser = await chromium.launch({ args: GPU });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  localStorage.setItem('pretzel-run/settings/v1', JSON.stringify({ quality: 'medium', detectedTier: 'medium', seenHint: true, music: false, sfx: false }));
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.goto(base);
await page.waitForFunction('window.__PR?.mode === "title"');
await page.evaluate(`(() => {
  window.__draws = 0;
  const stage = __PR.game.stage;
  const render = stage.render.bind(stage);
  stage.render = () => { window.__draws++; render(); };
})()`);

const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
const gpu = () => page.evaluate('(() => { const i = __PR.game.stage.renderer.info; return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs.length }; })()') as Promise<Record<string, number>>;
const rows: Record<string, string | number>[] = [];
async function screen(name: string, ms: number) {
  const a = await metrics();
  const d0 = (await page.evaluate('window.__draws')) as number;
  const t0 = Date.now();
  await page.waitForTimeout(ms);
  const b = await metrics();
  const d1 = (await page.evaluate('window.__draws')) as number;
  const s = (Date.now() - t0) / 1000;
  rows.push({ screen: name, 'busy %': Math.round(((b.TaskDuration - a.TaskDuration) / s) * 100), 'frames/s': Math.round((d1 - d0) / s), 'heap MB': +(b.JSHeapUsedSize / 1e6).toFixed(1) });
}

await page.waitForTimeout(4000); // past the quality probe and the crowd warm-up
await screen('title', 6000);
await page.evaluate('__PR.start(false, 20261122); __PR.autopilot(true)');
await page.waitForTimeout(5000);
await screen('play', 12000);
await page.evaluate('__PR.game.pause()');
await page.waitForTimeout(500);
await screen('paused', 5000);
await page.evaluate('__PR.game.resume(); __PR.teleport(1372)');
await page.waitForFunction('__PR.mode === "result"', null, { timeout: 60000 });
await page.waitForTimeout(3000);
await screen('result', 6000);
console.log(`phone profile, 4x CPU, medium tier · ${base}`);
console.table(rows);

const after: string[] = [];
for (let i = 0; i < 5; i++) {
  await page.evaluate(`__PR.start(false, ${1000 + i}); __PR.autopilot(true)`);
  await page.waitForTimeout(2500);
  await page.evaluate('__PR.teleport(1372)');
  await page.waitForFunction('__PR.mode === "result"', null, { timeout: 60000 });
  await page.evaluate('window.gc?.()');
  const m = await metrics();
  const g = await gpu();
  after.push(`${(m.JSHeapUsedSize / 1e6).toFixed(1)} MB, ${g.geometries} geometries, ${g.textures} textures, ${g.programs} programs`);
}
console.log(`after each of 5 more runs:\n  ${after.join('\n  ')}`);
await browser.close();
