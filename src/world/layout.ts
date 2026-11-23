import type { Course } from '../sim/course.ts';

// Street cross-section in meters. Sim x maps straight to world x; sim distance d maps to world z = -d.
// Running south on the west sidewalk: buildings on the right (+x), 7th Ave on the left (-x).
export const STREET = {
  wall: 2.6,
  curb: -3.4,
  curbWidth: 0.22,
  roadY: -0.14,
  busLane: -6.6,
  farCurb: -15.6,
  farWall: -19.8,
  lampX: -2.95,
  treeX: -2.75,
  furnitureX: -2.85,
};

export const toZ = (d: number) => -d;

const RAMP = 1.2;

/** Visual ground height at distance d: the crosswalks dip to road level with short curb ramps. */
export function groundHeight(course: Course, d: number): number {
  for (const it of course.intersections) {
    if (d < it.d0 - RAMP || d > it.d1 + RAMP) continue;
    const into = Math.min(d - (it.d0 - RAMP), it.d1 + RAMP - d);
    return STREET.roadY * Math.min(1, into / RAMP);
  }
  return 0;
}
