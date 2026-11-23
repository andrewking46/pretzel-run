import { BufferGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Group, IcosahedronGeometry, Mesh, Quaternion, Shape, SphereGeometry, TorusGeometry, type Material, Vector3 } from 'three';
import { shade } from './people.ts';
import type { Atlas } from '../world/atlas.ts';
import { MeshBuilder, QuadBuilder } from '../world/builder.ts';

// Low-poly models for everything on the sidewalk that isn't a person. Built once, shared by every copy.
// Front faces +z (toward Alex and the camera).

const cache = new Map<string, BufferGeometry>();
function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

const STEEL = '#c8ccd2';

export function cartGeometry(): BufferGeometry {
  return cached('cart', () => {
    const m = new MeshBuilder();
    // rounded steel body with a darker kick plate and a counter on top
    m.rounded(1.2, 0.84, 0.82, 0.07, STEEL, { y: 0.78 });
    m.rounded(1.26, 0.07, 0.88, 0.03, '#a9afb7', { y: 1.22 });
    m.rounded(1.22, 0.12, 0.84, 0.04, '#8a9098', { y: 0.38 });
    // glass sneeze guard and the steam-table lids
    m.rounded(0.9, 0.22, 0.02, 0.01, '#b9d4e4', { y: 1.37, z: 0.2, rx: -0.2 });
    for (const x of [-0.3, 0.05]) m.rounded(0.3, 0.04, 0.3, 0.015, '#d8dce2', { x, y: 1.27, z: -0.08 });
    // condiments, napkins, a pretzel rack
    m.cylinder(0.05, 0.055, 0.2, '#e9c400', { x: -0.45, y: 1.36, z: 0.18 });
    m.cone(0.025, 0.05, '#c9a800', { x: -0.45, y: 1.48, z: 0.18 });
    m.cylinder(0.05, 0.055, 0.2, '#c62828', { x: -0.32, y: 1.36, z: 0.18 });
    m.cone(0.025, 0.05, '#a01f1f', { x: -0.32, y: 1.48, z: 0.18 });
    m.rounded(0.22, 0.1, 0.16, 0.02, '#f4f1e8', { x: 0.4, y: 1.31, z: 0.12 });
    for (let i = 0; i < 3; i++) m.add(new TorusGeometry(0.05, 0.018, 8, 14), '#b8681f', { x: 0.25 + i * 0.12, y: 1.42, z: -0.2, rx: 0.4 });
    // wheels with hubs, a handle, a propane tank underneath
    for (const s of [-1, 1]) {
      m.add(new TorusGeometry(0.17, 0.06, 10, 20), '#1b1b1d', { x: s * 0.55, y: 0.22, z: 0.08, ry: Math.PI / 2 });
      m.cylinder(0.1, 0.1, 0.1, '#9aa0a8', { x: s * 0.55, y: 0.22, z: 0.08, rz: Math.PI / 2 });
    }
    m.cylinder(0.025, 0.025, 0.55, '#888', { x: 0.66, y: 1.0, z: -0.15, rx: Math.PI / 2 });
    m.capsule(0.11, 0.2, '#e9e4d6', { x: -0.2, y: 0.2, z: -0.25 });
    // umbrella: pole and a 16-panel striped canopy with a scalloped edge
    m.cylinder(0.03, 0.03, 0.95, '#7a7f86', { y: 1.72 });
    const stripe = (_t: number, c: Vector3) => (Math.floor(((Math.atan2(c.z, c.x) + Math.PI) / (Math.PI * 2)) * 16) % 2 ? '#f4c430' : '#1f5fb3');
    m.painted(new ConeGeometry(1.08, 0.42, 32, 2, true), stripe, { y: 2.12 });
    m.painted(new ConeGeometry(1.07, 0.41, 32, 2, true), (t, c) => (stripe(t, c) === '#1f5fb3' ? '#174a8c' : '#d9a91c'), { y: 2.115, rx: Math.PI });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
      m.sphere(0.1, i % 2 ? '#f4c430' : '#1f5fb3', { x: Math.cos(a) * 1.02, y: 1.9, z: Math.sin(a) * 1.02, sy: 0.6 }, 8, 6);
    }
    m.sphere(0.05, '#d9d9d9', { y: 2.36 }, 8, 6);
    return m.build();
  });
}

