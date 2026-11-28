import { BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry, type BufferGeometry, type Material } from 'three';
import type { Course, Intersection } from '../sim/course.ts';
import { deriveSeed, Rng } from '../sim/rng.ts';
import { AWNING_WORDS, SQUARE_WORDS, STORE_WORDS, type Atlas } from './atlas.ts';
import { MeshBuilder, QuadBuilder } from './builder.ts';
import { STREET, toZ } from './layout.ts';

// The city, generated one block ("chunk") at a time just ahead of the camera and dropped once behind it.
// Every chunk is a handful of merged meshes: facades, props, glow, signs, ground, road, billboards.

type V3 = [number, number, number];
type Side = 'near' | 'far';

interface ChunkDef {
  index: number;
  start: number;
  end: number;
  /** the block's buildings run from blockStart to blockEnd */
  blockStart: number;
  blockEnd: number;
  crossing?: Intersection;
}

interface Building {
  d0: number;
  d1: number;
  h: number;
  depth: number;
  style: number;
  color: string;
  seed: number;
  lit: number;
  storefront: number;
  square: boolean;
}

const BRICK = ['#a2583f', '#b46a4b', '#8a4c3c', '#9a6a52', '#b8785a', '#7e4a3a'];
const STONE = ['#d1c0a0', '#c3b18f', '#d9c9ad', '#bfae92', '#e0d3bb'];
const GLASS = ['#6b8aa3', '#5f7891', '#7b8a98', '#6f8fa8'];
const RIBBON = ['#b9b3a8', '#8c8f96', '#a7a39b', '#9aa0a6'];
const AWNINGS = ['#1f6b45', '#9c2a32', '#22386e', '#c9792a', '#38323a', '#7a1f4f'];
const LEAVES = ['#d98a2b', '#e3b23c', '#c0562b', '#b9822e', '#e8c45a'];
const PENN_END = 1400;
/** the Penn Station doorway Alex runs into at the finish */
export const PENN_DOOR = { d0: 1389.5, d1: 1399, height: 4.4, depth: 6 };
/** every building is this deep, so corner faces line up with the cross-street walls behind them */
const DEPTH = 24;

/** Made once by the stage and shared by every run's city. `signals` is the sign material for the instanced walk signals. */
export type CityMaterials = Record<'facade' | 'toy' | 'glow' | 'sign' | 'signals' | 'sidewalk' | 'road' | 'billboard', Material>;

export class City {
  readonly group = new Group();
  private readonly defs: ChunkDef[];
  private readonly live = new Map<number, Group>();
  private readonly course: Course;
  private readonly atlas: Atlas;
  /** every visible walk signal across the city, drawn as two instanced meshes (walk / don't walk) */
  private readonly signals = new Map<number, { matrix: Matrix4; phase: number }[]>();
  private readonly walk: InstancedMesh;
  private readonly hand: InstancedMesh;
  private readonly mats: CityMaterials;
  private readonly seed: number;
  private job: { index: number; steps: Generator<void, Group> } | null = null;

  constructor(course: Course, atlas: Atlas, mats: CityMaterials) {
    this.course = course;
    this.atlas = atlas;
    this.seed = deriveSeed(course.seed, 'city');
    this.mats = mats;
    const signal = (name: string) => {
      const [u0, v0, u1, v1] = atlas.uv(name);
      const g = new PlaneGeometry(0.36, 0.4);
      g.setAttribute('uv', new BufferAttribute(new Float32Array([u0, v0, u1, v0, u0, v1, u1, v1]), 2));
      g.setAttribute('color', new BufferAttribute(new Float32Array(12).fill(1.6), 3));
      const m = new InstancedMesh(g, this.mats.signals, 32);
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
      return m;
    };
    this.walk = signal('walk');
    this.hand = signal('dontWalk');
    const ints = course.intersections;
    this.defs = ints.map((it, i) => ({
      index: i,
      start: i === 0 ? -90 : ints[i - 1].d1,
      end: it.d1,
      blockStart: i === 0 ? -90 : ints[i - 1].d1,
      blockEnd: it.d0,
      crossing: it,
    }));
    const last = ints[ints.length - 1];
    this.defs.push({ index: ints.length, start: last.d1, end: course.level.length + 320, blockStart: last.d1, blockEnd: course.level.length + 320 });
  }

  /**
   * Streams blocks in and out. A block is built a slice at a time within `budgetMs` per frame, so even
   * slow phones never stall on one; blocks well behind the camera are dropped.
   */
  update(dist: number, time: number, ahead = 330, budgetMs = 2.5): void {
    const wanted = (def: ChunkDef) => def.end > dist - 25 && def.start < dist + ahead;
    for (const def of this.defs) if (!wanted(def) && this.live.has(def.index)) this.drop(def.index);
    if (this.job && !wanted(this.defs[this.job.index])) this.job = null;
    const start = performance.now();
    while (performance.now() - start < budgetMs) {
      if (!this.job) {
        const next = this.defs.find(def => wanted(def) && !this.live.has(def.index));
        if (!next) break;
        this.job = { index: next.index, steps: this.chunkJob(next) };
      }
      const step = this.job.steps.next();
      if (step.done) {
        this.live.set(this.job.index, step.value);
        this.group.add(step.value);
        this.job = null;
      }
    }
    let walks = 0;
    let hands = 0;
    for (const slots of this.signals.values()) {
      for (const s of slots) {
        const t = (time + s.phase) % 14;
        const walk = t < 9 || (t < 12 && Math.floor(t * 2) % 2 === 0);
        if (walk && walks < 32) this.walk.setMatrixAt(walks++, s.matrix);
        else if (!walk && hands < 32) this.hand.setMatrixAt(hands++, s.matrix);
      }
    }
    this.walk.count = walks;
    this.hand.count = hands;
    this.walk.instanceMatrix.needsUpdate = true;
    this.hand.instanceMatrix.needsUpdate = true;
  }

