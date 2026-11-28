import type { Coin, Obstacle, Powerup } from './course.ts';
import type { Order } from './economy.ts';
import type { Action } from './player.ts';

export interface RunResult {
  finished: boolean;
  stars: 0 | 1 | 2 | 3;
  /** what the cash bought, null when it ran short or the batch sold out */
  order: Order | null;
  cash: number;
  timeLeft: number;
  stumbles: number;
  found: number;
  pool: number;
  foundPct: number;
  /** last cross street reached */
  street: number;
}

/**
 * Things that happened during a sim step. Rendering, audio and the HUD react to these;
 * they never feed back into the simulation.
 */
export type SimEvent =
  | { type: 'countdown'; n: number }
  | { type: 'go' }
  | { type: 'move'; action: Action | 'fast-fall' }
  | { type: 'land'; then: 'slide' | 'jump' | null }
  | { type: 'hit'; obstacle: Obstacle; loss: number }
  | { type: 'knock'; obstacle: Obstacle }
  | { type: 'near-miss'; obstacle: Obstacle }
  | { type: 'activate'; obstacle: Obstacle }
  | { type: 'announce'; obstacle: Obstacle }
  | { type: 'coin'; coin: Coin }
  | { type: 'powerup'; powerup: Powerup }
  | { type: 'express-start'; from: number; to: number }
  | { type: 'express-land' }
  | { type: 'street'; street: number }
  | { type: 'tick'; seconds: number }
  | { type: 'sold-out' }
  | { type: 'finish' }
  | { type: 'result'; result: RunResult };
