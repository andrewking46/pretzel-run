// Renders the link-preview art into public/: the 1200×630 Open Graph image (a staged in-game shot of Alex
// running through Times Square under the street-sign title) and the pretzel icons.
// Starts its own Vite dev server. Usage: node scripts/share-image.ts [shot.json overrides]
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { pretzelCurve, SALT } from '../src/ui/icons.ts';

const OUT = 'public';
const W = 1200;
const H = 630;

// Alex mid-leap through Times Square (between 43rd and 42nd), reaching for the $1 bill at the top of a
// cash arc. The camera is ahead of him looking back uptown, low, with the sun turned to light his face.
const shot = {
  seed: 11,
  dist: 543.6,
  lane: 1,
  /** sideways nudge off the lane center, so the bill sits by his hand instead of in front of him */
  nudge: 0.45,
  y: 1.15,
  phase: 1.1,
  billAngle: 0.35,
  cam: [1.3, 1.0, -5.2],
  look: [1.3, 2.25, 4],
  fov: 34,
  sun: [30, 22, -34],
  ...JSON.parse(process.argv[2] ?? '{}'),
};

// ---------- icons ----------

const svgPath = (s: number) => {
  const { start, segments } = pretzelCurve(s);
  return `M${start.map(n => n.toFixed(1)).join(' ')}` + segments.map(seg => `C${seg.map(n => n.toFixed(1)).join(' ')}`).join('');
};

/** The pretzel, centered on 0,0 at scale `s`, as SVG defs + shapes. */
function pretzelSvg(s: number): { defs: string; shapes: string } {
  const d = svgPath(s);
  // the first rope segment drawn again on top, so the arms cross over/under like a real twist
  const { start, segments } = pretzelCurve(s);
  const over = `M${start.join(' ')}C${segments[0].join(' ')}C${segments[1].join(' ')}`;
  const rope = (path: string, cap: string) => `
    <path d="${path}" stroke="#4a230a" stroke-width="${s * 0.36}" stroke-linecap="${cap}"/>
    <path d="${path}" stroke="url(#bake)" stroke-width="${s * 0.27}" stroke-linecap="${cap}"/>
    <path d="${path}" stroke="#ffe2b0" stroke-opacity=".55" stroke-width="${s * 0.06}" stroke-linecap="${cap}" transform="translate(${-s * 0.03} ${-s * 0.055})"/>`;
  const salt = SALT.map(([x, y, a]) => `<rect x="${(x * s - s * 0.03).toFixed(1)}" y="${(y * s - s * 0.02).toFixed(1)}" width="${(s * 0.06).toFixed(1)}" height="${(s * 0.04).toFixed(1)}" rx="${(s * 0.012).toFixed(1)}" fill="#fff" transform="rotate(${a} ${(x * s).toFixed(1)} ${(y * s).toFixed(1)})"/>`).join('');
  return {
    defs: `<linearGradient id="bake" x1="0" y1="-1" x2="0" y2="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(${s})"><stop offset="0" stop-color="#d98a3a"/><stop offset="1" stop-color="#a95a1c"/></linearGradient>`,
    shapes: `<g fill="none" stroke-linejoin="round">
    <path d="${d}" stroke="#000" stroke-opacity=".28" stroke-width="${s * 0.36}" stroke-linecap="round" transform="translate(0 ${s * 0.07})"/>
    ${rope(d, 'round')}
    ${rope(over, 'butt')}
    ${salt}
  </g>`,
  };
}

