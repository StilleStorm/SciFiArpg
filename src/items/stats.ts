import type { Stats } from '../combat/damage';
import type { Player } from '../entities/types';
import { activeSets, refreshCompat, SET_BONUS } from './compat';
import { RESIST_KEY, SLOTS, addStats, emptyStats, mapStats, type Item, type StatBlock } from './types';

/** The free version after its trial: -40%. */
export const FREE_PENALTY = 0.6;

export const isFreeLimited = (item: Item): boolean => item.freeVersion === true && item.revealed && !item.bought;

/** What an item contributes right now: claimed until the trial ends, then actual; zero when it clashes. */
export function effectiveStats(item: Item): StatBlock {
  if (item.blockedBy && !item.adapter) return emptyStats();
  const base = item.revealed ? item.actual : item.claimed;
  return isFreeLimited(item) ? mapStats(base, (v) => Math.round(v * FREE_PENALTY)) : base;
}

/**
 * Hero base stats + equipment -> player.stats, hpMax, damageType, attackRange, attackCooldown.
 * Call on equip, unequip, trial reveal, adapter purchase and buy-out.
 */
export function recomputeStats(p: Player): void {
  refreshCompat(p.equipment);
  let sum = emptyStats();
  let weapon: Item | undefined;
  for (const slot of SLOTS) {
    const item = p.equipment[slot];
    if (!item) continue;
    sum = addStats(sum, effectiveStats(item));
    if (slot === 'bron' && !(item.blockedBy && !item.adapter)) weapon = item;
  }
  for (let i = activeSets(p.equipment).length; i > 0; i--) sum = addStats(sum, SET_BONUS);

  const base = p.baseStats;
  const stats: Stats = {
    pewnoscSiebie: base.stats.pewnoscSiebie + sum.pewnosc,
    upor: base.stats.upor + sum.upor,
    dmgMin: Math.max(1, base.stats.dmgMin + sum.dmgMin),
    dmgMax: Math.max(1, base.stats.dmgMax + sum.dmgMax),
    critChance: Math.max(0, Math.min(1, base.stats.critChance + sum.crit / 100)),
    resist: { ...base.stats.resist },
  };
  if (stats.dmgMax < stats.dmgMin) stats.dmgMax = stats.dmgMin;
  for (const type of ['mechaniczny', 'regulaminowy', 'egzystencjalny'] as const) {
    const extra = sum[RESIST_KEY[type]];
    if (extra !== 0) stats.resist[type] = (stats.resist[type] ?? 0) + extra;
  }
  p.stats = stats;

  const hpMax = Math.max(1, base.hpMax + sum.racja);
  if (hpMax > p.hpMax) p.hp += hpMax - p.hpMax;
  p.hpMax = hpMax;
  if (p.hp > hpMax) p.hp = hpMax;

  p.damageType = weapon?.damageType ?? base.damageType;
  p.attackRange = weapon?.range ?? base.attackRange;
  p.attackCooldown = base.attackCooldown * (weapon?.cooldownMul ?? 1);
}
