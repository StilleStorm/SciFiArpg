/** Reputacja (XP) and the level curve. Pure functions plus one that moves the player up. */
import type { Bus } from '../core/events';
import { heroDef } from '../heroes/defs';
import { recomputeStats } from '../items/stats';
import { xpMul } from '../world/campaign';
import type { RunState } from '../world/run';

export const MAX_LEVEL = 40;

/** Reputacja needed to go from `level` to `level + 1`: 30, 52, 88, 128, ... (always rising). */
export function xpToNext(level: number): number {
  return Math.round(30 + 22 * Math.pow(Math.max(0, level - 1), 1.4));
}

/** Reputacja for a kill, by the enemy's tier (the enemies agent adds `tier` to enemy:died). */
export function xpForKill(tier?: string): number {
  if (tier === 'boss') return 150;
  if (tier === 'elite') return 40;
  return 10;
}

/** Total reputacja needed to stand at the start of `level`. */
export function xpTotalFor(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}

/** Add reputacja (scaled by passives). Returns how many levels were gained; emits player:levelup for each. */
export function gainXp(s: RunState, bus: Bus, amount: number): number {
  const p = s.player;
  if (p.level >= MAX_LEVEL) return 0;
  p.xp += Math.max(0, Math.round(amount * s.hero.mods.xp * xpMul(s.plan)));
  let gained = 0;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    gained++;
    p.baseStats.hpMax += heroDef(p.heroId).racjaPerLevel;
    recomputeStats(p);
    bus.emit('player:levelup', { level: p.level });
  }
  return gained;
}
