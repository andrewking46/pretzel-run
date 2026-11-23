import { BufferGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, type Material, Vector3 } from 'three';
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
const DARK = '#26262b';

export function cartGeometry(): BufferGeometry {
  return cached('cart', () => {
    const m = new MeshBuilder();
    m.box(1.2, 0.82, 0.82, STEEL, { y: 0.78 });
    m.box(1.24, 0.08, 0.86, '#9aa0a8', { y: 1.22 });
    m.box(1.24, 0.08, 0.86, '#9aa0a8', { y: 0.38 });
    for (const s of [-1, 1]) m.cylinder(0.22, 0.22, 0.1, '#1b1b1d', { x: s * 0.52, y: 0.22, z: 0.1, rz: Math.PI / 2 }, 12);
    m.box(0.06, 0.06, 0.5, '#888', { x: 0.62, y: 1.0, z: -0.2 });
    m.cylinder(0.035, 0.035, 0.9, '#7a7f86', { y: 1.7 }, 6);
    m.painted(new ConeGeometry(1.05, 0.36, 8, 1, true), t => (Math.floor(t) % 2 ? '#f4c430' : '#1f5fb3'), { y: 2.08 });
    m.painted(new ConeGeometry(1.05, 0.36, 8, 1, true), t => (Math.floor(t) % 2 ? '#d9a91c' : '#174a8c'), { y: 2.075, rx: Math.PI, sy: -1 });
    m.cylinder(0.06, 0.06, 0.18, '#e9c400', { x: -0.4, y: 1.35, z: 0.15 }, 6);
    m.cylinder(0.06, 0.06, 0.18, '#c62828', { x: -0.25, y: 1.35, z: 0.15 }, 6);
    m.box(0.3, 0.12, 0.2, '#e8e2d0', { x: 0.3, y: 1.32, z: 0.1 });
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
    const bags: [number, number, number, number, string][] = [
      [-0.3, 0.26, 0.1, 0.32, '#1a1a1c'],
      [0.28, 0.25, -0.05, 0.31, '#222226'],
      [0.0, 0.52, 0.02, 0.28, '#141416'],
      [0.12, 0.22, 0.32, 0.22, v === 1 ? '#9cc7e0' : '#2a2a2e'],
      [-0.12, 0.2, -0.35, 0.24, v === 2 ? '#e9e4d6' : '#19191b'],
    ];
    for (const [x, y, z, r, c] of bags) m.blob(r, c, { x, y, z, sy: 0.85, ry: x * 5 }, 1);
    for (const [x, y, z, r] of bags) m.box(r * 0.25, r * 0.35, r * 0.25, '#0d0d0e', { x, y: y + r * 0.85, z });
    return m.build();
  });
}

export function cellarGeometry(): BufferGeometry {
  return cached('cellar', () => {
    const m = new MeshBuilder();
    m.box(1.14, 0.02, 1.42, '#050505', { y: 0.005 });
    m.box(1.3, 0.03, 1.56, '#5f636a', { y: 0.0 });
    const angle = 1.15;
    for (const s of [-1, 1]) {
      const leaf = new MeshBuilder();
      leaf.box(0.58, 0.035, 1.4, '#7c8088', { x: -s * 0.29 });
      for (let i = 0; i < 6; i++) for (let j = 0; j < 12; j++) leaf.box(0.04, 0.012, 0.07, '#9aa0a8', { x: -s * (0.06 + i * 0.09), y: 0.022, z: -0.62 + j * 0.11, ry: (i + j) % 2 ? 0.8 : -0.8 });
      leaf.box(0.06, 0.04, 1.42, '#e9c400', { x: -s * 0.56, y: 0.01 });
      m.merge(leaf, { x: s * 0.6, y: 0.02, rz: s * angle });
    }
    m.cylinder(0.02, 0.02, 0.9, '#8a8a8a', { y: 0.35, z: 0.69, rz: Math.PI / 2 }, 4);
    return m.build();
  });
}

