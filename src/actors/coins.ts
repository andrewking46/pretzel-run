import { BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3, type BufferGeometry, type Material } from 'three';
import { COINS } from '../config/tuning.ts';
import type { Coin } from '../sim/course.ts';
import type { Run } from '../sim/run.ts';
import { toZ } from '../world/layout.ts';
import { castsShadow } from '../world/materials.ts';

// Every coin and bill on the route, drawn as four instanced meshes, plus the change that sprays
// out of Alex's pockets when he gets bumped.

interface Loose {
  p: Vector3;
  v: Vector3;
  spin: number;
  value: number;
  t: number;
}

const AHEAD = 95;

type Look = [BufferGeometry, Material];
let shared: Record<'dime' | 'quarter' | 'single' | 'five', Look> | null = null;

/** Shapes and materials for each kind of money, made once and shared by every run. */
function looks(): NonNullable<typeof shared> {
  if (shared) return shared;
  // Real dimes are tiny; these are toy-sized and lit from within so the safe path reads at speed.
  const metal = new MeshStandardMaterial({ color: '#dfe2ea', metalness: 0.85, roughness: 0.22, emissive: '#3a3a44', emissiveIntensity: 0.45 });
  const coin = (r: number, h: number) => new CylinderGeometry(r, r, h, 16).rotateX(Math.PI / 2);
  shared = {
    dime: [coin(0.19, 0.045), metal],
    quarter: [coin(0.25, 0.055), metal],
    single: [new BoxGeometry(0.66, 0.3, 0.014), new MeshStandardMaterial({ map: billTexture('1', '#b9d8a5', '#2f5d2a'), emissive: '#2a3a20', emissiveIntensity: 0.6 })],
    five: [new BoxGeometry(0.78, 0.35, 0.014), new MeshStandardMaterial({ map: billTexture('5', '#d6c8ea', '#4b2f7a'), emissive: '#3a2a50', emissiveIntensity: 0.8 })],
  };
  return shared;
}

function billTexture(label: string, paper: string, ink: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 56;
  const g = c.getContext('2d')!;
  g.fillStyle = paper;
  g.fillRect(0, 0, 128, 56);
  g.strokeStyle = ink;
  g.lineWidth = 3;
  g.strokeRect(4, 4, 120, 48);
  g.beginPath();
  g.ellipse(64, 28, 16, 19, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = ink;
  g.font = '800 22px Archivo, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, 24, 29);
  g.fillText(label, 104, 29);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Coins {
  readonly group = new Group();
  private readonly meshes: Record<'dime' | 'quarter' | 'single' | 'five', InstancedMesh>;
  private readonly order: Coin[];
  private start = 0;
  private loose: Loose[] = [];
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly p = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly c = new Color();

  constructor(coins: readonly Coin[]) {
    this.order = [...coins].sort((a, b) => a.d - b.d);
    const make = ([geo, mat]: Look, n: number) => {
      const im = new InstancedMesh(geo, mat, n);
      im.frustumCulled = false;
      im.count = 1; // drawn (hidden) once so its shader compiles behind the title screen
      im.setMatrixAt(0, new Matrix4().makeTranslation(0, -100, 0));
      im.setColorAt(0, this.c.setScalar(1)); // instance colors from the start, so the shader never changes
      castsShadow(im);
      this.group.add(im);
      return im;
    };
    const look = looks();
    this.meshes = { dime: make(look.dime, 240), quarter: make(look.quarter, 160), single: make(look.single, 16), five: make(look.five, 2) };
  }

  /** Throw `loss` cents of change out of Alex's pockets. */
  spill(at: Vector3, loss: number, speed: number): void {
    const n = Math.min(14, 3 + Math.round(loss / 40));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.loose.push({
        p: at.clone().add(new Vector3(0, 0.2, 0)),
        v: new Vector3(Math.cos(a) * (1.5 + Math.random() * 2.5), 3 + Math.random() * 3.5, -speed * 0.12 + Math.sin(a) * 2),
        spin: (Math.random() - 0.5) * 30,
        value: i % 3 ? 10 : 25,
        t: 0,
      });
    }
  }

  update(run: Run, dt: number, t: number, ground: (d: number) => number, alex: Vector3): void {
    const counts = { dime: 0, quarter: 0, single: 0, five: 0 };
    while (this.start < this.order.length && this.order[this.start].d < run.dist - 6 && !this.order[this.start].magnetized) this.start++;
    for (let i = this.start; i < this.order.length; i++) {
      const c = this.order[i];
      if (c.d > run.dist + AHEAD) break;
      if (c.taken || run.express) continue;
      const kind = c.value >= COINS.value.five ? 'five' : c.value >= COINS.value.single ? 'single' : c.value >= COINS.value.quarter ? 'quarter' : 'dime';
      const z = toZ(c.d);
      let scale = 1;
      if (c.magnetized) {
        const d = Math.hypot(c.x - alex.x, z - alex.z);
        scale = Math.min(1, 0.4 + d / 3);
      }
      const bills = kind === 'single' || kind === 'five';
      this.q.setFromAxisAngle(this.up, t * (bills ? 2.2 : 4) + c.variant * 6.28);
      this.s.setScalar(scale * (bills ? 1 : 1.15));
      this.m.compose(this.p.set(c.x, ground(c.d) + c.y + Math.sin(t * 3 + c.variant * 9) * 0.05, z), this.q, this.s);
      const mesh = this.meshes[kind];
      const n = counts[kind]++;
      if (n >= mesh.instanceMatrix.count) continue;
      mesh.setMatrixAt(n, this.m);
      const glint = Math.max(0, Math.sin(t * 2.3 + c.variant * 40)) ** 24;
      this.c.setScalar(1 + glint * 2.5);
      mesh.setColorAt(n, this.c);
    }
    // loose change bouncing on the sidewalk
    this.loose = this.loose.filter(l => (l.t += dt) < 1.6);
    for (const l of this.loose) {
      l.v.y -= 18 * dt;
      l.p.addScaledVector(l.v, dt);
      const floor = ground(-l.p.z) + 0.05;
      if (l.p.y < floor) {
        l.p.y = floor;
        l.v.y *= -0.45;
        l.v.x *= 0.7;
        l.v.z *= 0.7;
      }
      const kind = l.value >= 25 ? 'quarter' : 'dime';
      this.q.setFromAxisAngle(this.up, l.t * l.spin);
      this.s.setScalar(1.15 * Math.min(1, (1.6 - l.t) * 3));
      this.m.compose(l.p, this.q, this.s);
      const mesh = this.meshes[kind];
      const n = counts[kind]++;
      if (n >= mesh.instanceMatrix.count) continue;
      mesh.setMatrixAt(n, this.m);
      mesh.setColorAt(n, this.c.setScalar(1));
    }
    for (const [kind, mesh] of Object.entries(this.meshes)) {
      mesh.count = Math.min(counts[kind as keyof typeof counts], mesh.instanceMatrix.count);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Frees this run's instance buffers; the shared shapes and materials stay for the next run. */
  dispose(): void {
    for (const mesh of Object.values(this.meshes)) mesh.dispose();
  }
}