  /** Build everything within `ahead` right now (behind the loading screen, or after a teleport). */
  prime(dist: number, ahead = 330): void {
    this.update(dist, 0, ahead, Infinity);
  }

  dispose(): void {
    for (const k of [...this.live.keys()]) this.drop(k);
    for (const signal of [this.walk, this.hand]) {
      signal.geometry.dispose();
      signal.dispose();
    }
  }

  private drop(index: number): void {
    const g = this.live.get(index);
    if (!g) return;
    g.traverse(o => {
      if (o instanceof Mesh) (o.geometry as BufferGeometry).dispose();
    });
    this.group.remove(g);
    this.live.delete(index);
    this.signals.delete(index);
  }

  /** One block, built in slices: yields after each building and each merged mesh. */
  private *chunkJob(def: ChunkDef): Generator<void, Group> {
    const rng = new Rng(deriveSeed(this.seed, `chunk${def.index}`));
    const k = new ChunkKit(this.atlas);
    const inSquare = (d: number) => this.course.zones.some(z => z.id === 'times-square' && d > z.from - 10 && d < z.to + 10);

    const nearRow = this.row(rng, def, 'near', inSquare);
    const farRow = this.row(rng, def, 'far', inSquare);
    for (const b of nearRow) {
      this.building(k, rng, b, 'near', def);
      yield;
      k.toy.compact();
      yield;
    }
    for (const b of farRow) {
      this.building(k, rng, b, 'far', def);
      yield;
      k.toy.compact();
      yield;
    }
    this.ground(k, def);
    yield;
    this.streetFurniture(k, rng, def, inSquare);
    yield;
    k.toy.compact();
    yield;
    if (def.crossing) this.crossing(k, rng, def.crossing);
    if (def.blockStart < PENN_END && def.blockEnd >= PENN_END) this.pennEntrance(k);
    if (def.crossing?.street === 42) this.officeTower(k, def);
    yield;

    const g = new Group();
    g.name = `chunk${def.index}`;
    const add = (geo: BufferGeometry | null, mat: Material, opts: { cast?: boolean; receive?: boolean; order?: number } = {}) => {
      if (!geo) return;
      const m = new Mesh(geo, mat);
      m.castShadow = !!opts.cast;
      m.receiveShadow = !!opts.receive;
      m.matrixAutoUpdate = false;
      if (opts.order) m.renderOrder = opts.order;
      g.add(m);
    };
    add(k.facades.empty ? null : k.facades.build(), this.mats.facade);
    add(k.sidewalk.build(), this.mats.sidewalk, { receive: true });
    add(k.road.build(), this.mats.road, { receive: true });
    yield;
    k.toy.merge(k.paint);
    add(k.toy.empty ? null : k.toy.build(), this.mats.toy, { cast: true, receive: true });
    yield;
    add(k.glow.empty ? null : k.glow.build(), this.mats.glow);
    add(k.signs.empty ? null : k.signs.build(), this.mats.sign);
    add(k.billboards.empty ? null : k.billboards.build(), this.mats.billboard);
    this.signals.set(def.index, k.signals);
    return g;
  }

  /** Lays out buildings along one side of a block. */
  private row(rng: Rng, def: ChunkDef, side: Side, inSquare: (d: number) => boolean): Building[] {
    const out: Building[] = [];
    if (side === 'near' && def.blockEnd === PENN_END) {
      return [{ d0: def.blockStart, d1: def.blockEnd, h: 26, depth: DEPTH, style: 5, color: '#3e4c60', seed: 7, lit: 0.5, storefront: 5.2, square: false }];
    }
    let x = def.blockStart;
    while (x < def.blockEnd - 1) {
      let w = rng.range(12, 26);
      if (def.blockEnd - x - w < 9) w = def.blockEnd - x;
      const square = inSquare(x + w / 2);
      const r = rng.float();
      const style = square ? (r < 0.5 ? 2 : r < 0.8 ? 3 : 1) : r < 0.42 ? 0 : r < 0.68 ? 1 : r < 0.84 ? 2 : 3;
      const h = square
          ? rng.range(40, 105)
          : style === 0
            ? rng.range(15, 34)
            : style === 1
              ? rng.range(20, 52)
              : rng.range(34, 92);
      const palette = style === 0 ? BRICK : style === 1 ? STONE : style === 2 ? GLASS : RIBBON;
      out.push({
        d0: x,
        d1: x + w,
        h,
        depth: DEPTH,
        style,
        color: rng.pick(palette),
        seed: rng.float() * 100,
        lit: rng.range(0.14, 0.38) + (square ? 0.15 : 0),
        storefront: style === 2 ? 5.2 : 4.3,
        square,
      });
      x += w;
    }
    return out;
  }