export function cartSign(atlas: Atlas): BufferGeometry {
  return cached('cartSign', () => {
    const [u0, v0, u1, v1] = atlas.uv('cart');
    return new QuadBuilder({ uv: 2, color: 3 })
      .quad([[-0.56, 0.46, 0.415], [0.56, 0.46, 0.415], [0.56, 1.16, 0.415], [-0.56, 1.16, 0.415]], { uv: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], color: [[1, 1, 1]] })
      .build();
  });
}

export function trashGeometry(variant: number): BufferGeometry {
  const v = Math.floor(variant * 3);
  return cached(`trash${v}`, () => {
    const m = new MeshBuilder();
    // lumpy, glossy bags with tied necks and little twist ears
    const bags: [number, number, number, number, string][] = [
      [-0.3, 0.25, 0.08, 0.3, '#1a1a1c'],
      [0.28, 0.24, -0.05, 0.29, '#222226'],
      [0.0, 0.5, 0.0, 0.26, '#141416'],
      [0.14, 0.2, 0.32, 0.21, v === 1 ? '#9cc7e0' : '#2a2a2e'],
      [-0.14, 0.19, -0.34, 0.23, v === 2 ? '#e9e4d6' : '#19191b'],
    ];
    bags.forEach(([x, y, z, r, c], i) => {
      m.add(lumpy(r, i + v * 7), c, { x, y, z, sy: 0.82, ry: x * 5 });
      m.cylinder(r * 0.12, r * 0.22, r * 0.3, shade(c, 0.85), { x, y: y + r * 0.85, z });
      for (const s of [-1, 1]) m.sphere(r * 0.09, shade(c, 0.9), { x: x + s * r * 0.12, y: y + r * 1.02, z, sx: 1.6, rz: s * 0.6 }, 8, 6);
    });
    return m.build();
  });
}

/** A bag-shaped blob: a sphere pushed in and out by a little deterministic noise, flattened on the bottom. */
function lumpy(r: number, seed: number): BufferGeometry {
  const g = new IcosahedronGeometry(r, 3);
  const p = g.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 23 + seed) * Math.sin(v.y * 19 + seed * 2) * Math.sin(v.z * 21 + seed * 3);
    v.multiplyScalar(1 + n * 0.09);
    if (v.y < -r * 0.55) v.y = -r * 0.55 - (v.y + r * 0.55) * 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function cellarGeometry(): BufferGeometry {
  return cached('cellar', () => {
    const m = new MeshBuilder();
    // steel frame around a dark opening with steps going down
    m.rounded(1.34, 0.05, 1.6, 0.02, '#5f636a', { y: 0.0 });
    m.box(1.14, 0.03, 1.42, '#050505', { y: 0.012 });
    for (let i = 0; i < 4; i++) m.box(1.0, 0.03, 0.26, '#202022', { y: -0.02 - i * 0.05, z: 0.5 - i * 0.28 });
    // two diamond-plate leaves standing open, hinged on the outer edges, yellow safety stripes
    const angle = 1.15;
    for (const s of [-1, 1]) {
      const leaf = new MeshBuilder();
      leaf.rounded(0.58, 0.035, 1.4, 0.012, '#7c8088', { x: -s * 0.29 });
      for (let i = 0; i < 6; i++) for (let j = 0; j < 12; j++) leaf.box(0.04, 0.012, 0.07, '#9aa0a8', { x: -s * (0.06 + i * 0.09), y: 0.022, z: -0.62 + j * 0.11, ry: (i + j) % 2 ? 0.8 : -0.8 });
      leaf.rounded(0.06, 0.04, 1.42, 0.015, '#e9c400', { x: -s * 0.56, y: 0.01 });
      for (const z of [-0.5, 0.5]) leaf.cylinder(0.025, 0.025, 0.08, '#4a4d52', { x: 0, y: 0, z, rx: Math.PI / 2 });
      m.merge(leaf, { x: s * 0.6, y: 0.03, rz: -s * angle });
    }
    // a safety chain across the front
    for (let i = 0; i < 9; i++) m.add(new TorusGeometry(0.025, 0.006, 4, 8), '#9a9a9a', { x: -0.4 + i * 0.1, y: 0.42 - Math.sin((i / 8) * Math.PI) * 0.1, z: 0.72, ry: i % 2 ? Math.PI / 2 : 0 });
    return m.build();
  });
}

