// Close-up lineups of the people, the obstacles and the power-ups, for judging the models.
// Needs the dev server on :5173. Usage: node scripts/lineup.ts outDir
import { chromium } from '@playwright/test';

const outDir = process.argv[2] ?? '.';
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/');
await page.waitForFunction('window.__PR?.mode === "title"');
await page.evaluate(`(() => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  __PR.start(false, 11); __PR.teleport(140); __PR.speed(0);
})()`);
await page.waitForTimeout(800);

const setup = (scene: 'people' | 'things' | 'powerups' | 'bike') =>
  page.evaluate(scene => {
    const PR = (window as any).__PR;
    const st = PR.game.stage;
    const w = st.world;
    document.getElementById('hud')!.classList.add('hidden');
    w.obstacles.group.visible = false;
    w.powerups.group.visible = false;
    w.coins.group.visible = false;
    w.traffic.group.visible = false;
    (window as any).__lineup?.removeFromParent();
    const Group = st.alex.root.constructor;
    const lineup = new Group();
    (window as any).__lineup = lineup;
    st.scene.add(lineup);
    const z0 = -(PR.run.dist + 9);
    const views: any[] = [];
    const fake = (type: string, x: number, z: number, extra: any = {}) => {
      const o = { id: 9000 + views.length, type, lane: 1, x, d: -z, meet: -z, speed: 0, activateAt: 0, hw: 0.5, y0: 0, y1: 1.8, depth: 1, variant: (views.length * 0.37) % 1, active: true, hit: false, knocked: false, gone: false, announced: false, ...extra };
      const v = w.obstacles.create(o);
      v.root.position.set(x, 0, z);
      lineup.add(v.root);
      views.push([v, o]);
    };
    st.alex.update = () => {};
    if (scene === 'people') {
      fake('zombie', -3.0, z0);
      fake('tourist', -1.8, z0, { pose: 'camera' });
      fake('tourist', -0.6, z0, { pose: 'map' });
      fake('walker', 0.6, z0);
      st.alex.root.position.set(1.8, 0, z0);
      st.alex.root.rotation.set(0, Math.PI - 0.35, 0);
      fake('ebike', 3.2, z0 - 0.6, { active: false });
    } else if (scene === 'things') {
      st.alex.root.position.set(100, 0, z0);
      fake('cart', -3.4, z0);
      fake('trash', -1.6, z0);
      fake('cellar', -0.1, z0);
      fake('sawhorse', 1.4, z0);
      fake('steam', 2.9, z0);
      fake('dogs', -2.2, z0 - 3.2, { leashedTo: undefined, active: true, speed: 1.3 });
      fake('pigeons', 0.2, z0 - 3.2);
      fake('ebike', 2.0, z0 - 3.4, { active: true, speed: 7.5 });
    } else if (scene === 'bike') {
      st.alex.root.position.set(100, 0, z0);
      fake('ebike', -0.4, z0 + 3.5, { active: true, speed: 7.5 });
      fake('zombie', 1.0, z0 + 3.5, { active: true, speed: 1.1 });
    } else {
      st.alex.root.position.set(100, 0, z0);
      const p = w.powerups;
      for (const [i, kind] of ['slice', 'cat', 'express'].entries()) {
        const v = p.create({ id: 800 + i, kind, lane: 1, x: -1.6 + i * 1.6, y: 0.9, d: 0, taken: false });
        v.position.set(-1.6 + i * 1.6, 0.9, z0 + 4);
        lineup.add(v);
      }
    }
    st.rig.update = () => {};
    const cam = st.rig.camera;
    cam.clearViewOffset();
    cam.fov = scene === 'powerups' ? 26 : 34;
    cam.aspect = 1280 / 720;
    cam.updateProjectionMatrix();
    cam.position.set(0, 1.55, z0 + (scene === 'powerups' ? 11 : 7.5));
    cam.lookAt(0, scene === 'powerups' ? 0.9 : 0.85, z0 - (scene === 'things' ? 1.5 : 0));
    let t = 0;
    const tick = () => {
      t += 1 / 60;
      for (const [v, o] of views) w.obstacles.animate(v, o, t, 1 / 60, 5);
      if ((window as any).__lineup === lineup) requestAnimationFrame(tick);
    };
    tick();
  }, scene);

for (const scene of ['people', 'things', 'powerups', 'bike'] as const) {
  await setup(scene);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}/lineup-${scene}.jpg`, type: 'jpeg', quality: 88 });
}
await b.close();
