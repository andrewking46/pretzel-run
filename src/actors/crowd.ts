import { buildPerson, pose, randomLook, type Person } from './people.ts';

// People are detailed enough that building one costs a few milliseconds (15+ on a slow phone), so a
// pool of them is built a slice at a time behind the title screen and reused all run long.

export type Role = 'phone' | 'camera' | 'map' | 'walker' | 'courier' | 'vendor' | 'stroller';

const STOCK: [Role, number][] = [
  ['phone', 6], ['camera', 5], ['map', 5], ['walker', 3], ['courier', 3], ['vendor', 2], ['stroller', 7],
];

function make(role: Role, variant: number): Person {
  switch (role) {
    case 'phone':
      return buildPerson({ ...randomLook(variant, 'local'), phone: true });
    case 'camera':
      return buildPerson({ ...randomLook(variant, 'tourist'), camera: true });
    case 'map':
      return buildPerson({ ...randomLook(variant, 'tourist'), map: true });
    case 'walker':
      return buildPerson(randomLook(variant, 'walker'));
    case 'courier':
      return buildPerson(randomLook(variant, 'courier'));
    case 'vendor':
      return buildPerson(randomLook(variant, 'vendor'));
    case 'stroller':
      return buildPerson(randomLook(variant, variant < 0.3 ? 'tourist' : 'local'));
  }
}

export class Crowd {
  private readonly free = new Map<Role, Person[]>();
  private readonly queue: Role[] = [];
  private made = 0;

  constructor() {
    for (const [role, n] of STOCK) for (let i = 0; i < n; i++) this.queue.push(role);
  }

  /** Build queued people for up to `budgetMs` this frame. */
  warm(budgetMs: number): void {
    const start = performance.now();
    while (this.queue.length && performance.now() - start < budgetMs) {
      const role = this.queue.shift()!;
      this.put(role, make(role, ((this.made++ * 0.6180339887) % 1)));
    }
  }

  /** Whether a ready-built person is waiting in this role (otherwise acquire builds one on the spot). */
  has(role: Role): boolean {
    return (this.free.get(role)?.length ?? 0) > 0;
  }

  acquire(role: Role, variant: number): Person {
    const list = this.free.get(role);
    const p = list?.length ? list.splice(Math.floor(variant * list.length) % list.length, 1)[0] : make(role, variant);
    p.object.visible = true;
    p.object.position.set(0, 0, 0);
    p.object.rotation.set(0, 0, 0);
    p.object.scale.setScalar(1);
    return p;
  }

  release(role: Role, p: Person): void {
    p.object.removeFromParent();
    pose(p, 'idle', 0);
    this.put(role, p);
  }

  private put(role: Role, p: Person): void {
    const list = this.free.get(role) ?? [];
    list.push(p);
    this.free.set(role, list);
  }
}
