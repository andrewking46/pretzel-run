import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Group, InstancedMesh, LineBasicMaterial, LineSegments,
  Matrix4, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Sprite, SpriteMaterial, Vector3, type Material,
} from 'three';
import type { Obstacle } from '../sim/course.ts';
import type { Run } from '../sim/run.ts';
import type { Particles } from '../fx/particles.ts';
import type { Atlas } from '../world/atlas.ts';
import { toZ } from '../world/layout.ts';
import {
  assemble, carGeometry, cartGeometry, cartSign, cellarGeometry, ebikeGeometry, ebikeLamp, pigeonGeometry,
  plywoodSign, sawhorseGeometry, shedGeometry, shedLights, steamStackGeometry, trashGeometry,
} from './models.ts';
import type { Crowd, Role } from './crowd.ts';
import { buildDog, disposeDog, trot, type Dog } from './dog.ts';
import { pose, type Motion, type Person } from './people.ts';

// Renders the sim's obstacles near the player: builds a view when one comes into range, animates it,
// sends knocked ones tumbling, and drops views once they're behind and settled.

export interface ObstacleMaterials {
  toy: Material;
  glow: Material;
  sign: Material;
}

interface Tumble {
  v: Vector3;
  w: Vector3;
  t: number;
}

interface View {
  root: Group;
  person?: Person;
  role?: Role;
  motion: Motion;
  phase: number;
  head: number;
  tumble?: Tumble;
  animate?: (t: number, dt: number) => void;
  dispose?: () => void;
}

const RANGE_AHEAD = 150;
const RANGE_BEHIND = -14;

export class Obstacles {
  readonly group = new Group();
  private readonly views = new Map<number, View>();
  private readonly mats: ObstacleMaterials;
  private readonly atlas: Atlas;
  private readonly particles: Particles;
  private readonly blobs: InstancedMesh;
  private readonly flashTexture = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  private readonly headlightTexture = radialTexture('rgba(255,250,210,1)', 'rgba(255,240,180,0)');
  private readonly m = new Matrix4();

  private readonly crowd: Crowd;

