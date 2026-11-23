// Shape of a level. Levels are pure data; the engine never names a specific level.

export type PatternName =
  | 'zombie' | 'tourists' | 'cellar' | 'scaffold' | 'ebike' | 'ebike2'
  | 'dogs' | 'cart' | 'zigzag' | 'steam' | 'sawhorse' | 'pigeons';

export type PowerupKind = 'slice' | 'cat' | 'express';

/** weight(df) = df > minDifficulty ? base + perDifficulty * df : 0 */
export interface PatternWeight {
  name: PatternName;
  base: number;
  perDifficulty?: number;
  minDifficulty?: number;
}

export interface District {
  id: string;
  name: string;
  /** starts at this cross street's near curb */
  fromStreet: number;
  /** ends at this cross street's far curb */
  toStreet: number;
  weightMultipliers: Partial<Record<PatternName, number>>;
}

export type PowerupSlot = PowerupKind | { either: readonly [PowerupKind, PowerupKind]; chance: number };

export interface LevelConfig {
  id: string;
  number: number;
  title: string;
  avenue: string;
  startStreet: number;
  /** distance of the finish line (meters) */
  length: number;
  /** seconds on the FRESH BATCH clock */
  timeLimit: number;
  crossStreets: {
    first: number;
    spacing: number;
    width: number;
    firstStreet: number;
    count: number;
  };
  districts: readonly District[];
  course: {
    start: number;
    endMargin: number;
    /** patterns must end this far before a crosswalk */
    clearance: number;
    minRoom: number;
    idleStep: number;
    afterIntersection: readonly [number, number];
    gap: { easy: number; hard: number; jitter: number };
    patterns: readonly PatternWeight[];
    /** courses whose cash pool comes in under this are topped up by upgrading dimes to quarters */
    minPool: number;
  };
  intersections: { cabChance: number; cabFromIndex: number };
  powerups: {
    at: readonly number[];
    jitter: number;
    bag: readonly PowerupSlot[];
    lead: number;
    height: number;
    /** expresses placed later than length - expressCutoff are dropped */
    expressCutoff: number;
  };
  finishCoins: { lane: number; before: number; count: number; spacing: number };
  bonusBill: { from: number; to: number; minHeight: number };
  landmarks: {
    subwayStreets: readonly number[];
    finishName: string;
    finishStreet: number;
    finishSubtitle: string;
  };
}
