import { Bone, CapsuleGeometry, ConeGeometry, Group, Skeleton, SkinnedMesh, SphereGeometry, TorusGeometry, type BufferGeometry } from 'three';
import { personMaterial, shade } from './people.ts';
import { rigid, SkinBuilder } from './rig.ts';
import { castsShadow } from '../world/materials.ts';

// A small skinned dog (one draw call) that trots: diagonal legs in step, a bobbing head and a wagging tail.

const BONES = ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR', 'tail'] as const;
type DogBone = (typeof BONES)[number];

export interface Dog {
  object: Group;
  mesh: SkinnedMesh;
  bones: Record<DogBone, Bone>;
  size: number;
}

const COATS = [
  { coat: '#c8964f', belly: '#ecd3a8', ears: 'floppy' },
  { coat: '#2b2b2b', belly: '#5a5048', ears: 'pointy' },
  { coat: '#f2efe8', belly: '#ffffff', ears: 'floppy' },
  { coat: '#8a5a3c', belly: '#d9b48c', ears: 'floppy' },
  { coat: '#d9c3a0', belly: '#f4e6cc', ears: 'pointy' },
] as const;

const geometryCache = new Map<number, BufferGeometry>();

function dogGeometry(kind: number): BufferGeometry {
  const cached = geometryCache.get(kind);
  if (cached) return cached;
  const { coat, belly, ears } = COATS[kind];
  const [BODY, HEAD, FL, FR, BL, BR, TAIL] = BONES.map((_, i) => i);
  const b = new SkinBuilder();
  b.add(new CapsuleGeometry(0.11, 0.26, 6, 16), p => (p.y < 0.28 ? belly : coat), rigid(BODY), { y: 0.32, rx: Math.PI / 2, sx: 0.92 });
  b.add(new SphereGeometry(0.115, 14, 10), belly, rigid(BODY), { y: 0.33, z: 0.15, sy: 1.05 });
  b.add(new TorusGeometry(0.075, 0.016, 8, 18), '#d33', rigid(HEAD), { y: 0.43, z: 0.22, rx: Math.PI / 2 + 0.5 });
  // head
  b.add(new SphereGeometry(0.1, 16, 12), coat, rigid(HEAD), { y: 0.49, z: 0.27 });
  b.add(new CapsuleGeometry(0.048, 0.06, 4, 10), belly, rigid(HEAD), { y: 0.46, z: 0.355, rx: Math.PI / 2 });
  b.add(new SphereGeometry(0.024, 8, 6), '#111', rigid(HEAD), { y: 0.475, z: 0.41 });
  b.add(new SphereGeometry(0.018, 8, 6), '#e8737d', rigid(HEAD), { y: 0.43, z: 0.38, sx: 1.2, sz: 0.6 });
  for (const s of [-1, 1]) {
    b.add(new SphereGeometry(0.016, 8, 6), '#111', rigid(HEAD), { x: s * 0.045, y: 0.515, z: 0.345 });
    if (ears === 'floppy') b.add(new SphereGeometry(0.05, 10, 8), shade(coat, 0.75), rigid(HEAD), { x: s * 0.088, y: 0.49, z: 0.25, sx: 0.4, sy: 1.3, rz: s * 0.35 });
    else b.add(new ConeGeometry(0.035, 0.08, 8), shade(coat, 0.85), rigid(HEAD), { x: s * 0.055, y: 0.585, z: 0.26, rz: -s * 0.25 });
  }
  // legs and paws
  for (const [bone, x, z] of [[FL, -0.065, 0.15], [FR, 0.065, 0.15], [BL, -0.065, -0.15], [BR, 0.065, -0.15]] as const) {
    b.add(new CapsuleGeometry(0.034, 0.17, 4, 10), coat, rigid(bone), { x, y: 0.14, z });
    b.add(new SphereGeometry(0.038, 10, 8), belly, rigid(bone), { x, y: 0.03, z: z + 0.012, sy: 0.7 });
  }
  b.add(new CapsuleGeometry(0.024, 0.15, 4, 8), coat, rigid(TAIL), { y: 0.43, z: -0.24, rx: -0.7 });
  const g = b.build();
  geometryCache.set(kind, g);
  return g;
}

export function buildDog(variant: number): Dog {
  const kind = Math.floor(variant * COATS.length) % COATS.length;
  const size = 0.8 + (Math.floor(variant * 97) % 5) * 0.1;
  const bones = Object.fromEntries(BONES.map(n => [n, new Bone()])) as Record<DogBone, Bone>;
  bones.body.position.set(0, 0.32, 0);
  bones.head.position.set(0, 0.1, 0.2);
  bones.legFL.position.set(-0.065, -0.08, 0.15);
  bones.legFR.position.set(0.065, -0.08, 0.15);
  bones.legBL.position.set(-0.065, -0.08, -0.15);
  bones.legBR.position.set(0.065, -0.08, -0.15);
  bones.tail.position.set(0, 0.08, -0.2);
  bones.body.add(bones.head, bones.legFL, bones.legFR, bones.legBL, bones.legBR, bones.tail);
  const mesh = new SkinnedMesh(dogGeometry(kind), personMaterial());
  mesh.add(bones.body);
  mesh.bind(new Skeleton(BONES.map(n => bones[n])));
  castsShadow(mesh);
  mesh.frustumCulled = false;
  const object = new Group();
  object.add(mesh);
  object.scale.setScalar(size);
  return { object, mesh, bones, size };
}

export function trot(dog: Dog, t: number, moving: boolean): void {
  const b = dog.bones;
  const f = moving ? t * 13 : t * 2;
  const swing = moving ? 0.6 : 0.05;
  const s = Math.sin(f);
  b.legFL.rotation.x = s * swing;
  b.legBR.rotation.x = s * swing;
  b.legFR.rotation.x = -s * swing;
  b.legBL.rotation.x = -s * swing;
  b.body.position.y = 0.32 + Math.abs(Math.cos(f)) * (moving ? 0.025 : 0.005);
  b.head.rotation.x = Math.sin(f * 2) * 0.06;
  b.head.rotation.y = Math.sin(t * 1.3) * 0.2;
  b.tail.rotation.z = Math.sin(t * 15) * 0.55;
}

export function disposeDog(dog: Dog): void {
  dog.mesh.skeleton.dispose();
}