  constructor(mats: ObstacleMaterials, atlas: Atlas, particles: Particles, crowd: Crowd) {
    this.crowd = crowd;
    this.mats = mats;
    this.atlas = atlas;
    this.particles = particles;
    this.blobs = new InstancedMesh(
      new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.42)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }),
      64,
    );
    this.blobs.renderOrder = 2;
    this.blobs.frustumCulled = false;
    this.group.add(this.blobs);
  }

  /** World position above an obstacle's head, for speech bubbles. */
  anchor(o: Obstacle, out = new Vector3()): Vector3 {
    const v = this.views.get(o.id);
    if (v) return out.copy(v.root.position).setY(v.root.position.y + v.head);
    return out.set(o.x, o.y1 + 0.3, toZ(o.d));
  }

  update(run: Run, dt: number, t: number, ground: (d: number) => number): void {
    const seen = new Set<number>();
    for (const o of run.nearbyObstacles) {
      const z = o.d - run.dist;
      if (o.gone || z > RANGE_AHEAD || z < RANGE_BEHIND) continue;
      seen.add(o.id);
      let v = this.views.get(o.id);
      if (!v) {
        v = this.create(o);
        this.views.set(o.id, v);
        this.group.add(v.root);
      }
      if (o.knocked && !v.tumble) this.startTumble(v, o, run);
      if (!v.tumble) {
        v.root.position.set(o.x, ground(o.d), toZ(o.d));
        if (o.type === 'dogs') this.layoutLeash(v, o, run);
      }
      this.animate(v, o, t, dt, z);
    }
    let blobs = 0;
    for (const [id, v] of this.views) {
      if (v.tumble) {
        this.tumble(v, dt);
        if (v.tumble.t > 2.4) this.remove(id);
        continue;
      }
      if (!seen.has(id)) {
        this.remove(id);
        continue;
      }
      if (blobs < 64 && v.head > 0.4) {
        const p = v.root.position;
        const s = v.head > 2.5 ? 1.5 : 1.0;
        this.m.makeScale(s, 1, s).setPosition(p.x, p.y + 0.02, p.z);
        this.blobs.setMatrixAt(blobs++, this.m);
      }
    }
    this.blobs.count = blobs;
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    for (const id of [...this.views.keys()]) this.remove(id);
  }

  private remove(id: number): void {
    const v = this.views.get(id);
    if (!v) return;
    this.group.remove(v.root);
    if (v.person && v.role) this.crowd.release(v.role, v.person);
    v.dispose?.();
    this.views.delete(id);
  }

  private person(view: View, role: Role, o: Obstacle): Person {
    view.role = role;
    return this.crowd.acquire(role, o.variant);
  }

  private create(o: Obstacle): View {
    const root = new Group();
    const view: View = { root, motion: 'idle', phase: o.variant * 10, head: o.y1 };
    const { toy, glow, sign } = this.mats;
    switch (o.type) {
      case 'zombie': {
        view.person = this.person(view, 'phone', o);
        view.motion = 'phone';
        break;
      }
      case 'tourist': {
        const camera = o.pose === 'camera';
        view.person = this.person(view, camera ? 'camera' : 'map', o);
        view.motion = camera ? 'camera' : 'map';
        if (camera) {
          const flash = new Sprite(new SpriteMaterial({ map: this.flashTexture, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
          flash.scale.setScalar(1.1);
          flash.position.set(0.1, 1.5, 0.35);
          root.add(flash);
          view.animate = (t: number) => {
            const k = (t + o.variant * 7) % 3.2;
            flash.visible = k < 0.12;
          };
        }
        break;
      }
      case 'walker':
        view.person = this.person(view, 'walker', o);
        view.motion = 'walk';
        break;
      case 'ebike': {
        view.person = this.person(view, 'courier', o);
        view.motion = 'ride';
        const bike = assemble([[ebikeGeometry(), toy], [ebikeLamp(), glow, false]]);
        root.add(bike);
        const beam = new Sprite(new SpriteMaterial({ map: this.headlightTexture, blending: AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.9 }));
        beam.scale.set(1.1, 0.75, 1);
        beam.position.set(0, 0.96, 0.78);
        root.add(beam);
        view.person.object.position.set(0, -0.05, -0.15);
        view.animate = t => {
          beam.material.opacity = 0.55 + 0.2 * Math.sin(t * 9);
        };
        break;
      }
      case 'dogs': {
        const n = 2 + Math.floor(o.variant * 2.99);
        const dogs: Dog[] = [];
        for (let i = 0; i < n; i++) {
          const d = buildDog((o.variant * 7.13 + i * 0.37) % 1);
          d.object.position.set(-0.4 + (0.8 * i) / Math.max(1, n - 1), 0, (i % 2) * 0.35 - 0.1);
          d.object.rotation.y = (i - (n - 1) / 2) * 0.12;
          dogs.push(d);
          root.add(d.object);
        }
        const leash = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: '#d33' }));
        leash.geometry.setAttribute('position', new BufferAttribute(new Float32Array(n * 6), 3));
        leash.frustumCulled = false;
        root.add(leash);
        root.userData = { dogs, leash };
        view.animate = t => dogs.forEach((d, i) => trot(d, t + i * 0.37, o.active && !o.hit));
        view.dispose = () => {
          leash.geometry.dispose();
          dogs.forEach(disposeDog);
        };
        break;
      }
      case 'cart': {
        root.add(assemble([[cartGeometry(), toy], [cartSign(this.atlas), sign, false]]));
        const vendor = this.person(view, 'vendor', o);
        vendor.object.position.set(0.15, 0, -0.8);
        root.add(vendor.object);
        view.person = vendor;
        view.motion = 'vendor';
        break;
      }
      case 'trash':
        root.add(assemble([[trashGeometry(o.variant), toy]]));
        break;
      case 'cellar':
        root.add(assemble([[cellarGeometry(), toy]]));
        break;
      case 'sawhorse':
        root.add(assemble([[sawhorseGeometry(), toy]]));
        break;
      case 'steam':
        root.add(assemble([[steamStackGeometry(), toy]]));
        view.animate = (_t, dt) => {
          if (Math.random() < dt * 14) {
            const p = root.position;
            this.particles.puff(p.x + (Math.random() - 0.5) * 0.2, p.y + 2.4, p.z, { vy: 2.2 + Math.random(), vx: (Math.random() - 0.5) * 0.5, life: 1.8, size: 0.8, grow: 2.8, alpha: 0.55 });
          }
        };
        break;
      case 'board':
        root.add(assemble([[shedGeometry(), toy], [shedLights(), glow, false], [plywoodSign(this.atlas), sign, false]]));
        view.head = 2.6;
        break;
      case 'cab': {
        const car = assemble([[carGeometry('cab', '#f5c518'), toy]]);
        car.rotation.y = o.flip ? Math.PI / 2 : -Math.PI / 2;
        root.add(car);
        const [u0, v0, u1, v1] = this.atlas.uv('taxi');
        const signGeo = new BufferGeometry();
        const quad = (s: number) => [-0.3 * s, 1.68, 0.15 * s, 0.3 * s, 1.68, 0.15 * s, 0.3 * s, 1.86, 0.15 * s, -0.3 * s, 1.68, 0.15 * s, 0.3 * s, 1.86, 0.15 * s, -0.3 * s, 1.86, 0.15 * s];
        signGeo.setAttribute('position', new BufferAttribute(new Float32Array([...quad(1)]), 3));
        signGeo.setAttribute('uv', new BufferAttribute(new Float32Array([u0, v1, u1, v1, u1, v0, u0, v1, u1, v0, u0, v0]), 2));
        signGeo.setAttribute('color', new BufferAttribute(new Float32Array(18).fill(1.4), 3));
        signGeo.setAttribute('normal', new BufferAttribute(new Float32Array(18).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
        const roof = new Mesh(signGeo, sign);
        root.add(roof);
        view.head = 1.6;
        view.dispose = () => signGeo.dispose();
        break;
      }
      case 'pigeons': {
        const birds = new InstancedMesh(pigeonGeometry(), toy, 7);
        birds.castShadow = true;
        birds.frustumCulled = false;
        root.add(birds);
        const flock = Array.from({ length: 7 }, (_, i) => ({ x: Math.sin(i * 2.4 + o.variant * 9) * 1.6, z: Math.cos(i * 1.7 + o.variant * 5) * 1.3, y: 0, vx: 0, vy: 0, vz: 0, ry: i * 0.9, ph: i * 1.3 }));
        const mm = new Matrix4();
        const obj = new Object3D();
        view.head = 0;
        view.animate = (t, dt) => {
          flock.forEach((b, i) => {
            if (o.announced && b.vy === 0 && b.y === 0) {
              b.vy = 3 + Math.random() * 3;
              b.vx = (Math.random() - 0.5) * 5;
              b.vz = -2 - Math.random() * 3;
            }
            if (b.vy !== 0 || b.y > 0) {
              b.x += b.vx * dt;
              b.y += b.vy * dt;
              b.z += b.vz * dt;
              b.vy += 1.5 * dt;
              obj.rotation.set(-0.3, Math.atan2(b.vx, b.vz), Math.sin(t * 30 + b.ph) * 0.5);
            } else {
              obj.rotation.set(Math.max(0, Math.sin(t * 5 + b.ph)) * 0.6, b.ry, 0);
            }
            obj.position.set(b.x, b.y, b.z);
            obj.updateMatrix();
            mm.copy(obj.matrix);
            birds.setMatrixAt(i, mm);
          });
          birds.instanceMatrix.needsUpdate = true;
        };
        break;
      }
    }
    if (view.person) {
      view.person.mesh.castShadow = true;
      if (!view.person.object.parent) root.add(view.person.object);
      view.head = Math.max(view.head, 1.75);
    }
    return view;
  }

  private animate(v: View, o: Obstacle, t: number, dt: number, z: number): void {
    if (v.person) {
      let motion = v.motion;
      const moving = o.active && o.speed > 0 && !o.hit;
      if (o.type === 'walker' || o.type === 'zombie') {
        if (moving) v.phase += dt * (o.type === 'walker' ? 7 : 6);
        if (!moving && motion !== 'phone') motion = 'idle';
      }
      if (o.type === 'ebike') v.phase += dt * (moving ? 9 : 0);
      if (o.hit && !o.knocked && z < 6) motion = o.type === 'ebike' ? 'ride' : 'cheer';
      if (v.tumble) motion = 'tumble';
      pose(v.person, motion, motion === 'walk' || motion === 'phone' || motion === 'ride' ? v.phase : t + o.variant * 5);
    }
    v.animate?.(t, dt);
  }

  private layoutLeash(v: View, o: Obstacle, run: Run): void {
    const { dogs, leash } = v.root.userData as { dogs: Dog[]; leash: LineSegments };
    const walker = o.leashedTo !== undefined ? run.course.obstacles[o.leashedTo] : undefined;
    const pos = leash.geometry.attributes.position as BufferAttribute;
    const hx = walker ? walker.x - o.x + (walker.x > o.x ? -0.28 : 0.28) : 0;
    const hz = walker ? -(walker.d - o.d) + 0.15 : 0;
    dogs.forEach((d, i) => {
      pos.setXYZ(i * 2, hx, 0.95, hz);
      pos.setXYZ(i * 2 + 1, d.object.position.x, 0.44 * d.size, d.object.position.z + 0.22 * d.size);
    });
    pos.needsUpdate = true;
  }

  private startTumble(v: View, o: Obstacle, run: Run): void {
    const side = o.x === run.player.x ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(o.x - run.player.x);
    v.tumble = {
      v: new Vector3(side * (3 + Math.random() * 3), 6 + Math.random() * 2, -(run.speed * (0.9 + Math.random() * 0.4))),
      w: new Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9),
      t: 0,
    };
    this.particles.sparkle(v.root.position.x, v.root.position.y + 1, v.root.position.z, [1, 0.7, 0.3], 10, 4);
  }

  private tumble(v: View, dt: number): void {
    const tb = v.tumble!;
    tb.t += dt;
    const r = v.root;
    tb.v.y -= 18 * dt;
    r.position.addScaledVector(tb.v, dt);
    r.rotation.x += tb.w.x * dt;
    r.rotation.y += tb.w.y * dt;
    r.rotation.z += tb.w.z * dt;
    if (r.position.y < 0) {
      r.position.y = 0;
      tb.v.y *= -0.35;
      tb.v.x *= 0.7;
      tb.v.z *= 0.7;
      tb.w.multiplyScalar(0.6);
    }
    if (tb.t > 1.8) r.scale.setScalar(Math.max(0.01, 1 - (tb.t - 1.8) / 0.6));
    if (v.person) pose(v.person, 'tumble', tb.t);
  }
}

function radialTexture(inner: string, outer: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export { radialTexture };