export function sawhorseGeometry(): BufferGeometry {
  return cached('sawhorse', () => {
    const m = new MeshBuilder();
    for (const sx of [-0.55, 0.55]) {
      for (const sz of [-1, 1]) m.rounded(0.07, 0.88, 0.07, 0.02, '#6b5a48', { x: sx, y: 0.42, z: sz * 0.12, rx: sz * 0.22 });
      m.rounded(0.08, 0.06, 0.36, 0.02, '#5b4a3a', { x: sx, y: 0.22 });
    }
    // reflective orange-and-white rail with rounded ends, and a warning lamp on each end
    m.rounded(1.34, 0.28, 0.07, 0.03, '#f6f2ea', { y: 0.7, z: 0.06 });
    for (let i = 0; i < 5; i++) m.box(0.12, 0.27, 0.074, '#f26a1b', { x: -0.52 + i * 0.26, y: 0.7, z: 0.06, rz: 0.6 });
    for (const sx of [-0.6, 0.6]) {
      m.cylinder(0.03, 0.03, 0.1, '#333', { x: sx, y: 0.88, z: 0.06 });
      m.sphere(0.065, '#ffb000', { x: sx, y: 0.96, z: 0.06 }, 12, 10);
    }
    return m.build();
  });
}

export function steamStackGeometry(): BufferGeometry {
  return cached('steam', () => {
    const m = new MeshBuilder();
    m.rounded(1.0, 0.06, 1.0, 0.02, '#3a3a3e', { y: 0.03 });
    for (let i = 0; i < 9; i++) m.box(0.9, 0.02, 0.04, '#26262a', { y: 0.065, z: -0.4 + i * 0.1 });
    m.cylinder(0.46, 0.5, 0.12, '#d9531a', { y: 0.1 }, 24);
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const y0 = 0.16 + (i * 2.14) / segs;
      const y1 = 0.16 + ((i + 1) * 2.14) / segs;
      const r0 = 0.38 - 0.09 * ((y0 - 0.16) / 2.14);
      const r1 = 0.38 - 0.09 * ((y1 - 0.16) / 2.14);
      m.add(new CylinderGeometry(r1, r0, y1 - y0, 24, 1), i % 2 ? '#f6f2ea' : '#f26a1b', { y: (y0 + y1) / 2 });
    }
    m.add(new TorusGeometry(0.3, 0.04, 8, 24), '#d9531a', { y: 2.32, rx: Math.PI / 2 });
    m.sphere(0.3, '#e2611d', { y: 2.33, sy: 0.35 }, 20, 10);
    return m.build();
  });
}

/** Sidewalk shed with hanging POST NO BILLS plywood spanning every lane. */
export function shedGeometry(): BufferGeometry {
  return cached('shed', () => {
    const m = new MeshBuilder();
    const green = '#2c4a37';
    const xs = [-3.05, 2.45];
    for (const x of xs) for (const z of [-3.2, 0, 3.2]) m.box(0.12, 3.0, 0.12, green, { x, y: 1.5, z });
    for (const z of [-3.2, 0, 3.2]) m.box(5.6, 0.16, 0.14, green, { x: -0.3, y: 2.95, z });
    m.box(5.8, 0.18, 6.8, '#355a42', { x: -0.3, y: 3.12 });
    m.box(5.8, 0.5, 0.06, '#e9e4d6', { x: -0.3, y: 3.42, z: 3.4 });
    m.box(5.36, 0.04, 0.08, '#151515', { x: -0.28, y: 2.62, z: 0.02 });
    return m.build();
  });
}

