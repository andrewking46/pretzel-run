// Frame-time check: 30 s of autopilot play per configuration, against the e2e build.
// Usage: npm run build:e2e && npx vite preview --outDir dist-e2e --port 4173 &  node scripts/perf.ts [seconds=30]
import { chromium } from '@playwright/test';

const base = process.env.PERF_URL ?? 'http://127.0.0.1:4173';
const seconds = Number(process.argv[2] ?? 30);
const GPU = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];

const configs = [
  { name: 'desktop high', viewport: { width: 1280, height: 800 }, dpr: 1, cpu: 1, tier: 'high', mobile: false },
  { name: 'desktop medium', viewport: { width: 1280, height: 800 }, dpr: 1, cpu: 1, tier: 'medium', mobile: false },
  { name: 'desktop low', viewport: { width: 1280, height: 800 }, dpr: 1, cpu: 1, tier: 'low', mobile: false },
  { name: 'phone medium, 4x CPU', viewport: { width: 390, height: 844 }, dpr: 3, cpu: 4, tier: 'medium', mobile: true },
  { name: 'phone low, 4x CPU', viewport: { width: 390, height: 844 }, dpr: 3, cpu: 4, tier: 'low', mobile: true },
];

const browser = await chromium.launch({ args: GPU });
console.log(`${seconds}s autopilot runs · ${base}\n`);
console.log('config                     avg ms   p95 ms   max ms   >33ms   fps   draws');
for (const c of configs) {
  const ctx = await browser.newContext({ viewport: c.viewport, deviceScaleFactor: c.dpr, isMobile: c.mobile, hasTouch: c.mobile });
  await ctx.addInitScript(tier => {
    localStorage.setItem('pretzel-run/settings/v1', JSON.stringify({ quality: tier, seenHint: true, music: false, sfx: false }));
  }, c.tier);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(base);
  await page.waitForFunction('window.__PR?.mode === "title"');
  if (c.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: c.cpu });
  await page.evaluate('__PR.start(false, 20261122); __PR.autopilot(true)');
  await page.waitForTimeout(5000);
  const stats = (await page.evaluate(`new Promise(done => {
    const times = []; let draws = 0; let last = performance.now(); const end = last + ${seconds * 1000};
    const tick = now => {
      times.push(now - last); last = now;
      draws = Math.max(draws, __PR.renderInfo().calls);
      if (now < end && __PR.run.mode !== 'result') requestAnimationFrame(tick); else done({ times, draws });
    };
    requestAnimationFrame(tick);
  })`)) as { times: number[]; draws: number };
  const t = stats.times.slice(1);
  const sorted = [...t].sort((a, b) => a - b);
  const avg = t.reduce((a, b) => a + b, 0) / t.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const max = sorted[sorted.length - 1];
  const over = t.filter(x => x > 33).length;
  console.log(
    `${c.name.padEnd(26)} ${avg.toFixed(1).padStart(6)} ${p95.toFixed(1).padStart(8)} ${max.toFixed(1).padStart(8)} ${String(over).padStart(7)} ${(1000 / avg).toFixed(0).padStart(5)} ${String(stats.draws).padStart(7)}`,
  );
  await ctx.close();
}
await browser.close();
