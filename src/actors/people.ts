import { Bone, BufferAttribute, Group, MeshStandardMaterial, Skeleton, SkinnedMesh, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBuilder } from '../world/builder.ts';

// Chunky "toy" people. Each person is one SkinnedMesh whose parts are rigidly bound to 11 bones,
// so a whole character is one draw call and every motion is a few bone rotations in code.
// Built facing +z (toward the camera); Alex is turned around to run away from it.

export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'bald';
export type TopStyle = 'hoodie' | 'coat' | 'tee' | 'jacket' | 'suit';

export interface PersonLook {
  skin: string;
  hair: string;
  eyes?: string;
  /** suits only */
  shirt?: string;
  tie?: string;
  dressShoes?: boolean;
  hairStyle: HairStyle;
  top: string;
  topStyle: TopStyle;
  pants: string;
  shoes: string;
  /** 1 = adult proportions; Alex is a little big-headed */
  headScale?: number;
  height?: number;
  cap?: string;
  glasses?: boolean;
  backpack?: string;
  chest?: string;
  phone?: boolean;
  camera?: boolean;
  map?: boolean;
  deliveryBox?: string;
  apron?: boolean;
}

const BONES = ['root', 'spine', 'head', 'armL', 'foreL', 'armR', 'foreR', 'thighL', 'shinL', 'thighR', 'shinR'] as const;
export type BoneName = (typeof BONES)[number];

export interface Person {
  object: Group;
  mesh: SkinnedMesh;
  bones: Record<BoneName, Bone>;
}

let sharedMaterial: MeshStandardMaterial | null = null;
export function personMaterial(): MeshStandardMaterial {
  sharedMaterial ??= new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
  return sharedMaterial;
}

// joint positions in the bind pose
const HIP_Y = 0.9;
const SHOULDER = [0.25, 0.47] as const;