export function shedLights(): BufferGeometry {
  return cached('shedLights', () => {
    const m = new MeshBuilder();
    for (const z of [-2, 1.5]) m.box(0.12, 0.04, 0.6, '#fff3d6', { x: -0.3, y: 3.02, z });
    return m.build();
  });
}

export function plywoodSign(atlas: Atlas): BufferGeometry {
  return cached('plywood', () => {
    const [u0, v0, u1, v1] = atlas.uv('plywood');
    return new QuadBuilder({ uv: 2, color: 3 })
      .quad([[-2.95, 0.95, 0.05], [2.4, 0.95, 0.05], [2.4, 2.6, 0.05], [-2.95, 2.6, 0.05]], { uv: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], color: [[1, 1, 1]] })
      .build();
  });
}

export type CarKind = 'cab' | 'sedan' | 'van' | 'bus';

/** A car pointing down -z (driving away from the camera), centred on its footprint. */
export function carGeometry(kind: CarKind, paint: string): BufferGeometry {
  return cached(`car:${kind}:${paint}`, () => {
    const m = new MeshBuilder();
    const glass = '#26323f';
    const tire = '#151517';
    const trim = '#2a2b30';
    const wheel = (x: number, z: number, r: number) => {
      m.cylinder(r, r, 0.26, tire, { x, y: r, z, rz: Math.PI / 2 }, 18);
      m.cylinder(r * 0.5, r * 0.5, 0.27, '#9aa0a8', { x, y: r, z, rz: Math.PI / 2 }, 12);
    };
    if (kind === 'bus') {
      m.rounded(2.55, 2.75, 12, 0.3, '#f1f1f1', { y: 1.7 });
      m.rounded(2.58, 1.0, 11.2, 0.15, glass, { y: 2.25 });
      m.rounded(2.58, 0.3, 11.9, 0.1, '#1f5fb3', { y: 1.2 });
      m.rounded(2.3, 1.0, 0.1, 0.05, glass, { y: 2.2, z: 5.97 });
      m.rounded(2.5, 0.35, 0.3, 0.1, trim, { y: 0.5, z: 5.95 });
      m.rounded(2.0, 0.3, 1.2, 0.1, '#d9dce0', { y: 3.15, z: -2 });
      for (const z of [-4.3, 4.0]) for (const sx of [-1, 1]) wheel(sx * 1.16, z, 0.5);
      return m.build();
    }
    const van = kind === 'van';
    const L = van ? 5.2 : 4.7;
    const W = van ? 2.0 : 1.86;
    const bodyH = van ? 1.55 : 0.72;
    const base = 0.3;
    m.rounded(W, bodyH, L, van ? 0.22 : 0.2, paint, { y: base + bodyH / 2 });
    if (van) {
      m.rounded(W + 0.02, 0.55, L * 0.26, 0.1, glass, { y: 1.5, z: -L * 0.34 });
      m.rounded(W - 0.3, 0.5, 0.06, 0.04, glass, { y: 1.45, z: L / 2 });
    } else {
      // greenhouse: painted roof over a glass band, raked windshields
      m.rounded(W - 0.18, 0.56, L * 0.5, 0.16, paint, { y: base + bodyH + 0.24, z: 0.12 });
      m.rounded(W - 0.14, 0.38, L * 0.5 - 0.08, 0.12, glass, { y: base + bodyH + 0.24, z: 0.12 });
      m.rounded(W - 0.36, 0.36, 0.06, 0.05, glass, { y: base + bodyH + 0.22, z: 0.12 + L * 0.25 + 0.02, rx: -0.35 });
      m.rounded(W - 0.36, 0.36, 0.06, 0.05, glass, { y: base + bodyH + 0.22, z: 0.12 - L * 0.25 - 0.02, rx: 0.4 });
    }
    if (kind === 'cab') {
      for (let i = 0; i < 9; i++) m.box(0.02, 0.07, 0.24, i % 2 ? '#111' : '#f5c518', { x: W / 2 + 0.002, y: base + 0.36, z: -1.1 + i * 0.24 });
      for (let i = 0; i < 9; i++) m.box(0.02, 0.07, 0.24, i % 2 ? '#111' : '#f5c518', { x: -W / 2 - 0.002, y: base + 0.36, z: -1.1 + i * 0.24 });
      m.rounded(0.62, 0.18, 0.28, 0.06, '#fff8dc', { y: base + bodyH + 0.62, z: 0.12 });
    }
    for (const z of [-L / 2, L / 2]) m.rounded(W + 0.02, 0.2, 0.22, 0.08, trim, { y: base + 0.16, z });
    for (const sx of [-1, 1]) {
      m.rounded(0.34, 0.14, 0.06, 0.04, '#c41f1f', { x: sx * (W / 2 - 0.26), y: base + bodyH - 0.12, z: L / 2 + 0.01 });
      m.rounded(0.3, 0.12, 0.06, 0.04, '#f4f1e4', { x: sx * (W / 2 - 0.26), y: base + bodyH - 0.14, z: -L / 2 - 0.01 });
      for (const z of [-L * 0.31, L * 0.31]) wheel(sx * (W / 2 - 0.08), z, 0.34);
    }
    return m.build();
  });
}

