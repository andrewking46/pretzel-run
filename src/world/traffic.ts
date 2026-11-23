import { Group, Mesh, type Material } from 'three';
import { carGeometry, carGlowGeometry, type CarKind } from '../actors/models.ts';
import type { Crowd } from '../actors/crowd.ts';
import { pose, type Person } from '../actors/people.ts';
import type { Course } from '../sim/course.ts';
import { deriveSeed, Rng } from '../sim/rng.ts';
import { STREET, toZ } from './layout.ts';

// Ambient life that never touches gameplay: southbound traffic on 7th Ave (slower than Alex, so he
// passes it), cars waiting at the lights on the cross streets, and people on the far sidewalk.

interface Car {
  mesh: Group;
  d: number;
  speed: number;
  lane: number;
  kind: CarKind;
}

interface Walker {
  person: Person;
  d: number;
  x: number;
  speed: number;
  phase: number;
}

const LANES = [-5.1, -8.1, -11.1, -14.1];
const PAINT = ['#2b2f3a', '#8b8f99', '#e8e8e8', '#6b1f24', '#20385e', '#3d5a3c', '#a9a59d'];

export class Traffic {
  readonly group = new Group();
  private cars: Car[] = [];
  private readonly waiting = new Map<number, Group>();
  private walkers: Walker[] = [];
  private readonly rng: Rng;
  private readonly course: Course;
  private readonly toy: Material;
  private readonly glow: Material;
  private spawnT = 0;
  onHonk: (() => void) | null = null;
  private readonly crowd: Crowd;

  constructor(course: Course, toy: Material, glow: Material, crowd: Crowd) {
    this.crowd = crowd;
    this.course = course;
    this.toy = toy;
    this.glow = glow;
    this.rng = new Rng(deriveSeed(course.seed, 'traffic'));
    for (let i = 0; i < 9; i++) this.spawnCar(-20 + i * 26 + this.rng.range(0, 10));
    for (let i = 0; i < 6; i++) this.spawnWalker(this.rng.range(-5, 110));
  }

  update(dist: number, dt: number): void {
    // avenue traffic
    for (const c of this.cars) {
      c.d += c.speed * dt;
      c.mesh.position.set(LANES[c.lane], STREET.roadY, toZ(c.d));
    }
    this.cars = this.cars.filter(c => {
      const keep = c.d - dist > -40 && c.d - dist < 280;
      if (!keep) this.group.remove(c.mesh);
      return keep;
    });
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.cars.length < 12) {
      this.spawnT = this.rng.range(0.4, 1.1);
      this.spawnCar(dist + this.rng.range(200, 260));
    }
    if (this.onHonk && this.rng.chance(dt * 0.08)) this.onHonk();

    // queues at the lights
    for (const it of this.course.intersections) {
      const want = it.d0 - dist > -15 && it.d0 - dist < 260;
      const have = this.waiting.get(it.index);
      if (want && !have) {
        const g = new Group();
        // even-numbered streets run east (cars come from our right), odd run west (from the left)
        const fromRight = it.street % 2 === 0;
        const n = this.rng.int(1, 3);
        for (let i = 0; i < n; i++) {
          const kind: CarKind = this.rng.chance(0.65) ? 'cab' : 'sedan';
          const car = this.carMesh(kind, kind === 'cab' ? '#f5c518' : this.rng.pick(PAINT));
          const x = fromRight ? STREET.wall + 5 + i * 6.2 : STREET.farWall - 5 - i * 6.2;
          car.position.set(x, STREET.roadY, toZ(fromRight ? it.d1 - 3.4 : it.d0 + 3.4));
          car.rotation.y = fromRight ? Math.PI / 2 : -Math.PI / 2;
          g.add(car);
        }
        this.waiting.set(it.index, g);
        this.group.add(g);
      } else if (!want && have) {
        this.group.remove(have);
        this.waiting.delete(it.index);
      }
    }

    // far sidewalk pedestrians
    for (const w of this.walkers) {
      w.d += w.speed * dt;
      w.phase += dt * 6.5;
      w.person.object.position.set(w.x, 0, toZ(w.d));
      pose(w.person, 'walk', w.phase);
    }
    for (const w of this.walkers) {
      if (w.d - dist < -15 || w.d - dist > 160) {
        w.d = dist + this.rng.range(110, 150);
      }
    }
  }

  dispose(): void {
    for (const w of this.walkers) this.crowd.release('stroller', w.person);
    this.group.clear();
  }

  private carMesh(kind: CarKind, paint: string): Group {
    const g = new Group();
    const body = new Mesh(carGeometry(kind, paint), this.toy);
    body.castShadow = true;
    g.add(body);
    if (kind === 'bus') g.add(new Mesh(carGlowGeometry(kind), this.glow));
    return g;
  }

  private spawnCar(d: number): void {
    const lane = this.rng.int(0, 3);
    const r = this.rng.float();
    const kind: CarKind = lane === 0 ? (r < 0.55 ? 'bus' : 'cab') : r < 0.6 ? 'cab' : r < 0.82 ? 'sedan' : r < 0.93 ? 'van' : 'bus';
    if (this.cars.some(c => c.lane === lane && Math.abs(c.d - d) < 16)) return;
    const paint = kind === 'cab' ? '#f5c518' : kind === 'van' ? '#ececec' : this.rng.pick(PAINT);
    const mesh = this.carMesh(kind, paint);
    const speed = kind === 'bus' ? this.rng.range(4.5, 7) : this.rng.range(6, 12.5);
    this.cars.push({ mesh, d, speed, lane, kind });
    mesh.position.set(LANES[lane], STREET.roadY, toZ(d));
    this.group.add(mesh);
  }

  private spawnWalker(d: number): void {
    const person = this.crowd.acquire('stroller', this.rng.float());
    const south = this.rng.chance(0.5);
    person.object.rotation.y = south ? Math.PI : 0;
    person.mesh.castShadow = false;
    const w: Walker = { person, d, x: this.rng.range(-19.0, -16.6), speed: (south ? 1 : -1) * this.rng.range(1.1, 1.6), phase: this.rng.range(0, 6) };
    this.walkers.push(w);
    this.group.add(person.object);
  }
}
