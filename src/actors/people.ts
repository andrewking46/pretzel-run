import { Bone, BoxGeometry, CapsuleGeometry, CylinderGeometry, Group, IcosahedronGeometry, MeshStandardMaterial, Skeleton, SkinnedMesh, SphereGeometry, TorusGeometry } from 'three';
import { hinge, lathe, rigid, roundedBox, SkinBuilder } from './rig.ts';
import { castsShadow } from '../world/materials.ts';

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
  const { skin, top, pants, shoes } = look;
  const b = new SkinBuilder();
  const [ROOT, SPINE, HEAD, ARM_L, FORE_L, ARM_R, FORE_R, THIGH_L, SHIN_L, THIGH_R, SHIN_R] = BONES.map((_, i) => i);
  const style = look.topStyle;
  const suit = style === 'suit';
  const coat = style === 'coat';
  const shirt = look.shirt ?? '#f4f6fa';
  const sleeve = style === 'tee' ? skin : top;
  const shoulderY = HIP_Y + SHOULDER[1];
  const elbowY = shoulderY - 0.29;
  const handY = shoulderY - 0.6;
  const kneeY = HIP_Y - 0.45;
  // where the top stops and the trousers start
  const hem = suit || coat ? HIP_Y - 0.06 : HIP_Y + 0.07;
  const belt = !suit && !coat;

  // Torso: one sculpted shape from the seat to the neck (hips, waist, chest, shoulders), bending at the waist.
  const torso = lathe([
    [HIP_Y - 0.1, 0], [HIP_Y - 0.09, 0.09], [HIP_Y - 0.06, 0.16], [HIP_Y, 0.178], [HIP_Y + 0.08, 0.168], [HIP_Y + 0.15, 0.158],
    [HIP_Y + 0.25, 0.17], [HIP_Y + 0.35, 0.188], [HIP_Y + 0.43, 0.2], [HIP_Y + 0.48, 0.19], [HIP_Y + 0.52, 0.15], [HIP_Y + 0.55, 0.09], [HIP_Y + 0.56, 0],
  ], 24);
  b.add(torso, p => (belt && Math.abs(p.y - hem) < 0.018 ? '#2a2420' : p.y > hem ? top : pants), hinge(SPINE, ROOT, HIP_Y + 0.1, 0.07), { sx: 1.12, sz: 0.7 });
  for (const sx of [-1, 1]) b.add(new SphereGeometry(0.068, 16, 12), top, rigid(SPINE), { x: sx * 0.205, y: shoulderY - 0.05, sy: 0.9 });
  b.add(lathe([[shoulderY + 0.02, 0.064], [shoulderY + 0.1, 0.058], [shoulderY + 0.16, 0.05], [shoulderY + 0.18, 0]], 14), skin, hinge(HEAD, SPINE, shoulderY + 0.08, 0.04));
  if (coat) {
    // a coat skirt that flares over the thighs
    b.add(lathe([[HIP_Y - 0.36, 0.235], [HIP_Y - 0.2, 0.215], [HIP_Y - 0.05, 0.195], [HIP_Y + 0.08, 0.18]], 22), shade(top, 0.95), rigid(ROOT), { sx: 1.12, sz: 0.85 });
  }

  // Legs: thigh, knee and calf in one shape, handing over from thigh to shin bone at the knee.
  for (const [side, thigh, shin] of [[-1, THIGH_L, SHIN_L], [1, THIGH_R, SHIN_R]] as const) {
    const x = side * 0.1;
    const leg = lathe([
      [0.07, 0], [0.075, 0.04], [0.12, 0.046], [0.22, 0.056], [0.3, 0.064], [0.38, 0.058], [kneeY, 0.055], [0.52, 0.064],
      [0.62, 0.074], [0.74, 0.083], [0.84, 0.088], [0.9, 0.074], [0.93, 0],
    ], 16);
    b.add(leg, pants, hinge(thigh, shin, kneeY, 0.06), { x });
    if (look.dressShoes) {
      // polished oxfords: low, long, slightly pointed, thin dark sole
      b.add(roundedBox(0.115, 0.08, 0.28, 3, 0.038), shoes, rigid(shin), { x, y: 0.052, z: 0.055 });
      b.add(roundedBox(0.112, 0.016, 0.275, 2, 0.006), '#1a120c', rigid(shin), { x, y: 0.01, z: 0.055 });
    } else {
      b.add(roundedBox(0.13, 0.09, 0.27, 3, 0.045), shoes, rigid(shin), { x, y: 0.055, z: 0.05 });
      b.add(roundedBox(0.136, 0.032, 0.28, 2, 0.014), shoes === '#f2f2f2' || shoes === '#f4f4f4' ? '#d6d6d6' : '#f2f2f2', rigid(shin), { x, y: 0.017, z: 0.05 });
    }
  }

  // Arms: shoulder to wrist in one shape bending at the elbow, with mitten hands.
  for (const [side, arm, fore] of [[-1, ARM_L, FORE_L], [1, ARM_R, FORE_R]] as const) {
    const x = side * SHOULDER[0];
    const limb = lathe([
      [handY + 0.045, 0], [handY + 0.05, 0.04], [handY + 0.09, 0.045], [elbowY - 0.12, 0.048], [elbowY, 0.05], [elbowY + 0.06, 0.054],
      [elbowY + 0.16, 0.06], [shoulderY - 0.05, 0.064], [shoulderY + 0.01, 0.06], [shoulderY + 0.04, 0.035], [shoulderY + 0.05, 0],
    ], 14);
    b.add(limb, p => (style === 'tee' && p.y < shoulderY - 0.15 ? (p.y > shoulderY - 0.18 ? shade(top, 0.9) : skin) : suit && p.y < handY + 0.08 ? shirt : sleeve), hinge(arm, fore, elbowY, 0.05), { x });
    b.add(new SphereGeometry(0.05, 14, 10), skin, rigid(fore), { x, y: handY, sx: 0.85, sy: 1.15, sz: 0.65 });
    b.add(new SphereGeometry(0.022, 8, 6), skin, rigid(fore), { x: x - side * 0.03, y: handY + 0.025, z: 0.03 });
  }

  // Clothing details on the chest (the torso front sits at z ≈ 0.14 at chest height)
  const front = (y: number) => 0.7 * (y > HIP_Y + 0.3 ? 0.195 : 0.165);
  if (style === 'hoodie') {
    b.add(roundedBox(0.3, 0.2, 0.14, 3, 0.06), shade(top, 0.85), rigid(SPINE), { y: shoulderY + 0.06, z: -0.12 });
    b.add(roundedBox(0.24, 0.12, 0.03, 2, 0.015), shade(top, 0.88), rigid(SPINE), { y: HIP_Y + 0.16, z: front(HIP_Y + 0.16) });
    for (const sx of [-1, 1]) b.add(new CapsuleGeometry(0.01, 0.12, 2, 6), '#e8e4dc', rigid(SPINE), { x: sx * 0.05, y: HIP_Y + 0.4, z: front(HIP_Y + 0.4) + 0.008 });
  }
  if (style === 'jacket') b.add(roundedBox(0.03, 0.5, 0.02, 2, 0.008), shade(top, 0.65), rigid(SPINE), { y: HIP_Y + 0.28, z: front(HIP_Y + 0.35) - 0.004 });
  if (style === 'tee') b.add(lathe([[shoulderY + 0.02, 0.07], [shoulderY + 0.05, 0.068]], 16), shade(top, 0.9), rigid(SPINE));
  if (suit) {
    const tie = look.tie ?? '#a3242f';
    b.add(roundedBox(0.13, 0.2, 0.02, 2, 0.008), shirt, rigid(SPINE), { y: shoulderY - 0.08, z: 0.13, rx: -0.12 });
    b.add(lathe([[shoulderY + 0.02, 0.072], [shoulderY + 0.07, 0.068]], 16), shirt, rigid(SPINE));
    b.add(roundedBox(0.05, 0.27, 0.016, 2, 0.007), tie, rigid(SPINE), { y: shoulderY - 0.15, z: 0.142, rx: -0.1 });
    b.add(roundedBox(0.065, 0.045, 0.026, 2, 0.011), shade(tie, 0.85), rigid(SPINE), { y: shoulderY + 0.005, z: 0.13 });
    for (const sx of [-1, 1]) b.add(roundedBox(0.06, 0.28, 0.014, 2, 0.006), shade(top, 1.15), rigid(SPINE), { x: sx * 0.08, y: shoulderY - 0.1, z: 0.135, rz: sx * 0.3, rx: -0.1 });
    b.add(roundedBox(0.05, 0.03, 0.012, 2, 0.005), '#ece6d6', rigid(SPINE), { x: -0.125, y: shoulderY - 0.07, z: 0.138 });
    for (const y of [HIP_Y + 0.22, HIP_Y + 0.11]) b.add(new SphereGeometry(0.013, 8, 6), shade(top, 0.5), rigid(SPINE), { x: 0.03, y, z: front(y) + 0.002 });
    b.add(roundedBox(0.012, 0.12, 0.01, 1, 0.004), shade(top, 0.6), rigid(ROOT), { y: HIP_Y - 0.0, z: -0.128 });
  }
  if (look.chest) b.add(roundedBox(0.2, 0.11, 0.02, 2, 0.008), look.chest, rigid(SPINE), { y: HIP_Y + 0.34, z: front(HIP_Y + 0.34) });
  if (look.apron) b.add(roundedBox(0.32, 0.55, 0.02, 2, 0.008), '#f2f2f2', rigid(SPINE), { y: HIP_Y + 0.12, z: 0.125 });
  if (look.backpack) {
    b.add(roundedBox(0.3, 0.4, 0.16, 3, 0.06), look.backpack, rigid(SPINE), { y: HIP_Y + 0.3, z: -0.19 });
    b.add(roundedBox(0.22, 0.13, 0.05, 2, 0.025), shade(look.backpack, 0.8), rigid(SPINE), { y: HIP_Y + 0.18, z: -0.28 });
    for (const sx of [-1, 1]) b.add(roundedBox(0.035, 0.36, 0.02, 1, 0.008), shade(look.backpack, 0.7), rigid(SPINE), { x: sx * 0.1, y: HIP_Y + 0.34, z: 0.13 });
  }
  if (look.deliveryBox) {
    b.add(roundedBox(0.56, 0.5, 0.42, 3, 0.05), look.deliveryBox, rigid(SPINE), { y: HIP_Y + 0.5, z: -0.36 });
    b.add(roundedBox(0.5, 0.05, 0.36, 2, 0.02), shade(look.deliveryBox, 1.25), rigid(SPINE), { y: HIP_Y + 0.75, z: -0.36 });
  }

  // Head and face
  const r = 0.15 * hs;
  const headY = shoulderY + 0.11 + r;
  const H = rigid(HEAD);
  b.add(new SphereGeometry(r, 28, 20), skin, H, { y: headY, sx: 0.95, sy: 1.04 });
  b.add(new SphereGeometry(r * 0.66, 18, 12), skin, H, { y: headY - r * 0.42, z: r * 0.18, sx: 1.05, sy: 0.75 });
  b.add(new SphereGeometry(r * 0.11, 10, 8), shade(skin, 0.94), H, { y: headY - r * 0.12, z: r * 0.96, sy: 1.25 });
  for (const sx of [-1, 1]) {
    b.add(new SphereGeometry(r * 0.16, 10, 8), skin, H, { x: sx * r * 0.93, y: headY - r * 0.05, sx: 0.5 });
    b.add(new SphereGeometry(r * 0.17, 12, 10), '#fbf8f4', H, { x: sx * r * 0.36, y: headY + r * 0.13, z: r * 0.82, sz: 0.45, sy: 1.15 });
    b.add(new SphereGeometry(r * 0.11, 12, 10), look.eyes ?? '#1d1a18', H, { x: sx * r * 0.36, y: headY + r * 0.12, z: r * 0.9, sz: 0.45, sy: 1.2 });
    b.add(new SphereGeometry(r * 0.04, 6, 4), '#ffffff', H, { x: sx * r * 0.36 + r * 0.04, y: headY + r * 0.19, z: r * 0.96 });
    b.add(new CapsuleGeometry(r * 0.035, r * 0.2, 2, 6), look.hairStyle === 'bald' ? shade(skin, 0.7) : look.hair, H, { x: sx * r * 0.38, y: headY + r * 0.42, z: r * 0.86, rz: Math.PI / 2 + sx * 0.12 });
  }
  // a small smile
  b.add(new TorusGeometry(r * 0.16, r * 0.03, 6, 12, Math.PI), '#9a4c42', H, { y: headY - r * 0.3, z: r * 0.92, rz: Math.PI, rx: -0.25 });
  if (look.glasses) {
    for (const sx of [-1, 1]) b.add(roundedBox(r * 0.52, r * 0.38, 0.012, 2, 0.008), '#141414', H, { x: sx * r * 0.36, y: headY + r * 0.13, z: r * 0.99 });
    b.add(roundedBox(r * 0.24, 0.012, 0.012, 1, 0.004), '#141414', H, { y: headY + r * 0.2, z: r * 1.0 });
  }
  const hairCap = (tilt: number, coverage: number, grow = 1.07) =>
    b.add(new SphereGeometry(r * grow, 26, 14, 0, Math.PI * 2, 0, coverage), look.hair, H, { y: headY + r * 0.02, rx: -tilt });
  switch (look.hairStyle) {
    case 'bald':
      break;
    case 'long':
      hairCap(0.35, 1.7);
      b.add(roundedBox(r * 1.9, r * 1.9, r * 0.7, 3, r * 0.3), look.hair, H, { y: headY - r * 0.55, z: -r * 0.55 });
      break;
    case 'bun':
      hairCap(0.3, 1.6);
      b.add(new SphereGeometry(r * 0.45, 14, 10), look.hair, H, { y: headY + r * 0.95, z: -r * 0.45 });
      break;
    case 'curly':
      for (const [x, y, z] of [[0, 0.8, 0], [-0.55, 0.55, -0.2], [0.55, 0.55, -0.2], [0, 0.4, -0.65], [-0.45, 0.8, -0.35], [0.45, 0.8, -0.35], [-0.3, 0.75, 0.35], [0.3, 0.75, 0.35], [0, 0.0, -0.8]]) {
        b.add(new IcosahedronGeometry(r * 0.5, 2), look.hair, H, { x: x * r, y: headY + y * r, z: z * r });
      }
      break;
    default:
      // short and neat with a side part: a cap of hair tilted back and a soft swoop over the forehead
      hairCap(0.42, 1.5);
      b.add(new SphereGeometry(r * 0.58, 18, 12), look.hair, H, { x: r * 0.1, y: headY + r * 0.62, z: r * 0.48, sx: 1.12, sy: 0.48, sz: 0.85, rz: -0.18 });
  }
  if (look.cap) {
    b.add(new SphereGeometry(r * 1.1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), look.cap, H, { y: headY + r * 0.2 });
    b.add(roundedBox(r * 1.5, 0.03, r * 0.9, 2, 0.012), look.cap, H, { y: headY + r * 0.22, z: r * 1.05 });
  }

  // things in hand
  const F = rigid(FORE_R);
  if (look.phone) {
    b.add(roundedBox(0.08, 0.15, 0.02, 2, 0.012), '#111', F, { x: SHOULDER[0], y: handY + 0.05, z: 0.07 });
    b.add(roundedBox(0.066, 0.13, 0.004, 2, 0.002), '#8fd3ff', F, { x: SHOULDER[0], y: handY + 0.05, z: 0.081 });
  }
  if (look.camera) {
    b.add(roundedBox(0.2, 0.13, 0.1, 3, 0.03), '#1a1a1a', F, { x: SHOULDER[0] - 0.08, y: handY + 0.04, z: 0.06 });
    b.add(new CylinderGeometry(0.045, 0.045, 0.09, 16), '#445', F, { x: SHOULDER[0] - 0.08, y: handY + 0.04, z: 0.13, rx: Math.PI / 2 });
  }
  if (look.map) {
    b.add(roundedBox(0.46, 0.02, 0.32, 2, 0.008), '#f4f1e1', F, { x: SHOULDER[0] - 0.23, y: handY + 0.02, z: 0.12 });
    b.add(new BoxGeometry(0.14, 0.024, 0.1), '#8fb3d9', F, { x: SHOULDER[0] - 0.33, y: handY + 0.022, z: 0.08 });
    b.add(new BoxGeometry(0.12, 0.024, 0.08), '#e07a5f', F, { x: SHOULDER[0] - 0.12, y: handY + 0.022, z: 0.16 });
  }

  const geometry = b.build();
  const k = (look.height ?? 1.75) / 1.75;
  if (k !== 1) geometry.scale(k, k, k);

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
  castsShadow(mesh);
  mesh.frustumCulled = false;
  const object = new Group();
  object.add(mesh);
  return { object, mesh, bones };
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
        // head down, both hands up in front of the chest, thumbs on the screen
        b.head.rotation.x = 0.55;
        b.spine.rotation.x = 0.1;
        b.armR.rotation.set(-0.35, 0, -0.42);
        b.foreR.rotation.set(-1.5, 0, 0);
        b.armL.rotation.set(-0.35, 0, 0.42);
        b.foreL.rotation.set(-1.45, 0, 0);
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