export function carGlowGeometry(kind: CarKind): BufferGeometry {
  return cached(`carGlow:${kind}`, () => {
    const m = new MeshBuilder();
    const L = kind === 'bus' ? 12 : kind === 'van' ? 5.2 : 4.7;
    const W = kind === 'bus' ? 2.55 : kind === 'van' ? 2.0 : 1.85;
    for (const s of [-1, 1]) m.box(0.26, 0.1, 0.04, '#ff3a2a', { x: s * (W / 2 - 0.25), y: kind === 'bus' ? 0.9 : 0.62, z: L / 2 + 0.035 });
    if (kind === 'bus') m.box(2.0, 0.28, 0.04, '#ffb000', { y: 3.0, z: L / 2 + 0.02 });
    return m.build();
  });
}

/** E-bike, pointing at the camera (+z), with a big insulated box. Rider is a separate person. */
/** E-bike, pointing at the camera (+z): a tube frame on torus tyres, a fat battery and a rear rack. Rider is separate. */
export function ebikeGeometry(): BufferGeometry {
  return cached('ebike', () => {
    const m = new MeshBuilder();
    const frame = '#2b2b30';
    const tube = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, c = frame) => {
      const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      const g = new CylinderGeometry(r, r, len, 10);
      const dir = new Vector3(x1 - x0, y1 - y0, z1 - z0).normalize();
      g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
      m.add(g, c, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });
    };
    for (const z of [-0.55, 0.55]) {
      m.add(new TorusGeometry(0.3, 0.05, 10, 28), '#141414', { y: 0.35, z, ry: Math.PI / 2 });
      m.add(new TorusGeometry(0.24, 0.015, 6, 24), '#8a9098', { y: 0.35, z, ry: Math.PI / 2 });
      m.cylinder(0.05, 0.05, 0.1, '#9aa0a8', { y: 0.35, z, rz: Math.PI / 2 });
      for (let k = 0; k < 6; k++) m.box(0.006, 0.46, 0.006, '#b7bcc3', { y: 0.35, z, rx: (k / 6) * Math.PI });
    }
    tube(0, 0.35, -0.55, 0, 0.42, -0.05, 0.025);
    tube(0, 0.42, -0.05, 0, 0.92, -0.2, 0.03);
    tube(0, 0.42, -0.05, 0, 0.88, 0.42, 0.035);
    tube(0, 0.86, -0.2, 0, 0.88, 0.42, 0.03);
    tube(0, 0.35, 0.55, 0, 1.02, 0.46, 0.028);
    tube(0, 0.86, -0.2, 0, 0.35, -0.55, 0.022);
    tube(-0.32, 1.06, 0.48, 0.32, 1.06, 0.48, 0.02, '#1b1b1b');
    for (const s of [-1, 1]) m.capsule(0.03, 0.08, '#111', { x: s * 0.34, y: 1.06, z: 0.48, rz: Math.PI / 2 });
    m.rounded(0.12, 0.28, 0.5, 0.05, '#3a3a40', { y: 0.62, z: 0.18, rx: 0.7 });
    m.rounded(0.2, 0.07, 0.3, 0.035, '#1e1e1e', { y: 0.96, z: -0.22 });
    m.rounded(0.24, 0.03, 0.42, 0.01, '#3a3a40', { y: 0.72, z: -0.55 });
    m.cylinder(0.08, 0.08, 0.05, '#555', { y: 0.38, z: -0.05, rz: Math.PI / 2 });
    m.cylinder(0.065, 0.05, 0.09, '#2a2a2a', { y: 0.96, z: 0.62, rx: Math.PI / 2 });
    return m.build();
  });
}

