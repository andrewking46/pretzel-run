import { COINS, PLAYER, POWERUPS } from '../config/tuning.ts';
import type { Coin, Obstacle, Powerup } from './course.ts';
import type { Player } from './player.ts';

// Axis-aligned overlap tests in x (lateral), y (height) and z (distance relative to the player).

/** `z` is the obstacle's distance ahead of the player. */
export function hitsObstacle(p: Player, o: Obstacle, z: number): boolean {
  if (Math.abs(z) > o.depth / 2 + PLAYER.halfDepth) return false;
  if (Math.abs(p.x - o.x) > o.hw + PLAYER.halfWidth) return false;
  const top = p.y + p.height;
  return p.y < o.y1 - PLAYER.hitTolerance && top > o.y0 + PLAYER.hitTolerance;
}

/** True if the obstacle's lateral extent covers the player's at `x`. */
export function overlapsLaterally(x: number, o: Obstacle): boolean {
  return Math.abs(x - o.x) <= o.hw + PLAYER.halfWidth;
}

export function reachesCoin(p: Player, c: Coin, z: number): boolean {
  const reach = p.y + (p.sliding ? COINS.reachSliding : COINS.reachStanding);
  return (
    Math.abs(z) < COINS.pickupRadius &&
    Math.abs(c.x - p.x) < COINS.pickupRadius &&
    c.y >= p.y - COINS.pickupBelow &&
    c.y <= reach
  );
}

export function reachesPowerup(p: Player, pw: Powerup, z: number): boolean {
  return Math.abs(z) < POWERUPS.pickupRadius && Math.abs(pw.x - p.x) < POWERUPS.pickupRadius && p.y < POWERUPS.pickupMaxY;
}
