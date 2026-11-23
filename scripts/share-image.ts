// Renders the link-preview art into public/: the 1200×630 Open Graph image (the illustration from
// scripts/share-art.ts under the street-sign title) and the pretzel icons.
// Usage: node scripts/share-image.ts [--crop alex.png]  (the crop is a close-up of Alex, for judging the drawing)
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { iconSvg, OG_H, OG_W, ogScene, pretzelSvg } from './share-art.ts';

const OUT = 'public';

const icons = {
  'icon.svg': { corner: 112, border: true, scale: 172 },
  'apple-touch-icon.png': { corner: 0, border: true, scale: 172, size: 180 },
  'icon-32.png': { corner: 112, border: false, scale: 205, size: 32 },
  'icon-192.png': { corner: 112, border: true, scale: 172, size: 192 },
  'icon-512.png': { corner: 112, border: true, scale: 172, size: 512 },
  'icon-maskable-512.png': { corner: 0, border: false, scale: 150, size: 512 },
} as const;

// The title is the in-game street sign, with a pretzel stuck on its corner, plus the route and the clock.
const sticker = pretzelSvg(100);
const page = `<!doctype html>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo:wght@600;800&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; width: ${OG_W}px; height: ${OG_H}px; overflow: hidden; }
  .art { position: absolute; inset: 0; }
  .sign { position: absolute; left: 50px; top: 44px; background: #0d6b3f; border-radius: 18px; padding: 9px;
    box-shadow: 0 7px 0 #0a4d2e, 0 24px 50px rgba(20,10,30,.45); transform: rotate(-2.5deg); }
  .sign-in { border: 4.5px solid #fff; border-radius: 11px; padding: 16px 34px 10px; color: #fff; text-align: center; }
  small { display: block; font: 600 20px/1 Archivo; letter-spacing: .22em; opacity: .9; }
  h1 { margin: 8px 0 0; font: 400 118px/.86 "Bebas Neue"; letter-spacing: .02em; white-space: nowrap; }
  .sticker { position: absolute; right: -62px; top: -50px; width: 146px; height: 126px; transform: rotate(14deg);
    filter: drop-shadow(0 10px 14px rgba(20,10,30,.4)); }
  .tag { position: absolute; left: 62px; top: 392px; display: flex; flex-direction: column; gap: 14px; font-family: Archivo; }
  .tag span { align-self: flex-start; background: #fbf3e4; color: #16181d; border-radius: 999px; padding: 11px 22px 10px;
    font: 800 27px/1 Archivo; box-shadow: 0 8px 24px rgba(20,10,30,.35); }
  .tag b { color: #d8342c; }
  .tag .clock { background: rgba(20,16,34,.82); color: #fff; font: 400 38px/1 "Bebas Neue"; letter-spacing: .06em; padding: 10px 20px 6px; }
  .tag .clock em { font-style: normal; color: #f2c26b; margin-right: 12px; font-size: 24px; letter-spacing: .14em; vertical-align: 5px; }
</style>
<div class="art">${ogScene()}</div>
<div class="sign">
  <div class="sign-in"><small>7 AV · MIDTOWN</small><h1>Alex's<br>Pretzel Run</h1></div>
  <svg class="sticker" viewBox="-115 -100 230 200"><defs>${sticker.defs}</defs>${sticker.shapes}</svg>
</div>
<div class="tag">
  <span>W 50 St <b>→</b> Penn Station</span>
  <span class="clock"><em>FRESH BATCH</em>1:50</span>
</div>`;

const browser = await chromium.launch();
try {
  const iconPage = await browser.newPage();
  for (const [file, spec] of Object.entries(icons)) {
    const svg = iconSvg(spec);
    if (!('size' in spec)) {
      writeFileSync(`${OUT}/${file}`, svg);
      continue;
    }
    await iconPage.setViewportSize({ width: spec.size, height: spec.size });
    await iconPage.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await iconPage.screenshot({ path: `${OUT}/${file}`, omitBackground: true });
  }

  // render at 2×, then downsample in the page for clean edges and a small JPEG
  const og = await browser.newPage({ viewport: { width: OG_W, height: OG_H }, deviceScaleFactor: 2 });
  await og.setContent(page, { waitUntil: 'networkidle' });
  await og.evaluate(() => document.fonts.ready);
  const big = await og.screenshot({ type: 'png' });
  const jpeg = await og.evaluate(
    async ({ png, w, h }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d')!;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.88).split(',')[1];
    },
    { png: big.toString('base64'), w: OG_W, h: OG_H },
  );
  writeFileSync(`${OUT}/og.jpg`, Buffer.from(jpeg, 'base64'));
  if (process.argv.includes('--crop')) await og.screenshot({ path: process.argv[process.argv.indexOf('--crop') + 1], clip: { x: 560, y: 120, width: 420, height: 400 } });
  console.log(`wrote ${OUT}/og.jpg (${Math.round((jpeg.length * 3) / 4 / 1024)} KB) and ${Object.keys(icons).length} icons`);
} finally {
  await browser.close();
}