export function sawhorseGeometry(): BufferGeometry {
  return cached('sawhorse', () => {
    const m = new MeshBuilder();
    for (const sx of [-0.55, 0.55]) {
      for (const sz of [-1, 1]) m.box(0.07, 0.85, 0.07, '#5b4a3a', { x: sx, y: 0.42, z: sz * 0.12, rx: sz * 0.22 });
    }
    const n = 9;
    for (let i = 0; i < n; i++) {
      m.box(1.3 / n + 0.001, 0.26, 0.06, i % 2 ? '#f6f2ea' : '#f26a1b', { x: -0.65 + (i + 0.5) * (1.3 / n), y: 0.7, z: 0.06, rz: 0 });
    }
    m.box(1.3, 0.04, 0.07, '#ddd', { y: 0.84, z: 0.06 });
    for (const sx of [-0.55, 0.55]) m.sphere(0.06, '#ffb000', { x: sx, y: 0.9, z: 0.06 }, 8, 6);
    return m.build();
  });
}

export function steamStackGeometry(): BufferGeometry {
  return cached('steam', () => {
    const m = new MeshBuilder();
    m.box(1.0, 0.04, 1.0, '#3a3a3e', { y: 0.02 });
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const y0 = (i * 2.3) / segs;
      const y1 = ((i + 1) * 2.3) / segs;
      const r0 = 0.37 - 0.08 * (y0 / 2.3);
      const r1 = 0.37 - 0.08 * (y1 / 2.3);
      m.add(new CylinderGeometry(r1, r0, y1 - y0, 12, 1), i % 2 ? '#f6f2ea' : '#f26a1b', { y: (y0 + y1) / 2 });
    }
    m.cylinder(0.31, 0.31, 0.1, '#d9531a', { y: 2.35 }, 12);
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
export function ebikeGeometry(): BufferGeometry {
  return cached('ebike', () => {
    const m = new MeshBuilder();
    for (const z of [-0.55, 0.55]) {
      m.cylinder(0.33, 0.33, 0.07, '#111', { y: 0.33, z, rz: Math.PI / 2 }, 14);
      m.cylinder(0.12, 0.12, 0.08, '#888', { y: 0.33, z, rz: Math.PI / 2 }, 8);
    }
    m.box(0.07, 0.07, 1.0, '#2b2b30', { y: 0.62, z: 0, rx: 0.12 });
    m.box(0.07, 0.6, 0.07, '#2b2b30', { y: 0.55, z: 0.5, rx: -0.3 });
    m.box(0.07, 0.5, 0.07, '#2b2b30', { y: 0.6, z: -0.3, rx: 0.25 });
    m.box(0.62, 0.05, 0.05, '#2b2b30', { y: 1.05, z: 0.62 });
    m.box(0.2, 0.08, 0.32, '#222', { y: 0.98, z: -0.28 });
    m.box(0.16, 0.26, 0.4, '#3a3a40', { y: 0.55, z: -0.05 });
    m.box(0.2, 0.06, 0.4, '#1b1b1b', { y: 0.58, z: -0.62 });
    return m.build();
  });
}

export function ebikeLamp(): BufferGeometry {
  return cached('ebikeLamp', () => new MeshBuilder().sphere(0.08, '#fffbe0', { y: 0.95, z: 0.68 }, 8, 6).build());
}

export function dogGeometry(variant: number): BufferGeometry {
  const coats = ['#c8964f', '#2b2b2b', '#f2efe8', '#8a5a3c', '#d9c3a0'];
  const coat = coats[Math.floor(variant * coats.length) % coats.length];
  const size = 0.75 + (Math.floor(variant * 97) % 5) * 0.12;
  return cached(`dog:${coat}:${size}`, () => {
    const m = new MeshBuilder();
    const ear = coat === '#f2efe8' ? '#c9b8a0' : '#1a1410';
    m.box(0.22, 0.2, 0.5, coat, { y: 0.32 });
    m.box(0.2, 0.2, 0.2, coat, { y: 0.48, z: 0.3 });
    m.box(0.12, 0.09, 0.12, coat, { y: 0.44, z: 0.43 });
    m.box(0.05, 0.04, 0.03, '#111', { y: 0.47, z: 0.5 });
    for (const s of [-1, 1]) {
      m.box(0.06, 0.12, 0.05, ear, { x: s * 0.08, y: 0.6, z: 0.27 });
      m.box(0.035, 0.035, 0.02, '#111', { x: s * 0.05, y: 0.52, z: 0.405 });
      for (const z of [-0.18, 0.18]) m.box(0.07, 0.24, 0.07, coat, { x: s * 0.08, y: 0.12, z });
    }
    m.box(0.05, 0.05, 0.22, coat, { y: 0.42, z: -0.32, rx: -0.6 });
    m.box(0.21, 0.04, 0.04, '#d33', { y: 0.42, z: 0.22 });
    const g = m.build();
    g.scale(size, size, size);
    return g;
  });
}

export function pigeonGeometry(): BufferGeometry {
  return cached('pigeon', () => {
    const m = new MeshBuilder();
    m.blob(0.12, '#7d828c', { y: 0.12, sz: 1.5, sy: 0.85 }, 1);
    m.blob(0.065, '#5c6270', { y: 0.22, z: 0.13 }, 1);
    m.box(0.025, 0.02, 0.05, '#d9a05a', { y: 0.21, z: 0.2 });
    m.box(0.1, 0.02, 0.12, '#6a8f8a', { y: 0.17, z: 0.08 });
    m.box(0.36, 0.015, 0.12, '#9aa0aa', { y: 0.16, z: -0.02 });
    return m.build();
  });
}

export function sliceGeometry(): BufferGeometry {
  return cached('slice', () => {
    const m = new MeshBuilder();
    const tri = new ConeGeometry(0.5, 0.06, 3);
    m.add(tri, '#ffd36b', { rx: Math.PI / 2, ry: 0, y: 0, sz: 1 });
    m.box(0.78, 0.12, 0.1, '#d9902f', { y: 0.27 });
    for (const [x, y] of [[-0.12, 0.08], [0.12, 0.1], [0, -0.1]]) m.cylinder(0.07, 0.07, 0.03, '#c0392b', { x, y, z: 0.04, rx: Math.PI / 2 }, 8);
    return m.build();
  });
}

export function catGeometry(): BufferGeometry {
  return cached('cat', () => {
    const m = new MeshBuilder();
    const fur = '#e08a2f';
    m.blob(0.2, fur, { y: 0.18, sz: 1.3 }, 1);
    m.blob(0.15, fur, { y: 0.4, z: 0.16 }, 1);
    for (const s of [-1, 1]) {
      m.cone(0.05, 0.1, fur, { x: s * 0.08, y: 0.55, z: 0.16 }, 4);
      m.box(0.035, 0.04, 0.02, '#2b5', { x: s * 0.055, y: 0.42, z: 0.29 });
    }
    m.box(0.03, 0.02, 0.02, '#f9c', { y: 0.38, z: 0.3 });
    m.box(0.04, 0.04, 0.34, fur, { x: 0.12, y: 0.22, z: -0.3, rx: -0.9 });
    for (let i = 0; i < 3; i++) m.box(0.21, 0.025, 0.1, '#b86418', { y: 0.12 + i * 0.07, z: -0.12 + i * 0.03 });
    return m.build();
  });
}

export function expressCardGeometry(): BufferGeometry {
  return cached('express', () => {
    const m = new MeshBuilder();
    m.box(0.84, 0.54, 0.03, '#18a39a', {});
    m.box(0.84, 0.12, 0.034, '#f6f2ea', { y: 0.12 });
    m.box(0.16, 0.16, 0.036, '#f6f2ea', { x: -0.27, y: -0.12, rz: Math.PI / 4 });
    for (let i = 0; i < 3; i++) m.box(0.3, 0.035, 0.036, '#0d5e58', { x: 0.14, y: -0.06 - i * 0.07 });
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

export const UP = new Vector3(0, 1, 0);
export { DARK };