export function buildPerson(look: PersonLook): Person {
  const hs = look.headScale ?? 1;
  const parts: Record<BoneName, MeshBuilder> = Object.fromEntries(BONES.map(b => [b, new MeshBuilder()])) as Record<BoneName, MeshBuilder>;
  const { skin, hair, top, pants, shoes } = look;
  const shoulderY = HIP_Y + SHOULDER[1] + 0.05;

  // hips and torso
  parts.root.box(0.34, 0.2, 0.23, pants, { y: HIP_Y + 0.02 });
  const coat = look.topStyle === 'coat';
  parts.spine.box(0.4, 0.5, 0.25, top, { y: HIP_Y + 0.3 });
  parts.spine.box(0.3, 0.1, 0.2, top, { y: HIP_Y + 0.58 });
  if (coat) parts.spine.box(0.44, 0.34, 0.28, top, { y: HIP_Y - 0.05 });
  if (look.topStyle === 'hoodie') {
    parts.spine.box(0.3, 0.2, 0.12, shade(top, 0.82), { y: HIP_Y + 0.56, z: -0.16 });
    parts.spine.box(0.24, 0.12, 0.02, shade(top, 0.85), { y: HIP_Y + 0.16, z: 0.13 });
    parts.spine.box(0.03, 0.14, 0.02, '#e8e4dc', { x: -0.05, y: HIP_Y + 0.44, z: 0.13 });
    parts.spine.box(0.03, 0.14, 0.02, '#e8e4dc', { x: 0.05, y: HIP_Y + 0.44, z: 0.13 });
  }
  if (look.topStyle === 'jacket') parts.spine.box(0.04, 0.48, 0.02, shade(top, 0.7), { y: HIP_Y + 0.3, z: 0.13 });
  if (look.topStyle === 'suit') {
    const shirt = look.shirt ?? '#f4f6fa';
    const lapel = shade(top, 1.25);
    // jacket hem over the hips, back vent, shirt-and-tie V, lapels, and a white collar that shows from behind
    parts.spine.box(0.42, 0.18, 0.27, top, { y: HIP_Y + 0.02 });
    parts.spine.box(0.015, 0.16, 0.01, shade(top, 0.6), { y: HIP_Y + 0.02, z: -0.137 });
    parts.spine.box(0.14, 0.24, 0.01, shirt, { y: HIP_Y + 0.44, z: 0.127 });
    parts.spine.box(0.05, 0.3, 0.012, look.tie ?? '#a3242f', { y: HIP_Y + 0.36, z: 0.134 });
    parts.spine.box(0.07, 0.05, 0.016, shade(look.tie ?? '#a3242f', 0.8), { y: HIP_Y + 0.53, z: 0.136 });
    for (const s of [-1, 1]) parts.spine.box(0.07, 0.3, 0.012, lapel, { x: s * 0.085, y: HIP_Y + 0.42, z: 0.132, rz: s * 0.32 });
    parts.spine.box(0.04, 0.04, 0.012, '#e9e4d6', { x: -0.13, y: HIP_Y + 0.43, z: 0.133 });
    parts.spine.box(0.26, 0.05, 0.2, shirt, { y: HIP_Y + 0.62, z: -0.01 });
    for (const y of [0.24, 0.12]) parts.spine.box(0.025, 0.025, 0.01, shade(top, 0.55), { x: 0.035, y: HIP_Y + y, z: 0.13 });
  }
  if (look.chest) parts.spine.box(0.22, 0.12, 0.02, look.chest, { y: HIP_Y + 0.36, z: 0.13 });
  if (look.apron) parts.spine.box(0.34, 0.55, 0.02, '#f2f2f2', { y: HIP_Y + 0.14, z: 0.135 });
  if (look.backpack) parts.spine.box(0.32, 0.4, 0.16, look.backpack, { y: HIP_Y + 0.32, z: -0.2 });
  if (look.deliveryBox) {
    parts.spine.box(0.56, 0.5, 0.42, look.deliveryBox, { y: HIP_Y + 0.5, z: -0.36 });
    parts.spine.box(0.58, 0.06, 0.44, shade(look.deliveryBox, 1.25), { y: HIP_Y + 0.62, z: -0.36 });
  }

  // head
  const r = 0.15 * hs;
  const headY = shoulderY + 0.05 + r;
  parts.head.box(0.09, 0.08, 0.09, skin, { y: shoulderY + 0.02 });
  parts.head.blob(r, skin, { y: headY, sx: 0.95, sy: 1.05 }, 1);
  parts.head.box(0.05 * hs, 0.06 * hs, 0.05, shade(skin, 0.9), { y: headY - 0.01 * hs, z: r * 0.98 });
  for (const s of [-1, 1]) {
    parts.head.box(0.035 * hs, 0.045 * hs, 0.02, look.eyes ?? '#1d1a18', { x: s * 0.055 * hs, y: headY + 0.03 * hs, z: r * 0.92 });
    parts.head.box(0.012 * hs, 0.015 * hs, 0.02, '#fff', { x: s * 0.055 * hs + 0.008, y: headY + 0.04 * hs, z: r * 0.93 });
    parts.head.box(0.035 * hs, 0.05 * hs, 0.05 * hs, skin, { x: s * r * 0.98, y: headY, z: 0 });
  }
  if (look.glasses) {
    for (const s of [-1, 1]) parts.head.box(0.07 * hs, 0.05 * hs, 0.02, '#141414', { x: s * 0.055 * hs, y: headY + 0.03 * hs, z: r * 0.97 });
    parts.head.box(0.04 * hs, 0.012, 0.02, '#141414', { y: headY + 0.04 * hs, z: r * 0.99 });
  }
  const hairR = r * 1.06;
  switch (look.hairStyle) {
    case 'bald':
      break;
    case 'long':
      parts.head.blob(hairR, hair, { y: headY + 0.02, z: -0.015, sx: 1.02, sy: 0.98 }, 1);
      parts.head.box(r * 1.9, r * 1.8, r * 0.8, hair, { y: headY - r * 0.6, z: -r * 0.55 });
      break;
    case 'bun':
      parts.head.blob(hairR, hair, { y: headY + 0.02, z: -0.015, sy: 0.95 }, 1);
      parts.head.blob(r * 0.45, hair, { y: headY + r * 0.95, z: -r * 0.5 }, 1);
      break;
    case 'curly':
      for (const [x, y, z] of [[0, 0.7, 0], [-0.5, 0.45, -0.2], [0.5, 0.45, -0.2], [0, 0.3, -0.6], [-0.4, 0.75, -0.35], [0.4, 0.75, -0.35]]) {
        parts.head.blob(r * 0.55, hair, { x: x * r, y: headY + y * r, z: z * r }, 0);
      }
      break;
    default:
      parts.head.blob(hairR, hair, { y: headY + r * 0.16, z: -r * 0.12, sx: 1.02, sy: 0.88 }, 1);
      parts.head.box(r * 1.7, r * 0.35, r * 0.5, hair, { y: headY + r * 0.62, z: r * 0.5 });
  }
  if (look.cap) {
    parts.head.cylinder(r * 1.06, r * 1.08, r * 0.55, look.cap, { y: headY + r * 0.62 }, 10);
    parts.head.box(r * 1.5, 0.025, r * 0.9, look.cap, { y: headY + r * 0.42, z: r * 1.05 });
  }

  // arms (hang from the shoulders; forearms hold props)
  for (const [side, arm, fore] of [[-1, 'armL', 'foreL'], [1, 'armR', 'foreR']] as const) {
    const x = side * SHOULDER[0];
    const sy = HIP_Y + SHOULDER[1];
    parts[arm].box(0.11, 0.3, 0.12, top, { x, y: sy - 0.13 });
    const sleeve = coat || look.topStyle === 'hoodie' || look.topStyle === 'jacket' || look.topStyle === 'suit';
    parts[fore].box(0.1, 0.27, 0.11, sleeve ? top : skin, { x, y: sy - 0.42 });
    if (look.topStyle === 'suit') parts[fore].box(0.095, 0.04, 0.105, look.shirt ?? '#f4f6fa', { x, y: sy - 0.55 });
    parts[fore].box(0.09, 0.09, 0.1, skin, { x, y: sy - 0.59 });
  }
  const handY = HIP_Y + SHOULDER[1] - 0.62;
  if (look.phone) {
    parts.foreR.box(0.08, 0.14, 0.02, '#111', { x: SHOULDER[0], y: handY + 0.05, z: 0.07 });
    parts.foreR.box(0.065, 0.12, 0.005, '#8fd3ff', { x: SHOULDER[0], y: handY + 0.05, z: 0.082 });
  }
  if (look.camera) {
    parts.foreR.box(0.2, 0.13, 0.1, '#1a1a1a', { x: SHOULDER[0] - 0.08, y: handY + 0.04, z: 0.06 });
    parts.foreR.cylinder(0.04, 0.04, 0.08, '#445', { x: SHOULDER[0] - 0.08, y: handY + 0.04, z: 0.13, rx: Math.PI / 2 }, 8);
  }
  if (look.map) {
    parts.foreR.box(0.46, 0.02, 0.32, '#f4f1e1', { x: SHOULDER[0] - 0.23, y: handY + 0.02, z: 0.12 });
    parts.foreR.box(0.14, 0.024, 0.1, '#8fb3d9', { x: SHOULDER[0] - 0.33, y: handY + 0.022, z: 0.08 });
    parts.foreR.box(0.12, 0.024, 0.08, '#e07a5f', { x: SHOULDER[0] - 0.12, y: handY + 0.022, z: 0.16 });
  }

  // legs
  for (const [side, thigh, shin] of [[-1, 'thighL', 'shinL'], [1, 'thighR', 'shinR']] as const) {
    const x = side * 0.1;
    parts[thigh].box(0.15, 0.44, 0.17, coat ? shade(top, 0.95) : pants, { x, y: HIP_Y - 0.22 });
    parts[shin].box(0.13, 0.4, 0.15, pants, { x, y: HIP_Y - 0.64 });
    if (look.dressShoes) {
      // polished oxfords: low, long, slightly pointed, with a thin dark sole
      parts[shin].box(0.12, 0.075, 0.29, shoes, { x, y: 0.05, z: 0.06 });
      parts[shin].box(0.09, 0.06, 0.06, shoes, { x, y: 0.045, z: 0.22 });
      parts[shin].box(0.125, 0.022, 0.31, '#1a120c', { x, y: 0.011, z: 0.065 });
    } else {
      parts[shin].box(0.14, 0.09, 0.27, shoes, { x, y: 0.045, z: 0.05 });
      parts[shin].box(0.145, 0.03, 0.28, shade(shoes, 0.75), { x, y: 0.015, z: 0.05 });
    }
  }

  // assemble: one merged geometry, each vertex bound fully to its part's bone
  const geos: BufferGeometry[] = [];
  BONES.forEach((name, i) => {
    if (parts[name].empty) return;
    const g = parts[name].build();
    const n = g.attributes.position.count;
    const idx = new Uint16Array(n * 4);
    const w = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) {
      idx[v * 4] = i;
      w[v * 4] = 1;
    }
    g.setAttribute('skinIndex', new BufferAttribute(idx, 4));
    g.setAttribute('skinWeight', new BufferAttribute(w, 4));
    geos.push(g);
  });
  const geometry = mergeGeometries(geos)!;
  for (const g of geos) g.dispose();
  if (look.height) geometry.scale(look.height / 1.75, look.height / 1.75, look.height / 1.75);

  const k = (look.height ?? 1.75) / 1.75;
  const bones = Object.fromEntries(BONES.map(n => [n, new Bone()])) as Record<BoneName, Bone>;
  bones.root.position.set(0, HIP_Y * k, 0);
  bones.root.userData.k = k;
  bones.spine.position.set(0, 0.04 * k, 0);
  bones.head.position.set(0, (SHOULDER[1] + 0.01) * k, 0);
  bones.armL.position.set(-SHOULDER[0] * k, (SHOULDER[1] - 0.04) * k, 0);
  bones.armR.position.set(SHOULDER[0] * k, (SHOULDER[1] - 0.04) * k, 0);
  bones.foreL.position.set(0, -0.29 * k, 0);
  bones.foreR.position.set(0, -0.29 * k, 0);
  bones.thighL.position.set(-0.1 * k, -0.02 * k, 0);
  bones.thighR.position.set(0.1 * k, -0.02 * k, 0);
  bones.shinL.position.set(0, -0.43 * k, 0);
  bones.shinR.position.set(0, -0.43 * k, 0);
  bones.root.add(bones.spine, bones.thighL, bones.thighR);
  bones.spine.add(bones.head, bones.armL, bones.armR);
  bones.armL.add(bones.foreL);
  bones.armR.add(bones.foreR);
  bones.thighL.add(bones.shinL);
  bones.thighR.add(bones.shinR);

  const mesh = new SkinnedMesh(geometry, personMaterial());
  mesh.add(bones.root);
  mesh.bind(new Skeleton(BONES.map(n => bones[n])));
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const object = new Group();
  object.add(mesh);
  return { object, mesh, bones };
}