  private building(k: ChunkKit, rng: Rng, b: Building, side: Side, def: ChunkDef): void {
    const near = side === 'near';
    const X = near ? STREET.wall : STREET.farWall;
    const out = near ? -1 : 1; // direction from the wall toward the street
    const first = b.d0 === def.blockStart && def.index > 0;
    const setback = b.h > 48 && b.style !== 5 ? rng.range(2.5, 5) : 0;
    const tiers: [number, number, number][] = setback ? [[0, b.h * rng.range(0.55, 0.72), 0], [0, b.h, setback]] : [[0, b.h, 0]];
    if (setback) tiers[1][0] = tiers[0][1];
    const facade = [b.style, b.seed, b.lit, b.storefront];

    for (const [y0, y1, back] of tiers) {
      const x = X - out * back;
      const z0 = toZ(b.d0);
      const z1 = toZ(b.d1);
      // street facade (Penn gets a doorway cut out of it)
      const span = (d0: number, d1: number, ya: number, yb: number) => {
        const za = toZ(d0);
        const zb = toZ(d1);
        const ua = d0 - b.d0;
        const ub = d1 - b.d0;
        const corners: V3[] = near ? [[x, ya, zb], [x, ya, za], [x, yb, za], [x, yb, zb]] : [[x, ya, za], [x, ya, zb], [x, yb, zb], [x, yb, za]];
        const u = near ? [ub, ua, ua, ub] : [ua, ub, ub, ua];
        k.facades.quad(corners, { facadeUv: [[u[0], ya], [u[1], ya], [u[2], yb], [u[3], yb]], facade: [facade], color: [hexRgb(b.color)] });
      };
      if (b.style === 5) {
        span(b.d0, PENN_DOOR.d0, y0, y1);
        span(PENN_DOOR.d1, b.d1, y0, y1);
        span(PENN_DOOR.d0, PENN_DOOR.d1, PENN_DOOR.height, y1);
      } else {
        span(b.d0, b.d1, y0, y1);
      }
      // north face, seen as you come up to the crossing
      if (first) {
        const xa = near ? x : x - b.depth;
        const xb = near ? x + b.depth : x;
        k.facades.quad([[xa, y0, z0], [xb, y0, z0], [xb, y1, z0], [xa, y1, z0]], {
          facadeUv: [[0, y0], [b.depth, y0], [b.depth, y1], [0, y1]],
          facade: [[b.style, b.seed + 3, b.lit, b.storefront]],
          color: [hexRgb(shade(b.color, 0.9))],
        });
      }
      // stepped cornice (band, overhang, cap) instead of one slab
      const trim = shade(b.color, b.style === 0 ? 1.18 : 0.82);
      const ledge = (reach: number, ya: number, yb: number, c: string) => {
        const xo = x + out * reach;
        const xi = x - out * 0.6;
        k.toy.block(Math.min(xo, xi), Math.max(xo, xi), ya, yb, z1, z0, c);
      };
      if (b.style <= 1) {
        ledge(0.12, y1 - 1.5, y1 - 1.1, trim);
        ledge(0.5, y1 - 0.7, y1 - 0.25, trim);
        ledge(0.62, y1 - 0.25, y1, shade(trim, 0.92));
        for (let d = b.d0 + 1.25; d < b.d1 - 0.5; d += 2.5) k.toy.box(0.42, 0.42, 0.22, shade(trim, 0.88), { x: x + out * 0.24, y: y1 - 0.9, z: toZ(d) });
      } else {
        ledge(0.2, y1 - 0.6, y1, trim);
      }
      // pilasters between bays and a belt course over the shops give the masonry fronts some depth
      if (y0 === 0 && b.style <= 1) {
        const bay = b.style === 0 ? 2.5 : 3.0;
        for (let d = b.d0 + bay * 2; d < b.d1 - 0.5; d += bay * 2) {
          const xo = x + out * 0.14;
          k.toy.block(Math.min(x, xo), Math.max(x, xo), b.storefront, y1 - 1.5, toZ(d + 0.16), toZ(d - 0.16), shade(b.color, 0.94));
        }
        const xb = x + out * 0.2;
        k.toy.block(Math.min(x, xb), Math.max(x, xb), b.storefront - 0.1, b.storefront + 0.25, z1, z0, trim);
      }
      // rooftop clutter breaks up the skyline: a stair bulkhead and some mechanical boxes
      if (y1 === b.h && b.style !== 5 && rng.chance(0.7)) {
        const roofX = x - out * rng.range(4, 10);
        const zm = toZ(rng.range(b.d0 + 3, Math.max(b.d0 + 3.5, b.d1 - 3)));
        k.toy.box(3.2, 2.6, 3.0, shade(b.color, 0.8), { x: roofX, y: b.h + 1.3, z: zm });
        if (rng.chance(0.6)) k.toy.box(1.6, 1.0, 1.2, '#9aa0a6', { x: roofX - out * 3, y: b.h + 0.5, z: zm + rng.range(-3, 3) });
        if (b.h > 60 && rng.chance(0.5)) k.toy.cylinder(0.08, 0.12, 9, '#c9ced4', { x: roofX, y: b.h + 2.6 + 4.5, z: zm }, 6);
      }
    }

    // storefront dressing
    if (b.style !== 5) {
      const along = b.d1 - b.d0;
      if (rng.chance(0.6)) {
        const a0 = b.d0 + rng.range(1, Math.max(1.2, along * 0.3));
        const a1 = Math.min(b.d1 - 1, a0 + rng.range(5, 9));
        const color = rng.pick(AWNINGS);
        this.awning(k, X, out, a0, a1, color, rng.pick(AWNING_WORDS), b.storefront);
      }
      if (rng.chance(b.square ? 0.55 : 0.5)) {
        const word = rng.pick(b.square ? SQUARE_WORDS : STORE_WORDS);
        const d = b.d0 + rng.range(2, Math.max(2.5, along - 2));
        this.blade(k, X, out, d, word, b.square);
      }
      if (b.style === 0 && rng.chance(0.5) && b.h > 14) this.fireEscape(k, rng, X, out, b);
      if ((b.style === 0 || (b.style === 1 && b.h < 40)) && rng.chance(0.4)) this.waterTower(k, rng, X - out * rng.range(4, 9), b.h, (b.d0 + b.d1) / 2 + rng.range(-3, 3));
      if (b.square) this.billboards(k, rng, X, out, b);
    } else {
      this.pennFacade(k, X);
    }
  }