export function ebikeLamp(): BufferGeometry {
  return cached('ebikeLamp', () => new MeshBuilder().cylinder(0.05, 0.05, 0.02, '#fffbe0', { y: 0.96, z: 0.67, rx: Math.PI / 2 }, 16).build());
}

export function pigeonGeometry(): BufferGeometry {
  return cached('pigeon', () => {
    const m = new MeshBuilder();
    m.sphere(0.11, '#7d828c', { y: 0.13, sz: 1.45, sy: 0.85 }, 14, 10);
    m.sphere(0.075, '#6a8f8a', { y: 0.2, z: 0.1, sy: 1.1 }, 12, 8);
    m.sphere(0.06, '#5c6270', { y: 0.25, z: 0.15 }, 12, 8);
    m.cone(0.018, 0.05, '#d9a05a', { y: 0.245, z: 0.21, rx: Math.PI / 2 }, 6);
    for (const s of [-1, 1]) {
      m.sphere(0.012, '#d24a1e', { x: s * 0.04, y: 0.265, z: 0.18 }, 6, 4);
      m.sphere(0.07, '#9aa0aa', { x: s * 0.07, y: 0.15, z: -0.02, sx: 0.35, sz: 1.5 }, 10, 8);
    }
    m.sphere(0.06, '#5c6270', { y: 0.12, z: -0.17, sx: 1.2, sy: 0.3, sz: 1.3 }, 10, 6);
    for (const s of [-1, 1]) m.cylinder(0.008, 0.008, 0.07, '#d24a1e', { x: s * 0.03, y: 0.03 });
    return m.build();
  });
}

/** A thick, slightly droopy dollar slice: cheese, sauce edge, crust, pepperoni and a couple of cheese drips. */
export function sliceGeometry(): BufferGeometry {
  return cached('slice', () => {
    const m = new MeshBuilder();
    const shape = new Shape();
    shape.moveTo(-0.38, 0.3);
    shape.lineTo(0.38, 0.3);
    shape.lineTo(0, -0.42);
    shape.closePath();
    const wedge = new ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3 });
    wedge.translate(0, 0, -0.025);
    m.add(wedge, '#ffcf5a');
    m.capsule(0.07, 0.72, '#d9902f', { y: 0.33, rz: Math.PI / 2 });
    for (const [x, y] of [[-0.13, 0.12], [0.13, 0.15], [0.0, -0.1], [-0.05, 0.25]]) m.cylinder(0.065, 0.065, 0.03, '#c0392b', { x, y, z: 0.05, rx: Math.PI / 2 }, 16);
    for (const [x, y, l] of [[-0.18, -0.02, 0.1], [0.12, -0.12, 0.14]]) m.capsule(0.022, l, '#ffd76e', { x, y: y - l / 2, z: 0.02 });
    return m.build();
  });
}

