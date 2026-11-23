// Captures the milestone screenshots on a phone-sized and a desktop viewport.
// Usage: node scripts/screenshots.ts [baseUrl=http://localhost:5173] [only=phone|desktop]
import { chromium, type Page } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5173';
const only = process.argv[3];
const out = 'tests/screenshots';
const GPU = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];

const devices = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};

const wait = (page: Page, ms: number) => page.waitForTimeout(ms);
const pr = <T,>(page: Page, f: string): Promise<T> => page.evaluate(f) as Promise<T>;

const browser = await chromium.launch({ args: GPU });
for (const [name, opts] of Object.entries(devices)) {
  if (only && only !== name) continue;
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));
  const shot = async (label: string) => {
    await page.screenshot({ path: `${out}/${name}-${label}.jpg`, type: 'jpeg', quality: 82 });
    console.log(`${name}-${label}`);
  };

  await page.goto(`${base}/?seed`);
  await wait(page, 3000);
  await shot('1-title');

  await pr(page, '__PR.start(false, 20261122); __PR.autopilot(true)');
  await wait(page, 1200);
  await shot('2-countdown');
  await wait(page, 3600);
  await shot('3-early-run');

  await pr(page, '__PR.teleport(395)');
  await wait(page, 1800);
  await shot('4-times-square');

  const cab = await pr<number | null>(page, `(() => { const r = __PR.run; const c = r.course.obstacles.find(o => o.type === 'cab' && o.meet > r.dist + 40); return c ? c.meet : null })()`);
  if (cab) {
    await pr(page, `__PR.teleport(${cab - 30})`);
    await wait(page, 1250);
    await shot('5-intersection-cab');
  }

  await pr(page, '__PR.forceExpress()');
  await wait(page, 900);
  await shot('6-express');
  await wait(page, 2500);

  await pr(page, '__PR.teleport(1372)');
  await wait(page, 2300);
  await shot('7-penn-finish');
  await wait(page, 1500);
  await shot('7b-counter');
  await page.waitForFunction('__PR.mode === "result"', null, { timeout: 15000 }).catch(() => {});
  await wait(page, 2600);
  await shot('8-receipt');

  if (errors.length) console.log(`${name} console errors:\n  ${errors.join('\n  ')}`);
  await ctx.close();
}
await browser.close();