export function disposePerson(p: Person): void {
  p.mesh.geometry.dispose();
  p.mesh.skeleton.dispose();
}

// ---------------------------------------------------------------- poses

export type Motion =
  | 'idle' | 'walk' | 'run' | 'jump' | 'slide' | 'stumble' | 'celebrate' | 'slump'
  | 'phone' | 'camera' | 'map' | 'ride' | 'vendor' | 'tumble' | 'cheer';

const sin = Math.sin;
const cos = Math.cos;

/** Sets every bone for `motion` at phase `t` (seconds, or stride phase for run/walk). */
export function pose(p: Person, motion: Motion, t: number, amount = 1): void {
  const b = p.bones;
  for (const name of BONES) b[name].rotation.set(0, 0, 0);
  const k = p.bones.root.userData.k as number;
  b.root.position.y = HIP_Y * k;
  b.root.position.z = 0;

  switch (motion) {
    case 'run': {
      const s = sin(t);
      const c = cos(t);
      b.root.position.y += Math.abs(s) * 0.07 * k;
      b.spine.rotation.x = 0.22;
      b.spine.rotation.y = s * 0.12;
      b.head.rotation.x = -0.12;
      b.thighL.rotation.x = s * 0.95;
      b.thighR.rotation.x = -s * 0.95;
      b.shinL.rotation.x = Math.max(0, -c) * 1.4 + 0.25;
      b.shinR.rotation.x = Math.max(0, c) * 1.4 + 0.25;
      b.armL.rotation.x = -s * 0.9;
      b.armR.rotation.x = s * 0.9;
      b.foreL.rotation.x = -1.2;
      b.foreR.rotation.x = -1.2;
      b.armL.rotation.z = -0.12;
      b.armR.rotation.z = 0.12;
      break;
    }
    case 'walk':
    case 'phone': {
      const s = sin(t);
      b.root.position.y += Math.abs(s) * 0.025 * k;
      b.thighL.rotation.x = s * 0.45;
      b.thighR.rotation.x = -s * 0.45;
      b.shinL.rotation.x = Math.max(0, -cos(t)) * 0.6;
      b.shinR.rotation.x = Math.max(0, cos(t)) * 0.6;
      if (motion === 'phone') {
        b.head.rotation.x = 0.5;
        b.spine.rotation.x = 0.08;
        b.armR.rotation.x = -0.35;
        b.foreR.rotation.x = -1.25;
        b.armR.rotation.z = 0.25;
        b.armL.rotation.x = -0.3;
        b.foreL.rotation.x = -1.2;
        b.armL.rotation.z = -0.3;
        b.foreL.rotation.z = 0.5;
      } else {
        b.armL.rotation.x = -s * 0.4;
        b.armR.rotation.x = s * 0.4;
        b.foreL.rotation.x = -0.3;
        b.foreR.rotation.x = -0.3;
      }
      break;
    }
    case 'jump': {
      b.root.position.y += 0.05 * k;
      b.spine.rotation.x = 0.28 * amount;
      b.thighL.rotation.x = -1.25 * amount;
      b.thighR.rotation.x = -0.85 * amount;
      b.shinL.rotation.x = 1.7 * amount;
      b.shinR.rotation.x = 1.4 * amount;
      b.armL.rotation.x = -2.4 * amount;
      b.armR.rotation.x = -2.1 * amount;
      b.armL.rotation.z = -0.4 * amount;
      b.armR.rotation.z = 0.4 * amount;
      b.foreL.rotation.x = -0.3;
      b.foreR.rotation.x = -0.3;
      break;
    }
    case 'slide': {
      // baseball slide: lean way back, lead leg straight out, trail leg tucked, one hand down
      b.root.position.y = 0.32 * k;
      b.root.rotation.x = -1.05;
      b.spine.rotation.x = 0.35;
      b.head.rotation.x = 0.55;
      b.thighL.rotation.x = -0.35;
      b.shinL.rotation.x = 0.05;
      b.thighR.rotation.x = 0.25;
      b.shinR.rotation.x = 1.6;
      b.armL.rotation.x = 0.4;
      b.armL.rotation.z = -1.0;
      b.armR.rotation.x = -1.4;
      b.armR.rotation.z = 0.6;
      b.foreR.rotation.x = -0.6;
      break;
    }
    case 'stumble': {
      const f = t * 26;
      b.spine.rotation.x = 0.5;
      b.spine.rotation.z = sin(t * 9) * 0.25;
      b.head.rotation.x = -0.3;
      b.armL.rotation.x = -2.2 + sin(f) * 0.8;
      b.armR.rotation.x = -1.6 + cos(f) * 0.8;
      b.armL.rotation.z = -0.9;
      b.armR.rotation.z = 0.9;
      b.thighL.rotation.x = sin(t * 14) * 0.6;
      b.thighR.rotation.x = -sin(t * 14) * 0.6;
      b.shinL.rotation.x = 0.6;
      b.shinR.rotation.x = 0.6;
      break;
    }
    case 'celebrate':
    case 'cheer': {
      const hop = Math.abs(sin(t * 7));
      b.root.position.y += hop * (motion === 'celebrate' ? 0.18 : 0.06) * k;
      b.armL.rotation.x = -2.8 + sin(t * 14) * 0.25;
      b.armR.rotation.x = -2.8 - sin(t * 14) * 0.25;
      b.armL.rotation.z = -0.35;
      b.armR.rotation.z = 0.35;
      b.head.rotation.x = -0.25;
      b.thighL.rotation.x = -hop * 0.3;
      b.shinL.rotation.x = hop * 0.6;
      break;
    }
    case 'slump': {
      b.root.position.y -= 0.03 * k;
      b.spine.rotation.x = 0.35;
      b.head.rotation.x = 0.6;
      b.armL.rotation.z = 0.08;
      b.armR.rotation.z = -0.08;
      b.armL.rotation.x = 0.15;
      b.armR.rotation.x = 0.15;
      break;
    }
    case 'camera': {
      const flash = (t % 3.5) < 0.6;
      b.armR.rotation.x = -1.35;
      b.armL.rotation.x = -1.35;
      b.foreR.rotation.x = -1.35;
      b.foreL.rotation.x = -1.3;
      b.armR.rotation.z = 0.3;
      b.armL.rotation.z = -0.55;
      b.foreL.rotation.z = 0.9;
      b.head.rotation.x = flash ? -0.05 : 0.05;
      b.spine.rotation.y = sin(t * 0.6) * 0.1;
      break;
    }
    case 'map': {
      b.armR.rotation.x = -0.7;
      b.foreR.rotation.x = -0.9;
      b.armR.rotation.z = 0.1;
      b.armL.rotation.x = -0.7;
      b.foreL.rotation.x = -0.9;
      b.armL.rotation.z = -0.25;
      b.foreL.rotation.z = 0.35;
      b.head.rotation.x = 0.4;
      b.head.rotation.y = sin(t * 0.8) * 0.35;
      b.spine.rotation.y = sin(t * 0.4) * 0.15;
      break;
    }
    case 'ride': {
      b.root.position.y = 1.0 * k;
      b.spine.rotation.x = 0.35;
      b.head.rotation.x = -0.25;
      b.thighL.rotation.x = -1.35 + sin(t) * 0.35;
      b.thighR.rotation.x = -1.35 - sin(t) * 0.35;
      b.shinL.rotation.x = 1.4 + sin(t) * 0.3;
      b.shinR.rotation.x = 1.4 - sin(t) * 0.3;
      b.armL.rotation.x = -1.2;
      b.armR.rotation.x = -1.2;
      b.armL.rotation.z = -0.25;
      b.armR.rotation.z = 0.25;
      b.foreL.rotation.x = -0.35;
      b.foreR.rotation.x = -0.35;
      break;
    }
    case 'vendor': {
      b.armR.rotation.x = -0.6 + sin(t * 2.2) * 0.5;
      b.foreR.rotation.x = -1.0;
      b.armL.rotation.x = -0.4;
      b.foreL.rotation.x = -1.1;
      b.head.rotation.y = sin(t * 0.9) * 0.4;
      break;
    }
    case 'tumble': {
      const f = t * 20;
      b.armL.rotation.x = -2.5 + sin(f) * 0.9;
      b.armR.rotation.x = -2.0 + cos(f) * 0.9;
      b.armL.rotation.z = -1.1;
      b.armR.rotation.z = 1.1;
      b.thighL.rotation.x = -0.9 + sin(f * 0.8) * 0.5;
      b.thighR.rotation.x = 0.4 + cos(f * 0.8) * 0.5;
      b.shinL.rotation.x = 1.0;
      break;
    }
    default: {
      const br = sin(t * 1.6);
      b.spine.rotation.x = br * 0.02;
      b.head.rotation.y = sin(t * 0.5) * 0.25;
      b.armL.rotation.z = -0.06;
      b.armR.rotation.z = 0.06;
    }
  }
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- wardrobe

export const SKINS = ['#f1c7a5', '#e8b993', '#d9a07a', '#c68863', '#a96d4c', '#7a4a32', '#5c3a26'];
export const HAIRS = ['#1b1410', '#2a1c14', '#3d2a1c', '#6b4a2e', '#a07445', '#c9a36a', '#cfcfcf', '#8a2f1f'];
const COATS = ['#2d3e50', '#7a2e2e', '#3c5b3a', '#6d5a7a', '#c88b2e', '#1f1f24', '#b24a2a', '#4f6d8f', '#a4a19a', '#8a6f4d'];
const PANTS = ['#2a2f3a', '#3a4b6b', '#4b4036', '#1d1d20', '#56606e', '#6b5a48'];
const SHOES = ['#222', '#f2f2f2', '#6b4a2e', '#7a1f24', '#1e3b7a'];
const BRIGHT = ['#f2f2f2', '#ffd23f', '#ff6b6b', '#5fb3f9', '#7bd389', '#f7a6c9'];

/** A random New Yorker (or visitor) from a 0..1 variant number. */
export function randomLook(variant: number, kind: 'local' | 'tourist' | 'courier' | 'vendor' | 'walker'): PersonLook {
  let s = Math.floor(variant * 2 ** 31) | 0;
  const r = () => ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) | 0) >>> 0) / 4294967296;
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const styles: HairStyle[] = ['short', 'short', 'long', 'bun', 'curly', 'bald'];
  const base: PersonLook = {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: pick(styles),
    top: pick(COATS),
    topStyle: pick(['coat', 'jacket', 'hoodie'] as const),
    pants: pick(PANTS),
    shoes: pick(SHOES),
    height: 1.62 + r() * 0.24,
    glasses: r() < 0.2,
  };
  if (kind === 'tourist') {
    return { ...base, top: pick(BRIGHT), topStyle: 'tee', chest: '#c62828', cap: r() < 0.5 ? pick(['#c62828', '#1e3b7a', '#f2f2f2']) : undefined, backpack: r() < 0.45 ? pick(['#e0572a', '#2a6e9e', '#3d3d3d']) : undefined };
  }
  if (kind === 'courier') {
    return { ...base, top: pick(['#1f1f24', '#2d3e50', '#3a3a3a']), topStyle: 'jacket', deliveryBox: pick(['#d62828', '#2a9d8f', '#f4a261', '#ffbf00', '#e63946']), cap: undefined, hairStyle: 'short' };
  }
  if (kind === 'vendor') return { ...base, apron: true, topStyle: 'tee', top: '#d9d4c7', cap: '#1e3b7a' };
  if (kind === 'walker') return { ...base, topStyle: 'coat', top: pick(['#3f5e4c', '#8a6f4d', '#2d3e50']) };
  return base;
}
