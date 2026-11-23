import { AdditiveBlending, Group, Mesh, Sprite, SpriteMaterial, Vector3, type Material } from 'three';
import { ALEX_LOOK } from '../config/alex.ts';
import type { Run } from '../sim/run.ts';
import type { Particles } from '../fx/particles.ts';
import { toZ } from '../world/layout.ts';
import { catGeometry } from './models.ts';
import { radialTexture } from './obstacles.ts';
import { buildPerson, pose, type Motion, type Person } from './people.ts';

// Alex: reads sim state, picks a motion, blends into it, and plays the finish and sold-out moments.

import { PENN_DOOR } from '../world/city.ts';

const DOOR = { x: 3.6, d: (PENN_DOOR.d0 + PENN_DOOR.d1) / 2 + 2.6 };

export class AlexView {
  readonly root = new Group();
  readonly person: Person;
  private readonly cat: Mesh;
  private readonly aura: Sprite;
  private phase = 0;
  private lean = 0;
  private finishT = -1;
  private finishFrom = new Vector3();
  private readonly snapshot = new Float32Array(11 * 3 + 1);

  constructor(toy: Material) {
    this.person = buildPerson({ ...ALEX_LOOK });
    this.person.object.rotation.y = Math.PI;
    this.root.add(this.person.object);

    this.cat = new Mesh(catGeometry(), toy);
    this.cat.scale.setScalar(0.62);
    this.cat.position.set(0.2, 0.52, -0.02);
    this.cat.castShadow = true;
    this.person.bones.spine.add(this.cat);

    this.aura = new Sprite(new SpriteMaterial({ map: radialTexture('rgba(255,170,60,0.9)', 'rgba(255,140,40,0)'), blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.aura.scale.set(2.6, 3.0, 1);
    this.aura.position.set(0, 1.0, 0.3);
    this.root.add(this.aura);
  }

  /** World-space point at Alex's chest, for floaters and the finish camera. */
  focus(out = new Vector3()): Vector3 {
    return out.copy(this.root.position).setY(this.root.position.y + 1.1);
  }

  reset(): void {
    this.finishT = -1;
    this.root.rotation.set(0, 0, 0);
    this.root.scale.setScalar(1);
    this.person.object.visible = true;
  }

  update(run: Run, dt: number, t: number, groundY: number, particles: Particles, reducedMotion: boolean): void {
    const p = run.player;
    const finishing = run.mode === 'finish' || (run.mode === 'result' && run.result?.finished);
    this.cat.visible = run.catT > 0;
    this.aura.visible = run.sliceT > 0;
    if (this.aura.visible) {
      const pulse = 1 + Math.sin(t * 12) * 0.08;
      this.aura.scale.set(2.6 * pulse, 3.0 * pulse, 1);
      if (!reducedMotion && Math.random() < dt * 40) {
        const x = this.root.position.x + (Math.random() - 0.5) * 3;
        particles.glow.emit({ x, y: 0.3 + Math.random() * 2.2, z: this.root.position.z - 2 - Math.random() * 3, vz: run.speed * 1.6, life: 0.22, size: 0.18, color: [1, 0.75, 0.4] });
      }
    }

    let motion: Motion = 'run';
    let amount = 1;
    if (finishing) {
      motion = this.finish(dt, groundY);
    } else {
      this.finishT = -1;
      this.root.position.set(p.x, groundY + p.y, toZ(run.dist));
      const dx = [-1.6, 0, 1.6][p.lane] - p.x;
      this.lean += (-dx * 0.22 - this.lean) * Math.min(1, dt * 12);
      this.root.rotation.set(0, dx * 0.12, this.lean);
      if (run.mode === 'countdown') motion = 'idle';
      else if (run.mode === 'sold-out' || run.mode === 'result') motion = 'slump';
      else if (p.stumbling) motion = 'stumble';
      else if (p.sliding) motion = 'slide';
      else if (p.air) {
        motion = 'jump';
        amount = Math.min(1, 0.45 + (p.y / 1.3) * 0.8);
      }
      if (p.sliding && !reducedMotion && Math.random() < dt * 30) particles.dust(p.x, groundY, toZ(run.dist) + 0.6, run.speed * 0.3);
    }
    if (motion === 'run') this.phase += dt * (Math.max(run.speed, 6) * 0.75 + 2);
    this.blend(motion, motion === 'run' ? this.phase : t, amount, dt);

    // invulnerability flicker
    const flicker = run.player.invulnerableT > 0 && run.mode === 'run' && Math.floor(t * 14) % 2 === 0;
    this.person.mesh.visible = !flicker && !run.express;
    this.cat.visible &&= this.person.mesh.visible;
  }

  /** Curve off the avenue and into the Penn Station doorway, then celebrate. */
  private finish(dt: number, groundY: number): Motion {
    if (this.finishT < 0) {
      this.finishT = 0;
      this.finishFrom.copy(this.root.position);
    }
    this.finishT += dt;
    const s = Math.min(1, this.finishT / 1.0);
    const e = s * s * (3 - 2 * s);
    const from = this.finishFrom;
    const cx = from.x * 0.4;
    const cz = toZ(DOOR.d - 0.4);
    const tz = toZ(DOOR.d);
    const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * cx + e * e * DOOR.x;
    const z = (1 - e) * (1 - e) * from.z + 2 * (1 - e) * e * cz + e * e * tz;
    const yaw = Math.atan2(x - this.root.position.x, -(z - this.root.position.z) + 1e-6);
    this.root.position.set(x, groundY, z);
    if (s < 1) {
      this.root.rotation.set(0, -yaw * 0.9, 0);
      return 'run';
    }
    // a quick celebration at the top of the escalator, then down he goes
    const after = this.finishT - 1.0;
    this.root.rotation.y += (Math.PI * 0.6 - this.root.rotation.y) * Math.min(1, dt * 6);
    if (after > 0.45) {
      const down = Math.min(1, (after - 0.45) / 1.2);
      this.root.position.x = DOOR.x + down * 2.2;
      this.root.position.y = groundY - down * 1.4;
      this.root.rotation.y += (-Math.PI / 2 - this.root.rotation.y) * Math.min(1, dt * 5);
      return 'idle';
    }
    return 'celebrate';
  }

  private blend(motion: Motion, t: number, amount: number, dt: number): void {
    const bones = Object.values(this.person.bones);
    bones.forEach((b, i) => {
      this.snapshot[i * 3] = b.rotation.x;
      this.snapshot[i * 3 + 1] = b.rotation.y;
      this.snapshot[i * 3 + 2] = b.rotation.z;
    });
    this.snapshot[33] = this.person.bones.root.position.y;
    pose(this.person, motion, t, amount);
    const k = Math.min(1, dt * 22);
    bones.forEach((b, i) => {
      b.rotation.x = this.snapshot[i * 3] + (b.rotation.x - this.snapshot[i * 3]) * k;
      b.rotation.y = this.snapshot[i * 3 + 1] + (b.rotation.y - this.snapshot[i * 3 + 1]) * k;
      b.rotation.z = this.snapshot[i * 3 + 2] + (b.rotation.z - this.snapshot[i * 3 + 2]) * k;
    });
    const r = this.person.bones.root;
    r.position.y = this.snapshot[33] + (r.position.y - this.snapshot[33]) * k;
  }
}
