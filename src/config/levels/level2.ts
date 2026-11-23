import type { LevelConfig } from './types.ts';

// Level 2: south down the west sidewalk of 7th Ave, W 50 St to Penn Station.
export const LEVEL2: LevelConfig = {
  id: 'level2',
  number: 2,
  title: 'W 50 St → Penn Station',
  avenue: '7 AV',
  startStreet: 50,
  length: 1396,
  timeLimit: 110,
  crossStreets: { first: 40, spacing: 80, width: 13, firstStreet: 49, count: 18 },
  districts: [
    {
      id: 'times-square',
      name: 'Times Square',
      fromStreet: 47,
      toStreet: 42,
      weightMultipliers: { tourists: 2.2, zigzag: 1.4, zombie: 1.3 },
    },
  ],
  course: {
    start: 24,
    endMargin: 34,
    clearance: 4,
    minRoom: 10,
    idleStep: 4,
    afterIntersection: [4, 7],
    gap: { easy: 15, hard: 9, jitter: 4 },
    // Order matters: weighted picks walk this list.
    patterns: [
      { name: 'zombie', base: 3 },
      { name: 'tourists', base: 3 },
      { name: 'cellar', base: 2.5 },
      { name: 'scaffold', base: 1.6, perDifficulty: 1 },
      { name: 'ebike', base: 1.2, perDifficulty: 2 },
      { name: 'ebike2', base: 0, perDifficulty: 1.6, minDifficulty: 0.45 },
      { name: 'dogs', base: 2 },
      { name: 'cart', base: 2 },
      { name: 'zigzag', base: 1.5, perDifficulty: 1, minDifficulty: 0.2 },
      { name: 'steam', base: 1.4 },
      { name: 'sawhorse', base: 1.2, perDifficulty: 1 },
      { name: 'pigeons', base: 1.4, perDifficulty: -1 },
    ],
    minPool: 5000,
  },
  intersections: { cabChance: 0.5, cabFromIndex: 1 },
  powerups: {
    at: [140, 320, 500, 690, 870, 1050],
    jitter: 25,
    bag: ['slice', 'cat', 'express', 'slice', 'cat', { either: ['express', 'cat'], chance: 0.5 }],
    lead: 4,
    height: 0.8,
    expressCutoff: 230,
  },
  finishCoins: { lane: 1, before: 26, count: 10, spacing: 2.2 },
  bonusBill: { from: 650, to: 1150, minHeight: 1.7 },
  landmarks: {
    subwayStreets: [49, 42, 34],
    finishName: 'PENN STATION',
    finishStreet: 32,
    finishSubtitle: '7 AV · W 32 ST',
  },
};
