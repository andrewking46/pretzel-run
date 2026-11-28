import { BufferAttribute, BufferGeometry, Euler, LatheGeometry, Matrix4, Quaternion, Vector2, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { colorOf, type ColorLike, type Place } from '../world/builder.ts';

// Builds one skinned geometry from many shapes. Each vertex gets a color and up to two bone weights
// computed from its bind-pose position, so a leg can be one sculpted shape that bends smoothly at the knee.

export type Paint = ColorLike | ((p: Vector3) => ColorLike);
/** [boneA, boneB, weight of B] */
export type Skin = (p: Vector3) => readonly [number, number, number];

export const rigid = (bone: number): Skin => () => [bone, bone, 0];

/** Two bones that hand over around height `joint` (blend over ±`blend` m): `upper` above, `lower` below. */
export const hinge = (upper: number, lower: number, joint: number, blend = 0.05): Skin => p => {
  const t = Math.min(1, Math.max(0, (joint + blend - p.y) / (2 * blend)));
  return [upper, lower, t * t * (3 - 2 * t)];
};

/**
 * A smooth solid of revolution around +y from a profile of [height, radius] pairs (bottom to top),
 * closed at both ends. `sx`/`sz` squash the cross-section (e.g. a torso is wider than it is deep).
 */
export function lathe(profile: readonly (readonly [number, number])[], segments = 18): LatheGeometry {
  const pts = profile.map(([y, r]) => new Vector2(Math.max(r, 0.0001), y));
  return new LatheGeometry(pts, segments);
}

const boxes = new Map<string, RoundedBoxGeometry>();

/** A rounded box, generated once per size and copied after: people reuse the same few dozen shapes. */
export function roundedBox(width: number, height: number, depth: number, segments: number, radius: number): BufferGeometry {
  const key = `${width},${height},${depth},${segments},${radius}`;
  let box = boxes.get(key);
  if (!box) boxes.set(key, (box = new RoundedBoxGeometry(width, height, depth, segments, radius)));
  return new BufferGeometry().copy(box); // not box.clone(), which would build a default rounded box first
}

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const s = new Vector3();
const t = new Vector3();
const v = new Vector3();

export class SkinBuilder {
  private parts: BufferGeometry[] = [];

  add(g: BufferGeometry, paint: Paint, skin: Skin, at: Place = {}): this {
    const geo = g.index ? g : g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
    geo.deleteAttribute('uv');
    e.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
    q.setFromEuler(e);
    t.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
    s.set(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1);
    m4.compose(t, q, s);
    geo.applyMatrix4(m4);
    const pos = geo.attributes.position;
    const n = pos.count;
    const colors = new Float32Array(n * 3);
    const idx = new Uint16Array(n * 4);
    const w = new Float32Array(n * 4);
    const flat = typeof paint === 'function' ? null : colorOf(paint);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i);
      const c = flat ?? colorOf((paint as (p: Vector3) => ColorLike)(v));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      const [a, b, wb] = skin(v);
      idx[i * 4] = a;
      idx[i * 4 + 1] = b;
      w[i * 4] = 1 - wb;
      w[i * 4 + 1] = wb;
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.setAttribute('skinIndex', new BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new BufferAttribute(w, 4));
    this.parts.push(geo);
    return this;
  }

  build(): BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }
}
