/**
 * What a character keeps between runs of the progression side (DESIGN 4.1, 8): level, reputacja, the taken updates
 * (with their ranks), the permissions and the queued levels. Pure data in, pure data out; the save layer stores it
 * (save/character.ts). Everything else is derived again: stats come from `recomputeStats` after the gear is back.
 */
import { heroDef, type SkillIndex } from '../heroes/defs';
import { fixPads } from '../heroes/loadout';
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
  /** Which skill (0..10) each of the three pads fires (DESIGN 10.1); saves from before the 4th and 5th skill have [0, 1, 2]. */
  pads: [SkillIndex, SkillIndex, SkillIndex];
}

export const DEFAULT_PADS: readonly [SkillIndex, SkillIndex, SkillIndex] = [0, 1, 2];

/** Read the three pads leniently: anything that is not three skill indexes (0..10) becomes the default. Duplicates are left to `fixPads`. */
export function padsFrom(v: unknown): [SkillIndex, SkillIndex, SkillIndex] {
  const ok = (x: unknown): x is SkillIndex => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 10;
  if (Array.isArray(v) && v.length === 3 && ok(v[0]) && ok(v[1]) && ok(v[2])) return [v[0], v[1], v[2]];
  return [...DEFAULT_PADS];
}

/** Read the progress of the run's player. The result shares nothing with the state. */
export function serializeProgress(s: RunState): ProgressData {
  return {
    level: s.player.level,
    xp: s.player.xp,
    upgrades: { ...s.hero.upgrades },
    permissions: [...s.player.permissions],
    pendingLevels: s.hero.pendingLevels,
    pads: [...s.hero.pads],
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
  s.hero.pads = padsFrom(data.pads);
  fixPads(s); // a pad that holds a skill not installed (an old or damaged save) falls back to one that is
  recomputeStats(p);
  p.hp = p.hpMax;
}
