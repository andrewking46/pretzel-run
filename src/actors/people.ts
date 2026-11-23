import { Bone, BufferAttribute, Group, MeshStandardMaterial, Skeleton, SkinnedMesh, SphereGeometry, type BufferGeometry } from 'three';
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
  sharedMaterial ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.58 });
  return sharedMaterial;
}

// joint positions in the bind pose
const HIP_Y = 0.9;
const SHOULDER = [0.25, 0.47] as const;

export function buildPerson(look: PersonLook): Person {
  const hs = look.headScale ?? 1;
  const parts: Record<BoneName, MeshBuilder> = Object.fromEntries(BONES.map(b => [b, new MeshBuilder()])) as Record<BoneName, MeshBuilder>;
  const { skin, top, pants, shoes } = look;
  const shoulderY = HIP_Y + SHOULDER[1] + 0.05;

  // Soft vinyl-toy proportions: capsule limbs, rounded torso, a round head with a face.
  const sleeveColor = look.topStyle === 'tee' ? skin : top;
  const coat = look.topStyle === 'coat';
  const suit = look.topStyle === 'suit';
  const shirt = look.shirt ?? '#f4f6fa';

  // hips and torso
  parts.root.rounded(0.34, 0.22, 0.24, 0.09, pants, { y: HIP_Y + 0.02 });
  // a pill-shaped torso: rounds into the shoulders instead of ending in a box edge
  parts.spine.capsule(0.15, 0.26, top, { y: HIP_Y + 0.31, sx: 1.36, sz: 0.88 }, 6, 16);
  for (const sx of [-1, 1]) parts.spine.sphere(0.075, top, { x: sx * 0.2, y: HIP_Y + 0.47 }, 14, 10);
  parts.spine.cylinder(0.055, 0.06, 0.12, skin, { y: HIP_Y + 0.6 }, 12);
  if (coat) parts.spine.rounded(0.44, 0.4, 0.29, 0.12, top, { y: HIP_Y - 0.02 });
  if (look.topStyle === 'hoodie') {
    parts.spine.rounded(0.32, 0.2, 0.14, 0.07, shade(top, 0.85), { y: HIP_Y + 0.55, z: -0.15 });
    parts.spine.rounded(0.24, 0.12, 0.03, 0.02, shade(top, 0.88), { y: HIP_Y + 0.16, z: 0.13 });
    for (const sx of [-1, 1]) parts.spine.capsule(0.012, 0.12, '#e8e4dc', { x: sx * 0.05, y: HIP_Y + 0.42, z: 0.135 }, 2, 6);
  }
  if (look.topStyle === 'jacket') parts.spine.rounded(0.05, 0.5, 0.02, 0.01, shade(top, 0.7), { y: HIP_Y + 0.3, z: 0.13 });
  if (look.topStyle === 'tee') parts.spine.cylinder(0.075, 0.08, 0.04, shade(top, 0.9), { y: HIP_Y + 0.56 }, 14);
  if (suit) {
    // jacket hem over the hips, white collar, shirt-and-tie V, lapels, buttons, pocket square
    parts.spine.capsule(0.13, 0.12, top, { y: HIP_Y + 0.05, sx: 1.55, sz: 1.0 }, 4, 16);
    parts.spine.rounded(0.012, 0.14, 0.01, 0.004, shade(top, 0.6), { y: HIP_Y + 0.0, z: -0.132 });
    parts.spine.rounded(0.14, 0.24, 0.02, 0.008, shirt, { y: HIP_Y + 0.44, z: 0.118 });
    parts.spine.cylinder(0.068, 0.072, 0.05, shirt, { y: HIP_Y + 0.585 }, 14);
    const tie = look.tie ?? '#a3242f';
    parts.spine.rounded(0.055, 0.3, 0.018, 0.008, tie, { y: HIP_Y + 0.36, z: 0.134 });
    parts.spine.rounded(0.07, 0.05, 0.025, 0.012, shade(tie, 0.85), { y: HIP_Y + 0.53, z: 0.135 });
    for (const sx of [-1, 1]) parts.spine.rounded(0.06, 0.3, 0.012, 0.006, shade(top, 1.12), { x: sx * 0.082, y: HIP_Y + 0.42, z: 0.128, rz: sx * 0.3 });
    parts.spine.rounded(0.05, 0.035, 0.012, 0.006, '#ece6d6', { x: -0.13, y: HIP_Y + 0.44, z: 0.134 });
    for (const y of [0.24, 0.12]) parts.spine.sphere(0.014, shade(top, 0.5), { x: 0.038, y: HIP_Y + y, z: 0.132 }, 8, 6);
  }
  if (look.chest) parts.spine.rounded(0.22, 0.12, 0.02, 0.01, look.chest, { y: HIP_Y + 0.36, z: 0.128 });
  if (look.apron) parts.spine.rounded(0.34, 0.56, 0.02, 0.01, '#f2f2f2', { y: HIP_Y + 0.14, z: 0.135 });
  if (look.backpack) {
    parts.spine.rounded(0.32, 0.42, 0.17, 0.07, look.backpack, { y: HIP_Y + 0.32, z: -0.2 });
    parts.spine.rounded(0.24, 0.14, 0.05, 0.03, shade(look.backpack, 0.8), { y: HIP_Y + 0.2, z: -0.29 });
  }
  if (look.deliveryBox) {
    parts.spine.rounded(0.56, 0.5, 0.42, 0.05, look.deliveryBox, { y: HIP_Y + 0.5, z: -0.36 });
    parts.spine.rounded(0.5, 0.05, 0.36, 0.02, shade(look.deliveryBox, 1.25), { y: HIP_Y + 0.75, z: -0.36 });
  }

  // head and face
  const r = 0.15 * hs;
  const headY = shoulderY + 0.06 + r;
  parts.head.sphere(r, skin, { y: headY, sx: 0.96, sy: 1.04 }, 22, 16);
  parts.head.sphere(r * 0.12, shade(skin, 0.95), { y: headY - r * 0.1, z: r * 0.97, sy: 1.2 }, 10, 8);
  for (const sx of [-1, 1]) {
    parts.head.sphere(r * 0.16, skin, { x: sx * r * 0.95, y: headY - r * 0.05, sx: 0.5 }, 10, 8);
    parts.head.sphere(r * 0.13, look.eyes ?? '#1d1a18', { x: sx * r * 0.36, y: headY + r * 0.14, z: r * 0.86, sz: 0.5, sy: 1.25 }, 10, 8);
    parts.head.sphere(r * 0.045, '#ffffff', { x: sx * r * 0.36 + r * 0.04, y: headY + r * 0.22, z: r * 0.93 }, 6, 4);
    parts.head.capsule(r * 0.035, r * 0.2, look.hairStyle === 'bald' ? shade(skin, 0.7) : look.hair, { x: sx * r * 0.38, y: headY + r * 0.42, z: r * 0.86, rz: Math.PI / 2 + sx * 0.12 }, 2, 6);
  }
  parts.head.capsule(r * 0.04, r * 0.22, '#9a4e44', { y: headY - r * 0.42, z: r * 0.9, rz: Math.PI / 2 }, 2, 6);
  if (look.glasses) {
    for (const sx of [-1, 1]) parts.head.rounded(r * 0.5, r * 0.36, 0.015, 0.01, '#141414', { x: sx * r * 0.36, y: headY + r * 0.14, z: r * 0.98 });
    parts.head.rounded(r * 0.24, 0.012, 0.012, 0.004, '#141414', { y: headY + r * 0.2, z: r * 1.0 });
  }
  const hairCap = (tilt: number, coverage: number, grow = 1.07) =>
    parts.head.add(new SphereGeometry(r * grow, 22, 12, 0, Math.PI * 2, 0, coverage), look.hair, { y: headY + r * 0.02, rx: -tilt });
  switch (look.hairStyle) {
    case 'bald':
      break;
    case 'long':
      hairCap(0.35, 1.7);
      parts.head.rounded(r * 1.9, r * 1.9, r * 0.7, r * 0.3, look.hair, { y: headY - r * 0.55, z: -r * 0.55 });
      break;
    case 'bun':
      hairCap(0.3, 1.6);
      parts.head.sphere(r * 0.45, look.hair, { y: headY + r * 0.95, z: -r * 0.45 }, 12, 10);
      break;
    case 'curly':
      for (const [x, y, z] of [[0, 0.8, 0], [-0.55, 0.55, -0.2], [0.55, 0.55, -0.2], [0, 0.4, -0.65], [-0.45, 0.8, -0.35], [0.45, 0.8, -0.35], [-0.3, 0.75, 0.35], [0.3, 0.75, 0.35], [0, 0.0, -0.8]]) {
        parts.head.blob(r * 0.5, look.hair, { x: x * r, y: headY + y * r, z: z * r }, 1);
      }
      break;
    default:
      // short and neat with a side part: a cap of hair tilted back and a soft swoop over the forehead
      hairCap(0.42, 1.5);
      parts.head.sphere(r * 0.58, look.hair, { x: r * 0.1, y: headY + r * 0.62, z: r * 0.48, sx: 1.12, sy: 0.48, sz: 0.85, rz: -0.18 }, 16, 10);
  }
  if (look.cap) {
    parts.head.add(new SphereGeometry(r * 1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), look.cap, { y: headY + r * 0.2 });
    parts.head.rounded(r * 1.5, 0.03, r * 0.9, 0.012, look.cap, { y: headY + r * 0.22, z: r * 1.05 });
  }

  // arms (hang from the shoulders; forearms hold props)
  for (const [side, arm, fore] of [[-1, 'armL', 'foreL'], [1, 'armR', 'foreR']] as const) {
    const x = side * SHOULDER[0];
    const sy = HIP_Y + SHOULDER[1];
    parts[arm].capsule(0.062, 0.22, top, { x, y: sy - 0.15 }, 4, 12);
    parts[fore].capsule(0.056, 0.2, sleeveColor, { x, y: sy - 0.42 }, 4, 12);
    if (suit) parts[fore].cylinder(0.052, 0.052, 0.035, shirt, { x, y: sy - 0.535 }, 12);
    parts[fore].sphere(0.058, skin, { x, y: sy - 0.6, sy: 1.1 }, 12, 10);
  }
  const handY = HIP_Y + SHOULDER[1] - 0.62;
  if (look.phone) {
    parts.foreR.rounded(0.08, 0.15, 0.02, 0.012, '#111', { x: SHOULDER[0], y: handY + 0.05, z: 0.07 });
    parts.foreR.rounded(0.066, 0.13, 0.004, 0.008, '#8fd3ff', { x: SHOULDER[0], y: handY + 0.05, z: 0.081 });
  }
  if (look.camera) {
    parts.foreR.rounded(0.2, 0.13, 0.1, 0.03, '#1a1a1a', { x: SHOULDER[0] - 0.08, y: handY + 0.04, z: 0.06 });
    parts.foreR.cylinder(0.045, 0.045, 0.09, '#445', { x: SHOULDER[0] - 0.08, y: handY + 0.04, z: 0.13, rx: Math.PI / 2 });
  }
  if (look.map) {
    parts.foreR.rounded(0.46, 0.02, 0.32, 0.008, '#f4f1e1', { x: SHOULDER[0] - 0.23, y: handY + 0.02, z: 0.12 });
    parts.foreR.box(0.14, 0.024, 0.1, '#8fb3d9', { x: SHOULDER[0] - 0.33, y: handY + 0.022, z: 0.08 });
    parts.foreR.box(0.12, 0.024, 0.08, '#e07a5f', { x: SHOULDER[0] - 0.12, y: handY + 0.022, z: 0.16 });
  }

  // legs
  for (const [side, thigh, shin] of [[-1, 'thighL', 'shinL'], [1, 'thighR', 'shinR']] as const) {
    const x = side * 0.1;
    parts[thigh].capsule(0.08, 0.3, coat ? shade(top, 0.95) : pants, { x, y: HIP_Y - 0.22 }, 4, 12);
    parts[shin].capsule(0.068, 0.3, pants, { x, y: HIP_Y - 0.63 }, 4, 12);
    if (look.dressShoes) {
      // polished oxfords: low, long, slightly pointed, thin dark sole
      parts[shin].rounded(0.115, 0.08, 0.28, 0.04, shoes, { x, y: 0.052, z: 0.055 });
      parts[shin].rounded(0.112, 0.016, 0.275, 0.006, '#1a120c', { x, y: 0.01, z: 0.055 });
    } else {
      parts[shin].rounded(0.135, 0.1, 0.27, 0.05, shoes, { x, y: 0.055, z: 0.05 });
      parts[shin].rounded(0.14, 0.035, 0.28, 0.015, shoes === '#f2f2f2' || shoes === '#f4f4f4' ? '#d9d9d9' : '#f2f2f2', { x, y: 0.018, z: 0.05 });
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
    headScale: 1.12,
    eyes: pick(['#3a2616', '#1d1a18', '#3f5a6e', '#4b5a2e']),
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
