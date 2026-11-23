import { expect, test, type Page } from '@playwright/test';

// Drives the real game in a browser. The e2e build exposes window.__PR (stripped from production).

interface PR {
  mode: string;
  run: { mode: string; dist: number; player: { lane: number; air: boolean; slideT: number; sliding: boolean }; result: unknown };
  start(daily?: boolean, seed?: number): void;
  autopilot(on?: boolean): void;
  speed(k: number): void;
}
declare global {
  interface Window {
    __PR: PR;
  }
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__PR?.mode === 'title', null, { timeout: 20_000 });
}

/** Start a practice run on a fixed route and wait for GO. */
async function startRun(page: Page, seed = 777): Promise<void> {
  await page.evaluate(s => {
    window.__PR.start(false, s);
    window.__PR.speed(2);
  }, seed);
  await page.waitForFunction(() => window.__PR.run.mode === 'run');
  await page.evaluate(() => window.__PR.speed(1));
}

const player = (page: Page) => page.evaluate(() => ({ ...window.__PR.run.player, sliding: window.__PR.run.player.sliding }));

async function swipe(page: Page, dx: number, dy: number): Promise<void> {
  const vp = page.viewportSize()!;
  const x = vp.width / 2;
  const y = vp.height * 0.62;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 6, y: y + (dy * i) / 6 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('boots to the title screen with no console errors', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await expect(page.locator('#sTitle')).toBeVisible();
  await expect(page.locator('#bDaily')).toContainText("Today's Run");
  await expect(page.locator('#p3')).toHaveText('$31.41');
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('touch: swipes change lanes, jump and slide; a tap jumps', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'touch only');
  const errors = watchErrors(page);
  await boot(page);
  await page.locator('#bPractice').tap();
  await page.waitForFunction(() => window.__PR.run.mode === 'run', null, { timeout: 10_000 });

  await swipe(page, -120, 0);
  expect((await player(page)).lane).toBe(0);
  await swipe(page, 120, 0);
  expect((await player(page)).lane).toBe(1);
  await swipe(page, 0, -120);
  expect((await player(page)).air).toBe(true);
  await page.waitForFunction(() => !window.__PR.run.player.air);
  await swipe(page, 0, 120);
  expect((await player(page)).slideT).toBeGreaterThan(0);
  await page.waitForTimeout(900);
  const vp = page.viewportSize()!;
  await page.touchscreen.tap(vp.width / 2, vp.height * 0.6);
  await page.waitForTimeout(60);
  expect((await player(page)).air).toBe(true);
  expect(errors).toEqual([]);
});

test('keyboard: arrows, WASD and space steer Alex; Enter starts', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard only');
  await boot(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PR.run.mode === 'run', null, { timeout: 10_000 });
  await page.keyboard.press('ArrowLeft');
  expect((await player(page)).lane).toBe(0);
  await page.keyboard.press('KeyD');
  await page.keyboard.press('ArrowRight');
  expect((await player(page)).lane).toBe(2);
  await page.keyboard.press('Space');
  expect((await player(page)).air).toBe(true);
  await page.waitForFunction(() => !window.__PR.run.player.air);
  await page.keyboard.press('KeyS');
  expect((await player(page)).slideT).toBeGreaterThan(0);
});

test('pause and resume', async ({ page }, info) => {
  await boot(page);
  await startRun(page);
  if (info.project.name === 'phone') await page.locator('#pauseBtn').tap();
  else await page.keyboard.press('KeyP');
  await expect(page.locator('#sPause')).toBeVisible();
  const at = await page.evaluate(() => window.__PR.run.dist);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__PR.run.dist)).toBe(at);
  if (info.project.name === 'phone') await page.locator('#bResume').tap();
  else await page.keyboard.press('Escape');
  await expect(page.locator('#sPause')).toBeHidden();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__PR.run.dist)).toBeGreaterThan(at);
});

test('a full autopilot run reaches the receipt', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'one full run is enough');
  const errors = watchErrors(page);
  await boot(page);
  await startRun(page, 20261122);
  await page.evaluate(() => {
    window.__PR.autopilot(true);
    window.__PR.speed(5);
  });
  await page.waitForFunction(() => window.__PR.mode === 'result', null, { timeout: 90_000 });
  await expect(page.locator('#sResult')).toBeVisible();
  await expect(page.locator('#rReceipt')).toContainText('THANK YOU', { timeout: 5_000 });
  await expect(page.locator('#rStars span:not(.off)')).toHaveCount(3);
  expect(errors).toEqual([]);
});
