import { AdditiveBlending, Group, Mesh, Sprite, SpriteMaterial, type Material } from 'three';
import type { Powerup } from '../sim/course.ts';
import type { Run } from '../sim/run.ts';
import { toZ } from '../world/layout.ts';
import { catGeometry, expressCardGeometry, sliceGeometry } from './models.ts';
import { radialTexture } from './obstacles.ts';

// Floating, spinning pickups with a colored halo and a soft light column so you can spot them early.

const HALO: Record<Powerup['kind'], [string, string]> = {
  slice: ['rgba(255,170,60,0.95)', 'rgba(255,140,40,0)'],
  cat: ['rgba(255,220,140,0.95)', 'rgba(255,200,120,0)'],
  express: ['rgba(120,230,220,0.95)', 'rgba(80,200,200,0)'],
};

export class Powerups {
  readonly group = new Group();
  private readonly views = new Map<number, Group>();
  private readonly toy: Material;
  private readonly halos: Record<Powerup['kind'], SpriteMaterial>;

  constructor(toy: Material) {
    this.toy = toy;
    this.halos = Object.fromEntries(
      Object.entries(HALO).map(([k, [a, b]]) => [k, new SpriteMaterial({ map: radialTexture(a, b), blending: AdditiveBlending, depthWrite: false, toneMapped: false })]),
    ) as Record<Powerup['kind'], SpriteMaterial>;
  }

  update(run: Run, t: number, ground: (d: number) => number): void {
    for (const p of run.course.powerups) {
      const z = p.d - run.dist;
      const show = !p.taken && z > -4 && z < 120 && !run.express;
      let v = this.views.get(p.id);
      if (!show) {
        if (v) {
          this.group.remove(v);
          this.views.delete(p.id);
        }
        continue;
      }
      if (!v) {
        v = this.create(p);
        this.views.set(p.id, v);
        this.group.add(v);
      }
      v.position.set(p.x, ground(p.d) + p.y + Math.sin(t * 3 + p.id) * 0.12, toZ(p.d));
      const model = v.children[0];
      model.rotation.y = t * 2.4;
      const beam = v.children[2] as Sprite;
      beam.material.opacity = Math.min(1, z / 30) * 0.5;
    }
  }

  clear(): void {
    for (const v of this.views.values()) this.group.remove(v);
    this.views.clear();
  }

  private create(p: Powerup): Group {
    const g = new Group();
    const geo = p.kind === 'slice' ? sliceGeometry() : p.kind === 'cat' ? catGeometry() : expressCardGeometry();
    const model = new Mesh(geo, this.toy);
    model.castShadow = true;
    if (p.kind === 'cat') model.position.y = -0.3;
    const halo = new Sprite(this.halos[p.kind]);
    halo.scale.setScalar(1.7);
    const beam = new Sprite(this.halos[p.kind].clone());
    beam.scale.set(0.9, 9, 1);
    beam.position.y = 4;
    g.add(model, halo, beam);
    return g;
  }
}
