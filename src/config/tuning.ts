// Gameplay tuning, ported from the prototype. Units: meters, seconds, cents.
// Literal values are kept exactly as the prototype wrote them so courses and runs match it bit for bit.

export const SIM_HZ = 120;
export const SIM_DT = 1 / SIM_HZ;

export const LANES = {
  x: [-1.6, 0, 1.6] as const,
  changeSpeed: 13,
};

export const SPEED = {
  start: 11,
  max: 17.5,
  rampDistance: 1100,
};

export const JUMP = {
  velocity: 7.4,
  gravity: 21,
  bufferTime: 0.16,
};

export const SLIDE = {
  duration: 0.75,
  height: 0.75,
  fastFallVelocity: -16,
};

export const PLAYER = {
  halfWidth: 0.25,
  halfDepth: 0.3,
  height: 1.7,
  hitTolerance: 0.05,
};

export const STUMBLE = {
  duration: 0.55,
  speedFactor: 0.12,
  recovery: 0.8,
  invulnerable: 1.5,
  cashLossFraction: 0.2,
  cashLossStep: 25,
  minCashLoss: 25,
};

export const RUN = {
  countdown: 3.2,
  tickBelow: 10,
  warnBelow: 15,
  finishCoastFactor: 0.55,
  finishCoastTime: 1.5,
  soldOutDecel: 20,
  soldOutTime: 1.6,
  // Obstacles are simulated only inside this window around the player.
  windowBehind: -12,
  windowAhead: 155,
  honkRange: 26,
  pigeonScareRange: 8,
};

/** Passing a tall obstacle you were lined up with this recently counts as a near miss (cosmetic). */
export const NEAR_MISS = { window: 0.3 };

export const COINS = {
  pickupRadius: 0.75,
  pickupBelow: 0.25,
  reachStanding: 1.9,
  reachSliding: 0.95,
  windowBehind: -3,
  windowAhead: 30,
  lineHeight: 0.6,
  // Quarters on a jump arc: 5 coins sampled along the jump parabola, centred on its apex.
  arc: { count: 5, tStart: 0.08, tSpan: 0.54, apexT: 0.352, baseHeight: 0.55 },
  value: { dime: 10, quarter: 25, single: 100, five: 500 },
};

export const POWERUPS = {
  pickupRadius: 0.8,
  pickupMaxY: 1.5,
  windowAhead: 3,
  windowBehind: -2,
  slice: { duration: 5, speedFactor: 1.3 },
  cat: { duration: 9, range: 22, behind: -1, pullRate: 7, targetHeight: 0.9, depthPull: 0.9 },
  express: {
    duration: 2.4,
    distance: 165,
    minDistance: 40,
    finishMargin: 40,
    clearBehind: 2,
    clearAhead: 24,
    landingInvulnerable: 1.0,
  },
};

export type ObstacleType =
  | 'zombie' | 'tourist' | 'ebike' | 'walker' | 'dogs' | 'cart' | 'trash'
  | 'cellar' | 'sawhorse' | 'steam' | 'board' | 'cab' | 'pigeons';

export interface ObstacleSpec {
  /** [bottom, top] in meters */
  h: readonly [number, number];
  /** half width */
  hw: number;
  depth: number;
  /** walking speed toward the player once active */
  u?: number;
  /** activation distance for movers */
  act?: number;
  harmless?: boolean;
}

export const OBSTACLES: Record<ObstacleType, ObstacleSpec> = {
  zombie: { h: [0, 1.8], hw: .42, depth: .5, u: 1.1, act: 60 },
  tourist: { h: [0, 1.8], hw: .45, depth: .5 },
  ebike: { h: [0, 1.9], hw: .42, depth: 1.4, u: 7.5, act: 45 },
  walker: { h: [0, 1.8], hw: .42, depth: .5, u: 1.3, act: 55 },
  dogs: { h: [0, .65], hw: .6, depth: 1.2, u: 1.3, act: 55 },
  cart: { h: [0, 2.2], hw: .62, depth: 1.0 },
  trash: { h: [0, .75], hw: .55, depth: 1.0 },
  cellar: { h: [0, .55], hw: .6, depth: 1.5 },
  sawhorse: { h: [0, .85], hw: .62, depth: .4 },
  steam: { h: [0, 2.4], hw: .38, depth: .6 },
  board: { h: [.95, 2.6], hw: 3, depth: .4 },
  cab: { h: [0, 1.5], hw: 2.0, depth: 1.5 },
  pigeons: { h: [0, 0], hw: 0, depth: 0, harmless: true },
};

export function baseSpeed(d: number): number {
  return SPEED.start + (SPEED.max - SPEED.start) * clamp(d / SPEED.rampDistance, 0, 1);
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