/** The green street-sign square with the pretzel on it. `corner` 0 = full bleed (iOS and maskable crop it). */
function iconSvg({ corner, border, scale }: { corner: number; border: boolean; scale: number }): string {
  const pretzel = pretzelSvg(scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sign" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#138a51"/><stop offset="1" stop-color="#0a5531"/></linearGradient>
    ${pretzel.defs}
  </defs>
  <rect width="512" height="512" rx="${corner}" fill="url(#sign)"/>
  ${border ? '<rect x="30" y="30" width="452" height="452" rx="86" fill="none" stroke="#fff" stroke-width="14"/>' : ''}
  <g transform="translate(256 262)">${pretzel.shapes}</g>
</svg>
`;
}

const icons = {
  'icon.svg': { corner: 112, border: true, scale: 172 },
  'apple-touch-icon.png': { corner: 0, border: true, scale: 172, size: 180 },
  'icon-32.png': { corner: 112, border: false, scale: 205, size: 32 },
  'icon-192.png': { corner: 112, border: true, scale: 172, size: 192 },
  'icon-512.png': { corner: 112, border: true, scale: 172, size: 512 },
  'icon-maskable-512.png': { corner: 0, border: false, scale: 150, size: 512 },
} as const;

// ---------- render ----------

const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls!.local[0];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

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

  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('page error:', e.message));
  await page.goto(url);
  await page.waitForFunction('window.__PR?.mode === "title"');
  await page.evaluate(({ seed, dist, lane, nudge, y }) => {
    const PR = (window as any).__PR;
    PR.start(false, seed);
    PR.game.stage.setTier('high');
    PR.teleport(dist);
    PR.speed(0);
    PR.run.step(1e-4); // fills the sim's live window so the obstacles around Alex get drawn
    // keep the bill he's grabbing; this close to the lens the coins around it read as gray discs
    for (const c of PR.run.course.coins) if (c.value < 100 && c.d > dist - 8 && c.d < dist + 12) c.taken = true;
    const p = PR.run.player;
    p.lane = lane;
    p.x = [-1.6, 0, 1.6][lane] + nudge;
    p.y = y;
    p.air = y > 0;
  }, shot);
  await page.waitForTimeout(1200);

  await page.evaluate(s => {
    const PR = (window as any).__PR;
    const st = PR.game.stage;
    const w = st.world;
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('on'));
    document.getElementById('hud')!.classList.add('hidden');

    // keep the blocks Alex has already run (the shot looks back up the avenue)
    w.city.update(PR.run.dist - 260, 0, 600, Infinity);
    w.city.update = () => {};

    // turn the bill he's grabbing to face the lens
    const bill = PR.run.course.coins.find((c: any) => c.value >= 100 && Math.abs(c.d - PR.run.dist) < 3);
    if (bill) {
      const coinsUpdate = w.coins.update.bind(w.coins);
      const t = (s.billAngle - bill.variant * 6.28) / 2.2;
      w.coins.update = (run: unknown, dt: number, _t: number, ...rest: unknown[]) => coinsUpdate(run, dt, t, ...rest);
    }

    // hold one stride
    const alex = st.alex;
    const alexUpdate = alex.update.bind(alex);
    alex.update = (run: unknown, _dt: number, ...rest: unknown[]) => {
      alex.phase = s.phase;
      alexUpdate(run, 0, ...rest);
    };

    // turn the sun around so it lights Alex's face, and put the shadow box behind him
    const frame = st.frame.bind(st);
    st.frame = (dt: number, rm: boolean) => {
      frame(dt, rm);
      const p = alex.root.position;
      st.sun.target.position.set(p.x, 0, p.z + 14);
      st.sun.position.copy(st.sun.target.position).add({ x: s.sun[0], y: s.sun[1], z: s.sun[2] });
    };

    const cam = st.rig.camera;
    st.rig.update = () => {
      const p = alex.root.position;
      cam.position.set(p.x + s.cam[0], s.cam[1], p.z + s.cam[2]);
      cam.lookAt(p.x + s.look[0], s.look[1], p.z + s.look[2]);
    };
    cam.clearViewOffset();
    cam.fov = s.fov;
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
  }, shot);
  await page.waitForTimeout(700);

  // title lockup, styled like the in-game street sign, with a pretzel stuck on its corner
  const sticker = pretzelSvg(100);
  await page.addStyleTag({
    content: `
      #og { position: fixed; inset: 0; z-index: 99; pointer-events: none; font-family: Archivo, sans-serif; }
      #og .shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(10,12,18,.5) 0%, rgba(10,12,18,.18) 40%, rgba(10,12,18,0) 58%),
        linear-gradient(0deg, rgba(10,12,18,.3) 0%, rgba(10,12,18,0) 26%); }
      #og .sign { position: absolute; left: 56px; top: 54px; background: #0d6b3f; border-radius: 18px; padding: 9px;
        box-shadow: 0 7px 0 #0a4d2e, 0 24px 50px rgba(0,0,0,.45); transform: rotate(-2.5deg); }
      #og .sign-in { border: 4.5px solid #fff; border-radius: 11px; padding: 16px 34px 10px; color: #fff; text-align: center; }
      #og small { display: block; font: 600 20px/1 Archivo; letter-spacing: .22em; opacity: .9; }
      #og h1 { margin: 8px 0 0; font: 400 128px/.86 "Bebas Neue"; letter-spacing: .02em; white-space: nowrap; }
      #og .sticker { position: absolute; right: -66px; top: -54px; width: 150px; height: 130px; transform: rotate(14deg);
        filter: drop-shadow(0 10px 14px rgba(0,0,0,.4)); }
      #og .tag { position: absolute; left: 70px; top: 404px; display: flex; flex-direction: column; gap: 14px; }
      #og .tag span { align-self: flex-start; background: #fbf3e4; color: #16181d; border-radius: 999px; padding: 11px 22px 10px;
        font: 800 27px/1 Archivo; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
      #og .tag span b { color: #d8342c; }
      #og .tag .clock { background: rgba(14,16,22,.8); color: #fff; font: 400 38px/1 "Bebas Neue"; letter-spacing: .06em; padding: 10px 20px 6px; }
      #og .tag .clock em { font-style: normal; color: #f2c26b; margin-right: 12px; font-size: 24px; letter-spacing: .14em; vertical-align: 5px; }
    `,
  });
  await page.evaluate(sticker => {
    const og = document.createElement('div');
    og.id = 'og';
    og.innerHTML = `
      <div class="shade"></div>
      <div class="sign">
        <div class="sign-in"><small>7 AV · MIDTOWN</small><h1>Alex's<br>Pretzel Run</h1></div>
        <svg class="sticker" viewBox="-115 -100 230 200"><defs>${sticker.defs}</defs>${sticker.shapes}</svg>
      </div>
      <div class="tag">
        <span>W 50 St <b>→</b> Penn Station</span>
        <span class="clock"><em>FRESH BATCH</em>1:50</span>
      </div>`;
    document.body.append(og);
  }, sticker);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // render at 2×, then downsample in the page for clean edges and a small JPEG
  const big = await page.screenshot({ type: 'png' });
  const jpeg = await page.evaluate(
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
      return c.toDataURL('image/jpeg', 0.86).split(',')[1];
    },
    { png: big.toString('base64'), w: W, h: H },
  );
  writeFileSync(`${OUT}/og.jpg`, Buffer.from(jpeg, 'base64'));
  console.log(`wrote ${OUT}/og.jpg (${Math.round((jpeg.length * 3) / 4 / 1024)} KB) and ${Object.keys(icons).length} icons`);
} finally {
  await browser.close();
  await server.close();
}
