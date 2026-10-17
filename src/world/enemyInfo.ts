import type { Enemy } from '../entities';

/**
 * What the narration and the laws need to know about an enemy that is already gone when `enemy:died`
 * arrives (killEnemy removes it from the run first). Refreshed from the live list each step. The event itself
 * also carries `tier` and `family`; this is the fallback for events that do not.
 */
export interface EnemyInfo {
  family: string;
  elite: boolean;
  boss: boolean;
}

const seen = new Map<number, EnemyInfo>();

export function describeEnemy(e: Enemy): EnemyInfo {
  return { family: e.family, elite: e.elite !== undefined, boss: e.boss === true };
}

/** Remember the living enemies (call once per step). */
export function trackEnemies(enemies: readonly Enemy[]): void {
  for (const e of enemies) seen.set(e.id, describeEnemy(e));
}

export function enemyInfo(id: number): EnemyInfo | undefined {
  return seen.get(id);
}

export function forgetEnemies(): void {
  seen.clear();
}
