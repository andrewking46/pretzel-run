import type { ObstacleType } from '../config/tuning.ts';
import type { LevelConfig, PatternName } from '../config/levels/types.ts';
import type { CourseBuilder, Intersection, Lane } from './course.ts';

// The pattern library. Each pattern is a short, readable set piece that always leaves a way through,
// and lays cash along that way: dime lines on the safe path, quarter arcs over anything you can jump.
// `d` is where the pattern starts; `length` is how much road it owns. `df` is difficulty, 0..1 along the route.

export interface Pattern {
  length: number;
  place(b: CourseBuilder, d: number, df: number): void;
}

const tallThing = (b: CourseBuilder): ObstacleType => b.rng.pick(['tourist', 'tourist', 'cart', 'steam'] as const);
const pose = (b: CourseBuilder): 'camera' | 'map' => (b.rng.chance(0.5) ? 'camera' : 'map');
const edgeLane = (b: CourseBuilder): Lane => (b.rng.chance(0.5) ? 0 : 2);

export const PATTERNS: Record<PatternName, Pattern> = {
  // A phone zombie shuffles at you; later in the route a second one follows in another lane.
  zombie: {
    length: 20,
    place(b, d, df) {
      const a = b.lane();
      b.obstacle('zombie', a, d + 4);
      const free = b.otherLane(a);
      b.coinLine(free, d, 6, 2.2);
      if (df > 0.35 && b.rng.chance(0.6)) b.obstacle('zombie', b.otherLane(a, free), d + 14);
    },
  },

  // A wall of tourists with one gap; past the first quarter of the route the gap may hide open cellar doors.
  tourists: {
    length: 14,
    place(b, d, df) {
      const free = b.lane();
      for (const l of [0, 1, 2]) if (l !== free) b.obstacle('tourist', l, d + 3, { pose: pose(b) });
      b.coinLine(free, d - 3, 4, 2);
      if (df > 0.25 && b.rng.chance(0.55)) {
        b.obstacle('cellar', free, d + 3);
        b.coinArc(free, d + 3, b.rng.chance(0.4));
      } else {
        b.coinLine(free, d + 5, 3, 2);
      }
    },
  },

  // Cellar doors and trash bags: all jumpable, each with a quarter arc.
  cellar: {
    length: 10,
    place(b, d, df) {
      const n = df < 0.3 ? b.rng.int(1, 2) : b.rng.int(2, 3);
      b.rng.shuffle([0, 1, 2]).slice(0, n).forEach((l, i) => {
        b.obstacle(b.rng.chance(0.5) ? 'cellar' : 'trash', l, d + 3);
        b.coinArc(l, d + 3, i === 0 && b.rng.chance(0.5));
      });
    },
  },

  // Sidewalk-shed plywood across every lane: slide under, collecting low dimes.
  scaffold: {
    length: 14,
    place(b, d) {
      b.obstacle('board', -1, d + 5);
      b.coinLine(b.lane(), d + 1, 5, 1.8, 0.35);
    },
  },

  // A delivery e-bike waits, rings, then charges down its lane.
  ebike: {
    length: 28,
    place(b, d) {
      const a = b.lane();
      b.obstacle('ebike', a, d + 20);
      b.coinLine(b.otherLane(a), d + 4, 7, 2.2);
    },
  },

  // Two e-bikes, staggered, in different lanes.
  ebike2: {
    length: 48,
    place(b, d) {
      const a = b.lane();
      const second = b.otherLane(a);
      b.obstacle('ebike', a, d + 18);
      b.obstacle('ebike', second, d + 38);
      b.coinLine(b.otherLane(a, second), d + 6, 6, 2);
      b.coinLine(a, d + 28, 5, 2);
    },
  },

  // A dog walker in one lane, the leashed pack in the next: jump the dogs for a $1 arc.
  dogs: {
    length: 14,
    place(b, d) {
      const a = b.lane();
      const pack = a === 1 ? edgeLane(b) : 1;
      const walker = b.obstacle('walker', a, d + 6);
      b.obstacle('dogs', pack, d + 6, { leashedTo: walker.id });
      b.coinArc(pack, d + 6, true);
    },
  },

  // Hot dog cart beside a trash pile: go around, or jump the trash for quarters.
  cart: {
    length: 12,
    place(b, d) {
      const [cartLane, trashLane, free] = b.rng.shuffle([0, 1, 2]);
      b.obstacle('cart', cartLane, d + 4);
      b.obstacle('trash', trashLane, d + 4);
      b.coinLine(free, d - 2, 5, 2);
      b.coinArc(trashLane, d + 4, false);
    },
  },

  // Two staggered walls that force a full sweep from one edge to the other.
  zigzag: {
    length: 24,
    place(b, d) {
      const start = edgeLane(b);
      const end = 2 - start;
      b.obstacle(tallThing(b), start, d + 3, { pose: 'camera' });
      b.obstacle(tallThing(b), 1, d + 3, { pose: 'map' });
      b.obstacle(tallThing(b), 1, d + 17);
      b.obstacle(tallThing(b), end, d + 17, { pose: 'camera' });
      b.coinLine(end, d - 1, 4, 2);
      b.coinLine(1, d + 9, 3, 1.6);
      b.coinLine(start, d + 13, 5, 2);
    },
  },

  // A Con Ed-style steam stack in the middle with something beside it.
  steam: {
    length: 12,
    place(b, d) {
      b.obstacle('steam', 1, d + 4);
      const side = edgeLane(b);
      b.obstacle(b.rng.chance(0.5) ? 'tourist' : 'sawhorse', side, d + 4, { pose: 'map' });
      b.coinLine(2 - side, d - 2, 6, 2);
    },
  },

  // Sawhorses across two lanes, something tall in the third: jump for a $1 arc.
  sawhorse: {
    length: 10,
    place(b, d) {
      const tallLane = b.lane();
      for (const l of [0, 1, 2]) {
        if (l === tallLane) b.obstacle(b.rng.chance(0.5) ? 'tourist' : 'cart', l, d + 3, { pose: 'camera' });
        else b.obstacle('sawhorse', l, d + 3);
      }
      b.coinArc(b.otherLane(tallLane), d + 3, true);
    },
  },

  // A breather: pigeons scatter, nothing hurts.
  pigeons: {
    length: 14,
    place(b, d) {
      b.obstacle('pigeons', b.lane(), d + 5);
      b.coinLine(b.lane(), d, 7, 2);
    },
  },
};

/** Crosswalk content: a cab blocking the box across two lanes, or pigeons. */
export function placeIntersection(b: CourseBuilder, it: Intersection, level: LevelConfig): void {
  const mid = (it.d0 + it.d1) / 2;
  if (it.index >= level.intersections.cabFromIndex && b.rng.chance(level.intersections.cabChance)) {
    const blocksLeft = b.rng.chance(0.5);
    b.obstacle('cab', -1, mid, { x: blocksLeft ? -0.8 : 0.8, flip: b.rng.chance(0.5) });
    b.coinLine(blocksLeft ? 2 : 0, it.d0 + 1, 6, 2);
  } else {
    b.obstacle('pigeons', b.lane(), mid);
    b.coinLine(b.lane(), it.d0 + 1, 5, 2.2);
  }
}
