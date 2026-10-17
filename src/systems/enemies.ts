/**
 * Enemy systems: the AI step and the spawning API. The behaviour lives in enemies/ai.ts, the spawners in
 * enemies/spawn.ts and enemies/bosses.ts; this file is the entry the sim and the run structure import.
 */
import type { Bus } from '../core/events';
import { updateEnemyAi } from '../enemies/ai';
import type { Enemy, Grid } from '../entities';
import type { RunState } from '../world/run';

export { ENEMY_COUNT, placeEnemy, spawnElite, spawnEnemy, spawnWave, trickleSpawn, type MissionMix } from '../enemies/spawn';
export { spawnBoss } from '../enemies/bosses';

/** One simulation step of every enemy (auras, defects, movement, shots, bosses). */
export function updateEnemies(s: RunState, grid: Grid<Enemy>, bus: Bus, dt: number): void {
  updateEnemyAi(s, grid, bus, dt);
}