  private awning(k: ChunkKit, X: number, out: number, d0: number, d1: number, color: string, word: string, gf: number): void {
    const z0 = toZ(d0);
    const z1 = toZ(d1);
    const y = gf - 0.9;
    const reach = 0.95;
    const xa = X;
    const xb = X + out * reach;
    // sloped canopy as a thin rotated slab
    const slope = Math.atan2(0.45, reach);
    k.toy.box(reach / Math.cos(slope), 0.06, d1 - d0, color, { x: (xa + xb) / 2, y: y + 0.22, z: (z0 + z1) / 2, rz: out * slope });
    k.toy.block(Math.min(xb, xb + out * 0.04), Math.max(xb, xb + out * 0.04), y - 0.38, y + 0.02, z1, z0, shade(color, 0.85));
    const [u0, v0, u1, v1] = this.atlas.uv(`awning:${word}`);
    const len = Math.min(d1 - d0 - 0.4, 0.4 * this.atlas.aspect(`awning:${word}`));
    const mid = (z0 + z1) / 2;
    const xf = xb + out * 0.05;
    // left-to-right as seen from the street: -z first on our side, +z first across the avenue
    const corners: V3[] = out < 0
      ? [[xf, y - 0.34, mid - len / 2], [xf, y - 0.34, mid + len / 2], [xf, y - 0.02, mid + len / 2], [xf, y - 0.02, mid - len / 2]]
      : [[xf, y - 0.34, mid + len / 2], [xf, y - 0.34, mid - len / 2], [xf, y - 0.02, mid - len / 2], [xf, y - 0.02, mid + len / 2]];
    k.signs.quad(corners, { uv: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], color: [[1, 1, 1]] });
  }

  private blade(k: ChunkKit, X: number, out: number, d: number, word: string, big: boolean): void {
    const z = toZ(d);
    const reach = 1.0;
    const y0 = big ? 5.0 : 4.6;
    const y1 = y0 + 2.6;
    const x0 = X + out * 0.15;
    const x1 = X + out * (reach + 0.15);
    k.toy.block(Math.min(X, x0), Math.max(X, x0), y1 - 0.25, y1 - 0.1, z - 0.05, z + 0.05, '#333');
    const [u0, v0, u1, v1] = this.atlas.uv(`blade:${word}`);
    const xl = Math.min(x0, x1);
    const xr = Math.max(x0, x1);
    // face the camera (+z) and the other way; the sign material is double-sided
    // lettered on both faces, like the real thing
    k.signs.quad([[xl, y0, z], [xr, y0, z], [xr, y1, z], [xl, y1, z]], { uv: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], color: [[1, 1, 1]] });
    k.signs.quad([[xr, y0, z - 0.02], [xl, y0, z - 0.02], [xl, y1, z - 0.02], [xr, y1, z - 0.02]], { uv: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], color: [[1, 1, 1]] });
  }

  private fireEscape(k: ChunkKit, rng: Rng, X: number, out: number, b: Building): void {
    const bays = Math.max(2, Math.floor((b.d1 - b.d0) / 2.5));
    const start = b.d0 + 2.5 * rng.int(0, Math.max(0, bays - 3));
    const len = 2.5 * 2;
    const dark = '#26262b';
    const za = toZ(start);
    const zb = toZ(start + len);
    for (let y = b.storefront + 3.4; y < b.h - 2.5; y += 3.4) {
      const xa = X + out * 0.95;
      k.toy.block(Math.min(X, xa), Math.max(X, xa), y - 0.05, y + 0.03, zb, za, dark);
      k.toy.block(Math.min(xa, xa + out * 0.04), Math.max(xa, xa + out * 0.04), y, y + 0.95, zb, za, dark);
      const run = Math.atan2(3.4, len * 0.8);
      k.toy.box(0.06, Math.hypot(3.4, len * 0.8), 0.5, dark, { x: X + out * 0.55, y: y + 1.7, z: (za + zb) / 2, rx: run });
    }
  }

  private waterTower(k: ChunkKit, rng: Rng, x: number, roof: number, d: number): void {
    const z = toZ(d);
    const wood = rng.pick(['#7a5a3c', '#6b4d32', '#86623f']);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.toy.box(0.14, 2.2, 0.14, '#2c2c30', { x: x + dx * 1.1, y: roof + 1.1, z: z + dz * 1.1 });
    k.toy.cylinder(1.55, 1.55, 3.1, wood, { x, y: roof + 3.75, z }, 10);
    k.toy.cylinder(1.6, 1.6, 0.12, '#3a2e24', { x, y: roof + 3.0, z }, 10);
    k.toy.cylinder(1.6, 1.6, 0.12, '#3a2e24', { x, y: roof + 4.4, z }, 10);
    k.toy.cone(1.75, 1.3, shade(wood, 0.8), { x, y: roof + 5.95, z }, 10);
  }

  private billboards(k: ChunkKit, rng: Rng, X: number, out: number, b: Building): void {
    const n = rng.int(1, 3);
    // on our side the camera passes a meter or two away, so screens start higher up and stay out of its face
    let y = out < 0 ? 11 : b.storefront + 1.6;
    for (let i = 0; i < n && y < b.h - 6; i++) {
      const hgt = rng.range(6, 13);
      const d0 = b.d0 + 0.8;
      const d1 = b.d1 - 0.8;
      const x = X + out * (0.12 + i * 0.02);
      const aspect = (d1 - d0) / hgt;
      const bb = [rng.int(0, 3), rng.float(), rng.float(), aspect];
      const z0 = toZ(d0);
      const z1 = toZ(d1);
      const corners: V3[] = out < 0
        ? [[x, y, z1], [x, y, z0], [x, y + hgt, z0], [x, y + hgt, z1]]
        : [[x, y, z0], [x, y, z1], [x, y + hgt, z1], [x, y + hgt, z0]];
      k.billboards.quad(corners, { bbUv: [[0, 0], [1, 0], [1, 1], [0, 1]], bb: [bb] });
      y += hgt + rng.range(1.5, 6);
    }
    // a theatre marquee now and then
    if (rng.chance(0.35)) {
      const z0 = toZ(b.d0 + 2);
      const z1 = toZ(Math.min(b.d1 - 2, b.d0 + 12));
      k.toy.block(Math.min(X, X + out * 1.2), Math.max(X, X + out * 1.2), b.storefront - 0.6, b.storefront + 0.6, z1, z0, '#2a1a12');
      for (let z = z1 + 0.3; z < z0; z += 0.6) k.glow.box(0.1, 0.1, 0.1, '#ffd98a', { x: X + out * 1.22, y: b.storefront - 0.4, z });
      for (let z = z1 + 0.3; z < z0; z += 0.6) k.glow.box(0.1, 0.1, 0.1, '#ffd98a', { x: X + out * 1.22, y: b.storefront + 0.4, z });
    }
  }

  private pennFacade(k: ChunkKit, X: number): void {
    // dark glass box with a big PENN STATION sign over the entrance at the corner
    const [u0, v0, u1, v1] = this.atlas.uv('penn');
    const z0 = toZ(PENN_END - 12.5);
    const z1 = toZ(PENN_END - 0.5);
    const x = X - 0.08;
    k.signs.quad([[x, 6.4, z1], [x, 6.4, z0], [x, 8.6, z0], [x, 8.6, z1]], { uv: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], color: [[1, 1, 1]] });
    const [s0, t0, s1, t1] = this.atlas.uv('pennSub');
    k.signs.quad([[x, 5.6, z1], [x, 5.6, z0], [x, 6.3, z0], [x, 6.3, z1]], { uv: [[s0, t1], [s1, t1], [s1, t0], [s0, t0]], color: [[1, 1, 1]] });
    k.glow.block(x - 0.02, x, 8.65, 8.8, z1, z0, '#9ad0ff');
  }

  /** The doorway Alex runs into: a recessed, lit hall with an escalator going down, under a cantilevered canopy. */
  private pennEntrance(k: ChunkKit): void {
    const { d0, d1, height: h, depth } = PENN_DOOR;
    const X = STREET.wall;
    const za = toZ(d0);
    const zb = toZ(d1);
    const back = X + depth;
    const frame = '#1b2433';
    // hall: floor, side walls, ceiling, glowing back wall
    k.toy.block(X, back, -0.02, 0.01, zb, za, '#d8cfc0');
    k.toy.block(X, back, 0, h, zb - 0.3, zb, '#e8dcc6');
    k.toy.block(X, back, 0, h, za, za + 0.3, '#e8dcc6');
    k.toy.block(X, back, h, h + 0.3, zb, za, '#f2e6d0');
    k.glow.block(back - 0.05, back, 0, h, zb, za, '#ffd9a0');
    for (let z = zb + 1.2; z < za - 0.5; z += 2.2) k.glow.block(X + 0.5, back - 0.5, h - 0.04, h, z, z + 0.35, '#fff6e2');
    // escalator heading down to the trains
    const mid = (za + zb) / 2;
    k.toy.box(1.4, 0.3, 4.2, '#9aa3ae', { x: X + 3.4, y: 0.3, z: mid, rz: 0.5, ry: Math.PI / 2 });
    for (const s of [-1, 1]) k.toy.box(0.12, 0.9, 4.2, '#6b7480', { x: X + 3.4, y: 0.75, z: mid + s * 0.75, rz: 0.5, ry: Math.PI / 2 });
    // portal frame and mullions
    k.toy.block(X - 0.2, X + 0.05, h, h + 0.35, zb - 0.2, za + 0.2, frame);
    for (const z of [zb, za]) k.toy.block(X - 0.2, X + 0.05, 0, h, z - 0.1, z + 0.1, frame);
    // cantilevered canopy with a lit underside
    k.toy.block(X - 2.6, X, h + 0.35, h + 0.6, zb - 0.6, za + 0.6, frame);
    k.glow.block(X - 2.5, X, h + 0.3, h + 0.35, zb - 0.5, za + 0.5, '#fff0cf');
  }

  /**
   * Alex's office: a tall faceted glass tower by Bryant Park (6th Ave & 42nd), pulled in toward the avenue
   * diorama-style so it looms over the far side as you leave Times Square. No names, no logos.
   */
  private officeTower(k: ChunkKit, def: ChunkDef): void {
    const cx = -78;
    const w = 32;
    const d0 = def.blockStart + 16;
    const d1 = d0 + 34;
    const roof = 230;
    const glass = hexRgb('#86a3ba');
    const facade = [[2, 42.7, 0.3, 6]];
    const xe = cx + w / 2;
    const z0 = toZ(d0);
    const z1 = toZ(d1);
    k.facades.quad([[xe, 0, z0], [xe, 0, z1], [xe, roof, z1], [xe, roof, z0]], { facadeUv: [[0, 0], [d1 - d0, 0], [d1 - d0, roof], [0, roof]], facade, color: [glass] });
    k.facades.quad([[cx - w / 2, 0, z0], [xe, 0, z0], [xe, roof, z0], [cx - w / 2, roof, z0]], { facadeUv: [[0, 0], [w, 0], [w, roof], [0, roof]], facade, color: [glass] });
    // the slanted crystalline crown and the spire
    const zc = (z0 + z1) / 2;
    k.toy.cone(w * 0.72, 58, '#9fb9cc', { x: cx, y: roof + 29, z: zc, ry: Math.PI / 4, rz: 0.12 }, 4);
    k.toy.cone(w * 0.42, 40, '#c9dbe6', { x: cx + 4, y: roof + 36, z: zc + 3, ry: Math.PI / 4, rz: -0.18 }, 4);
    k.toy.cylinder(0.6, 1.4, 70, '#d4dde4', { x: cx - 2, y: roof + 75, z: zc }, 6);
    k.glow.sphere(1.2, '#ff5a4a', { x: cx - 2, y: roof + 111, z: zc }, 8, 6);
  }

  private ground(k: ChunkKit, def: ChunkDef): void {
    const { start, end, blockStart, blockEnd } = def;
    const W = STREET;
    // sidewalks (block only; the crossing is road)
    k.ground(k.sidewalk, W.curb, W.wall, 0, blockStart, blockEnd, 3.2, [1, 1, 1]);
    k.ground(k.sidewalk, W.farWall, W.farCurb, 0, blockStart, blockEnd, 3.2, [0.96, 0.95, 0.94]);
    // the avenue, continuous through the crossing
    k.ground(k.road, W.farCurb, W.curb, W.roadY, start, end, 8, [1, 1, 1]);
    // curbs
    k.toy.block(W.curb - W.curbWidth, W.curb, W.roadY, 0.015, toZ(blockEnd), toZ(blockStart), '#a9a59d');
    k.toy.block(W.farCurb, W.farCurb + W.curbWidth, W.roadY, 0.015, toZ(blockEnd), toZ(blockStart), '#a9a59d');
    // red bus lane with a white edge line and BUS ONLY every so often
    const py = W.roadY + 0.012;
    k.paintStrip(W.busLane, W.curb - W.curbWidth, py, blockStart, blockEnd, '#a8453d');
    k.paintStrip(W.busLane - 0.15, W.busLane, py + 0.002, blockStart, blockEnd, '#ece8df');
    for (let d = blockStart + 12; d < blockEnd - 12; d += 38) k.groundWord('busOnly', (W.busLane + W.curb - W.curbWidth) / 2, py + 0.004, d, 6);
    // lane dashes
    for (const lx of [-9.6, -12.6]) {
      for (let d = Math.ceil(blockStart / 9) * 9; d < blockEnd - 3; d += 9) k.paintStrip(lx - 0.07, lx + 0.07, py, d, d + 3, '#ece8df');
    }
  }

  private streetFurniture(k: ChunkKit, rng: Rng, def: ChunkDef, inSquare: (d: number) => boolean): void {
    const { blockStart, blockEnd } = def;
    const clear = (d: number, pad: number) => d > blockStart + pad && d < blockEnd - pad;
    // lamps every 32 m on both curbs
    for (let d = Math.ceil((blockStart - 10) / 32) * 32 + 10; d < blockEnd; d += 32) {
      if (clear(d, 2)) this.lamp(k, STREET.lampX, d, -1);
      if (clear(d + 6, 2)) this.lamp(k, STREET.farCurb - 0.45, d + 6, 1);
    }
    // November street trees, but not in Times Square or the last stretch to Penn
    for (let d = Math.ceil((blockStart - 26) / 32) * 32 + 26; d < blockEnd; d += 32) {
      if (clear(d, 4) && !inSquare(d) && d < this.course.level.length - 60) this.tree(k, rng, STREET.treeX, d);
      if (clear(d + 9, 4)) this.tree(k, rng, STREET.farCurb - 0.9, d + 9, 1);
    }
    const it = def.crossing;
    if (!it) return;
    if (rng.chance(0.7)) this.basket(k, STREET.furnitureX, it.d0 - 4.2);
    if (rng.chance(0.5)) this.hydrant(k, STREET.furnitureX - 0.05, it.d0 - 6.5);
    if (rng.chance(0.45)) this.newsboxes(k, rng, STREET.furnitureX, it.d0 - 9);
    if (this.course.level.landmarks.subwayStreets.includes(it.street)) this.subwayEntrance(k, it.d0 - 15);
  }

  /** NYC cobra-head streetlight: fluted base, tapered pole, a curving arm and the long flat head. */
  private lamp(k: ChunkKit, x: number, d: number, dir: number): void {
    const z = toZ(d);
    const pole = '#3d4a44';
    k.toy.cylinder(0.22, 0.27, 0.7, pole, { x, y: 0.35, z }, 12);
    k.toy.cylinder(0.17, 0.22, 0.12, shade(pole, 1.2), { x, y: 0.76, z }, 12);
    k.toy.cylinder(0.08, 0.13, 6.4, pole, { x, y: 3.9, z }, 12);
    const arc: [number, number, number][] = [[0.1, 7.15, 0.5], [0.45, 7.45, 0.25], [0.95, 7.6, 0.08], [1.45, 7.62, -0.02]];
    for (const [ax, ay, rot] of arc) k.toy.cylinder(0.05, 0.06, 0.58, pole, { x: x + dir * ax, y: ay, z, rz: -dir * (Math.PI / 2 - rot) }, 8);
    k.toy.capsule(0.2, 0.75, '#56635d', { x: x + dir * 1.95, y: 7.58, z, rz: Math.PI / 2, sz: 1.4, sx: 0.55 }, 4, 12);
    k.glow.capsule(0.13, 0.6, '#ffe1a6', { x: x + dir * 1.95, y: 7.47, z, rz: Math.PI / 2, sz: 1.3, sx: 0.3 }, 3, 10);
  }

  /** A November street tree: tree pit with a little iron guard, branching trunk, soft clusters of autumn leaves. */
  private tree(k: ChunkKit, rng: Rng, x: number, d: number, detail = 2): void {
    const z = toZ(d);
    k.paint.block(x - 0.65, x + 0.65, 0.004, 0.014, z - 0.65, z + 0.65, '#3b3128');
    for (const [dx, dz, w, dd] of [[0, -0.66, 1.34, 0.04], [0, 0.66, 1.34, 0.04], [-0.66, 0, 0.04, 1.34], [0.66, 0, 0.04, 1.34]]) {
      k.toy.box(w, 0.04, dd, '#1f2420', { x: x + dx, y: 0.42, z: z + dz });
    }
    for (const [dx, dz] of [[-0.66, -0.66], [0.66, -0.66], [-0.66, 0.66], [0.66, 0.66]]) k.toy.cylinder(0.02, 0.02, 0.44, '#1f2420', { x: x + dx, y: 0.22, z: z + dz }, 6);
    const bark = '#5b4636';
    k.toy.cylinder(0.08, 0.13, 2.6, bark, { x, y: 1.3, z }, 10);
    const crown: [number, number, number][] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const lean = rng.range(0.45, 0.7);
      k.toy.cylinder(0.04, 0.07, 1.5, bark, { x: x + Math.cos(a) * 0.32, y: 3.1, z: z + Math.sin(a) * 0.32, rx: Math.sin(a) * lean, rz: -Math.cos(a) * lean }, 8);
      crown.push([x + Math.cos(a) * 0.7, rng.range(3.6, 4.1), z + Math.sin(a) * 0.7]);
    }
    crown.push([x, 4.4, z]);
    const leaf = rng.pick(LEAVES);
    for (const [cx, cy, cz] of crown) {
      for (let j = 0; j < 2; j++) {
        const c = j ? shade(leaf, rng.range(0.85, 1.1)) : rng.pick(LEAVES);
        k.toy.blob(rng.range(0.55, 0.8), c, { x: cx + rng.range(-0.35, 0.35), y: cy + rng.range(-0.2, 0.3), z: cz + rng.range(-0.35, 0.35), sy: 0.85, ry: rng.range(0, 3) }, detail);
      }
    }
  }

  private basket(k: ChunkKit, x: number, d: number): void {
    const z = toZ(d);
    k.toy.cylinder(0.32, 0.26, 0.95, '#2f5d3b', { x, y: 0.475, z }, 10);
    k.toy.cylinder(0.34, 0.34, 0.06, '#6f8f77', { x, y: 0.96, z }, 10);
  }

  private hydrant(k: ChunkKit, x: number, d: number): void {
    const z = toZ(d);
    k.toy.cylinder(0.14, 0.16, 0.6, '#c8322a', { x, y: 0.3, z }, 8);
    k.toy.sphere(0.15, '#c8322a', { x, y: 0.62, z }, 8, 6);
    k.toy.box(0.44, 0.1, 0.1, '#b02a24', { x, y: 0.45, z });
    k.toy.cylinder(0.05, 0.05, 0.1, '#e8c547', { x, y: 0.8, z }, 6);
  }

  private newsboxes(k: ChunkKit, rng: Rng, x: number, d: number): void {
    const cols = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a'];
    for (let i = 0; i < 2; i++) {
      const z = toZ(d + i * 0.55);
      k.toy.box(0.42, 1.05, 0.48, rng.pick(cols), { x, y: 0.525, z });
      k.glow.box(0.02, 0.24, 0.3, '#e9f1ff', { x: x + 0.22, y: 0.75, z });
    }
  }

  private subwayEntrance(k: ChunkKit, d: number): void {
    const x0 = STREET.curb + 0.18;
    const x1 = x0 + 1.25;
    const za = toZ(d);
    const zb = toZ(d + 4.2);
    const green = '#245a36';
    k.paint.block(x0, x1, 0.006, 0.02, zb, za, '#141414');
    for (const x of [x0, x1]) k.toy.block(x - 0.05, x + 0.05, 0, 1.0, zb, za, green);
    k.toy.block(x0 - 0.05, x1 + 0.05, 0, 1.0, za - 0.05, za + 0.05, green);
    for (const x of [x0, x1]) {
      k.toy.cylinder(0.05, 0.05, 2.2, green, { x, y: 1.1, z: za + 0.05 }, 6);
      k.glow.sphere(0.17, '#46e08a', { x, y: 2.32, z: za + 0.05 }, 10, 8);
    }
    const [u0, v0, u1, v1] = this.atlas.uv('subway');
    k.signs.quad([[x0, 1.05, za + 0.07], [x1, 1.05, za + 0.07], [x1, 1.36, za + 0.07], [x0, 1.36, za + 0.07]], { uv: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], color: [[1, 1, 1]] });
  }

  private crossing(k: ChunkKit, rng: Rng, it: Intersection): void {
    const W = STREET;
    const zb = toZ(it.d1);
    const py = W.roadY + 0.012;
    // the cross street, far in both directions
    k.ground(k.road, -170, W.farCurb, W.roadY, it.d0, it.d1, 8, [0.97, 0.97, 0.97]);
    k.ground(k.road, W.curb, 170, W.roadY, it.d0, it.d1, 8, [0.97, 0.97, 0.97]);
    // zebra across our path and across the far sidewalk: bars run along the cross street
    for (let d = it.d0 + 0.9; d < it.d1 - 0.8; d += 1.3) {
      k.paintStrip(W.curb + 0.15, W.wall - 0.25, py, d, d + 0.65, '#efede6');
      k.paintStrip(W.farWall + 0.3, W.farCurb - 0.15, py, d, d + 0.65, '#efede6');
    }
    // avenue crosswalk just before the box, and a stop line
    for (let x = W.farCurb + 0.3; x < W.curb - 0.4; x += 1.25) k.paintStrip(x, x + 0.62, py, it.d0 - 3.4, it.d0 - 0.6, '#efede6');
    k.paintStrip(W.farCurb + 0.2, W.curb - 0.3, py, it.d0 - 4.6, it.d0 - 4.2, '#efede6');

    // the south wall of the cross street, seen as you come up to it (the corner buildings draw their own faces)
    const wall = (from: number, to: number) => {
      const dir = Math.sign(to - from);
      for (let x = from; (to - x) * dir > 0; ) {
        const w = rng.range(14, 30);
        const h = rng.range(18, 70);
        const xa = dir > 0 ? x : x - w;
        const xb = dir > 0 ? x + w : x;
        const style = rng.int(0, 3);
        const color = rng.pick(style === 0 ? BRICK : style === 1 ? STONE : style === 2 ? GLASS : RIBBON);
        k.facades.quad([[xa, 0, zb], [xb, 0, zb], [xb, h, zb], [xa, h, zb]], {
          facadeUv: [[0, 0], [w, 0], [w, h], [0, h]],
          facade: [[style, rng.float() * 100, rng.range(0.15, 0.4), 4.3]],
          color: [hexRgb(shade(color, 0.92))],
        });
        k.toy.block(xa, xb, h - 0.8, h, zb - 0.4, zb + 0.4, shade(color, 0.85));
        x += dir * w;
      }
    };
    wall(W.wall + DEPTH, 170);
    wall(W.farWall - DEPTH, -170);

    // corner signpost: green street signs and a walk signal
    const sx = W.curb + 0.35;
    const sz = toZ(it.d0 - 1.2);
    k.toy.cylinder(0.06, 0.07, 3.9, '#5b6260', { x: sx, y: 1.95, z: sz }, 6);
    const [a0, b0, a1, b1] = this.atlas.uv(`street:${it.street}`);
    k.signs.quad([[sx - 0.85, 3.55, sz + 0.05], [sx + 0.85, 3.55, sz + 0.05], [sx + 0.85, 3.98, sz + 0.05], [sx - 0.85, 3.98, sz + 0.05]], { uv: [[a0, b1], [a1, b1], [a1, b0], [a0, b0]], color: [[1, 1, 1]] });
    k.signs.quad([[sx + 0.85, 3.55, sz + 0.03], [sx - 0.85, 3.55, sz + 0.03], [sx - 0.85, 3.98, sz + 0.03], [sx + 0.85, 3.98, sz + 0.03]], { uv: [[a0, b1], [a1, b1], [a1, b0], [a0, b0]], color: [[1, 1, 1]] });
    const [c0, e0, c1, e1] = this.atlas.uv('street:avenue');
    k.signs.quad([[sx + 0.05, 3.08, sz + 0.5], [sx + 0.05, 3.08, sz - 0.5], [sx + 0.05, 3.42, sz - 0.5], [sx + 0.05, 3.42, sz + 0.5]], { uv: [[c0, e1], [c1, e1], [c1, e0], [c0, e0]], color: [[1, 1, 1]] });
    k.signs.quad([[sx + 0.03, 3.08, sz - 0.5], [sx + 0.03, 3.08, sz + 0.5], [sx + 0.03, 3.42, sz + 0.5], [sx + 0.03, 3.42, sz - 0.5]], { uv: [[c0, e1], [c1, e1], [c1, e0], [c0, e0]], color: [[1, 1, 1]] });
    k.toy.box(0.42, 0.46, 0.26, '#222', { x: sx + 0.35, y: 2.6, z: sz });
    k.signals.push({ matrix: new Matrix4().makeTranslation(sx + 0.35, 2.6, sz + 0.14), phase: rng.range(0, 14) });

    // traffic signals on a mast arm over the avenue
    const mx = W.curb - 0.3;
    const mz = toZ(it.d0 - 4.8);
    k.toy.cylinder(0.12, 0.16, 6.4, '#3d4a44', { x: mx, y: 3.2, z: mz }, 6);
    k.toy.box(9.6, 0.14, 0.14, '#3d4a44', { x: mx - 4.8, y: 6.2, z: mz });
    for (const hx of [mx - 4.4, mx - 8.6]) {
      k.toy.box(0.4, 1.15, 0.32, '#e3b520', { x: hx, y: 5.5, z: mz });
      k.glow.sphere(0.12, '#3dff7a', { x: hx, y: 5.15, z: mz + 0.17 }, 8, 6);
    }
  }
}

