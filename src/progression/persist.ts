/**
 * What a character keeps between runs of the progression side (DESIGN 4.1, 8): level, reputacja, the taken updates
 * (with their ranks), the permissions and the queued levels. Pure data in, pure data out; the save layer stores it
 * (save/character.ts). Everything else is derived again: stats come from `recomputeStats` after the gear is back.
 */
import { heroDef } from '../heroes/defs';
import { recomputeStats } from '../items/stats';
import type { RunState } from '../world/run';
import { applyUpgrade, upgradeById } from './update';
import { MAX_LEVEL, xpToNext } from './xp';

export interface ProgressData {
  level: number;
  /** Reputacja towards the next level. */
  xp: number;
  /** Taken update id -> rank (skills 1..3, passives 1, stats up to their cap). */
  upgrades: Record<string, number>;
  /** Permission tokens (a family id) that were found. */
  permissions: string[];
  /** Levels gained whose update form was not filled in yet. */
  pendingLevels: number;
}

/** Read the progress of the run's player. The result shares nothing with the state. */
export function serializeProgress(s: RunState): ProgressData {
  return {
    level: s.player.level,
    xp: s.player.xp,
    upgrades: { ...s.hero.upgrades },
    permissions: [...s.player.permissions],
    pendingLevels: s.hero.pendingLevels,
  };
}

const whole = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback;

/**
 * Put saved progress on a fresh run state (right after `createRun` made the hero): the level's racja, every taken
 * update again through `applyUpgrade`, then the stats are recomputed from the gear already worn and racja is full.
 * Unknown update ids and ranks beyond the cap are ignored, so an old save never breaks a new build.
 */
export function applyProgress(s: RunState, data: ProgressData): void {
  const p = s.player;
  const level = whole(data.level, 1, MAX_LEVEL, 1);
  p.permissions = data.permissions.filter((x) => typeof x === 'string');
  p.level = level;
  p.xp = level >= MAX_LEVEL ? 0 : Math.min(whole(data.xp, 0, 1e9, 0), xpToNext(level) - 1);
  p.baseStats.hpMax += heroDef(p.heroId).racjaPerLevel * (level - 1);
  for (const [id, rank] of Object.entries(data.upgrades)) {
    const def = upgradeById(p.heroId, id);
    if (!def) continue;
    for (let r = 0; r < Math.min(rank, def.maxRank); r++) if (!applyUpgrade(s, id)) break;
  }
  s.hero.pendingLevels = whole(data.pendingLevels, 0, 99, 0);
  recomputeStats(p);
  p.hp = p.hpMax;
}
