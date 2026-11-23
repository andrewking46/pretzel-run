import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, IcosahedronGeometry, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Accumulates low-poly primitives with baked vertex colors into one merged geometry, so a whole
// block's props (or one vehicle, or one obstacle) is a single draw call.

const tmpColor = new Color();
const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const s = new Vector3();
const p = new Vector3();

export type ColorLike = string | number | Color;

function colorize(g: BufferGeometry, color: ColorLike): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute('uv');
  tmpColor.set(color);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  return geo;
}

export interface Place {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

export class MeshBuilder {
  private parts: BufferGeometry[] = [];

  get empty(): boolean {
    return this.parts.length === 0;
  }

  add(g: BufferGeometry, color: ColorLike, at: Place = {}): this {
    const geo = colorize(g, color);
    e.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
    q.setFromEuler(e);
    p.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
    s.set(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1);
    m4.compose(p, q, s);
    geo.applyMatrix4(m4);
    this.parts.push(geo);
    return this;
  }

  /** Axis-aligned box centred at (x, y, z) unless rotated. */
  box(w: number, h: number, d: number, color: ColorLike, at: Place = {}): this {
    return this.add(new BoxGeometry(w, h, d), color, at);
  }

  /** Box resting on y (bottom face at y). */
  block(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: ColorLike): this {
    return this.box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), color, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });
  }

  cylinder(rTop: number, rBottom: number, h: number, color: ColorLike, at: Place = {}, segments = 8): this {
    return this.add(new CylinderGeometry(rTop, rBottom, h, segments), color, at);
  }

  cone(r: number, h: number, color: ColorLike, at: Place = {}, segments = 8): this {
    return this.add(new ConeGeometry(r, h, segments), color, at);
  }

  blob(r: number, color: ColorLike, at: Place = {}, detail = 0): this {
    return this.add(new IcosahedronGeometry(r, detail), color, at);
  }

  sphere(r: number, color: ColorLike, at: Place = {}, w = 10, h = 7): this {
    return this.add(new SphereGeometry(r, w, h), color, at);
  }

  /** Add a geometry colored per triangle (e.g. a striped umbrella or stack). */
  painted(g: BufferGeometry, paint: (triangle: number, centroid: Vector3) => ColorLike, at: Place = {}): this {
    const geo = g.index ? g.toNonIndexed() : g;
    geo.deleteAttribute('uv');
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new Vector3();
    for (let t = 0; t < pos.count / 3; t++) {
      c.set(0, 0, 0);
      for (let v = 0; v < 3; v++) c.add(new Vector3().fromBufferAttribute(pos, t * 3 + v));
      c.divideScalar(3);
      tmpColor.set(paint(t, c));
      for (let v = 0; v < 3; v++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], (t * 3 + v) * 3);
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    e.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
    q.setFromEuler(e);
    p.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
    s.set(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1);
    m4.compose(p, q, s);
    geo.applyMatrix4(m4);
    this.parts.push(geo);
    return this;
  }

  /** Append another builder's parts, offset. */
  merge(other: MeshBuilder, at: Place = {}): this {
    for (const g of other.parts) {
      const geo = g.clone();
      e.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
      q.setFromEuler(e);
      p.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
      s.set(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1);
      m4.compose(p, q, s);
      geo.applyMatrix4(m4);
      this.parts.push(geo);
    }
    return this;
  }

  build(): BufferGeometry {
    const g = this.parts.length ? mergeGeometries(this.parts, false)! : new BufferGeometry();
    for (const part of this.parts) part.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }
}

/** Raw triangle soup with arbitrary attributes (facades, ground, billboards, text quads). */
export class QuadBuilder {
  private readonly data: Record<string, number[]> = {};
  private readonly sizes: Record<string, number>;

  constructor(sizes: Record<string, number>) {
    this.sizes = { position: 3, normal: 3, ...sizes };
    for (const k of Object.keys(this.sizes)) this.data[k] = [];
  }

  get empty(): boolean {
    return this.data.position.length === 0;
  }

  /**
   * Quad from four corners (counter-clockwise seen from the front) with per-corner attributes.
   * `attrs` maps attribute name → 4 tuples (one per corner) or 1 tuple (shared).
   */
  quad(corners: [number, number, number][], attrs: Record<string, number[][]>): this {
    const [a, b, , d] = corners.map(v => new Vector3(...v));
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(d, a)).normalize();
    for (const i of [0, 1, 2, 0, 2, 3]) {
      this.data.position.push(...corners[i]);
      this.data.normal.push(n.x, n.y, n.z);
      for (const [name, values] of Object.entries(attrs)) this.data[name].push(...(values.length === 1 ? values[0] : values[i]));
    }
    return this;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    for (const [name, values] of Object.entries(this.data)) {
      if (values.length) g.setAttribute(name, new BufferAttribute(new Float32Array(values), this.sizes[name]));
    }
    g.computeBoundingSphere();
    return g;
  }
}