/** Per-chunk accumulators. */
class ChunkKit {
  readonly facades = new QuadBuilder({ facadeUv: 2, facade: 4, color: 3 });
  readonly sidewalk = new QuadBuilder({ uv: 2, color: 3 });
  readonly road = new QuadBuilder({ uv: 2, color: 3 });
  readonly signs = new QuadBuilder({ uv: 2, color: 3 });
  readonly billboards = new QuadBuilder({ bbUv: 2, bb: 4 });
  readonly toy = new MeshBuilder();
  readonly paint = new MeshBuilder();
  readonly glow = new MeshBuilder();
  readonly signals: { matrix: Matrix4; phase: number }[] = [];
  private readonly atlas: Atlas;

  constructor(atlas: Atlas) {
    this.atlas = atlas;
  }

  /** Horizontal ground quad from x0..x1 and d0..d1 with world-space UVs (tile meters). */
  ground(q: QuadBuilder, x0: number, x1: number, y: number, d0: number, d1: number, tile: number, tint: number[]): void {
    if (d1 <= d0 || x1 <= x0) return;
    const z0 = toZ(d0);
    const z1 = toZ(d1);
    q.quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], {
      uv: [[x0 / tile, d0 / tile], [x1 / tile, d0 / tile], [x1 / tile, d1 / tile], [x0 / tile, d1 / tile]],
      color: [tint],
    });
  }

  paintStrip(x0: number, x1: number, y: number, d0: number, d1: number, color: string): void {
    if (d1 <= d0) return;
    this.paint.block(x0, x1, y - 0.004, y, toZ(d1), toZ(d0), color);
  }

  /** Road lettering: spans the lane's width and is stretched along the road, like the real paint. */
  groundWord(name: string, x: number, y: number, d: number, len: number): void {
    const [u0, v0, u1, v1] = this.atlas.uv(name);
    const wHalf = 1.15;
    const z0 = toZ(d);
    const z1 = toZ(d + len);
    // reads correctly for someone driving south (toward -z)
    this.signs.quad([[x - wHalf, y, z0], [x + wHalf, y, z0], [x + wHalf, y, z1], [x - wHalf, y, z1]], { uv: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], color: [[0.95, 0.93, 0.9]] });
  }
}

function hexRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  // facades are lit in linear space; convert sRGB hex
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.pow(v / 255, 2.2));
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