/** The bodega cat: an orange tabby sitting up, tail curled around its paws. */
export function catGeometry(): BufferGeometry {
  return cached('cat', () => {
    const m = new MeshBuilder();
    const fur = '#e08a2f';
    const stripe = '#b86418';
    m.painted(new SphereGeometry(0.2, 20, 14), (_t, c) => (Math.sin(c.y * 60) > 0.55 && c.z < 0.05 ? stripe : fur), { y: 0.2, sx: 0.95, sy: 1.15, sz: 1.1 });
    m.sphere(0.12, '#f6d9b0', { y: 0.2, z: 0.12, sy: 1.3 }, 14, 10);
    m.painted(new SphereGeometry(0.15, 20, 14), (_t, c) => (c.y > 0.08 && Math.abs(c.x) < 0.03 ? stripe : fur), { y: 0.46, z: 0.05 });
    m.sphere(0.07, '#f6d9b0', { y: 0.42, z: 0.15, sx: 1.3, sy: 0.8 }, 12, 8);
    m.sphere(0.018, '#f08aa0', { y: 0.45, z: 0.2 }, 8, 6);
    for (const s of [-1, 1]) {
      m.cone(0.06, 0.12, fur, { x: s * 0.085, y: 0.6, z: 0.03, rz: -s * 0.3 }, 10);
      m.cone(0.035, 0.07, '#f6b8a0', { x: s * 0.085, y: 0.59, z: 0.045, rz: -s * 0.3 }, 8);
      m.sphere(0.03, '#3ccf6e', { x: s * 0.055, y: 0.49, z: 0.17, sz: 0.5 }, 10, 8);
      m.sphere(0.014, '#111', { x: s * 0.055, y: 0.49, z: 0.186, sx: 0.5, sz: 0.5 }, 6, 4);
      m.sphere(0.05, '#f6d9b0', { x: s * 0.07, y: 0.03, z: 0.15, sz: 1.3, sy: 0.6 }, 10, 8);
      for (const k of [0, 1]) m.box(0.12, 0.004, 0.004, '#f4f4f4', { x: s * 0.13, y: 0.42 + k * 0.025, z: 0.17, rz: s * (k ? 0.15 : -0.1) });
    }
    m.add(new TorusGeometry(0.17, 0.035, 8, 20, Math.PI * 1.2), fur, { y: 0.04, z: 0.02, rx: Math.PI / 2, rz: 0.3 });
    return m.build();
  });
}

export function expressCardGeometry(): BufferGeometry {
  return cached('express', () => {
    const m = new MeshBuilder();
    m.rounded(0.86, 0.55, 0.035, 0.03, '#18a39a', {});
    m.rounded(0.86, 0.12, 0.04, 0.01, '#f6f2ea', { y: 0.12 });
    m.box(0.16, 0.16, 0.042, '#f6f2ea', { x: -0.27, y: -0.12, rz: Math.PI / 4 });
    for (let i = 0; i < 3; i++) m.rounded(0.3, 0.035, 0.044, 0.012, '#0d5e58', { x: 0.14, y: -0.06 - i * 0.07 });
    m.rounded(0.14, 0.1, 0.044, 0.02, '#e9c46a', { x: 0.3, y: 0.18 });
    return m.build();
  });
}

/** One mesh per material, under a group. */
export function assemble(parts: [BufferGeometry, Material, boolean?][]): Group {
  const g = new Group();
  for (const [geo, mat, cast] of parts) {
    const mesh = new Mesh(geo, mat);
    mesh.castShadow = cast ?? true;
    mesh.receiveShadow = false;
    g.add(mesh);
  }
  return g;
}

