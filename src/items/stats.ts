import type { Defender, Stats } from '../combat/damage';
import type { Rng } from '../core/rng';
import type { Player } from '../entities/types';
import { hitIgnoresItem } from './absurd';
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
  // S8 percentages: zasieg widens the reach, tempo (negative = faster) scales the cooldown, gwiazdki goes to the purse
  p.attackRange = (weapon?.range ?? base.attackRange) * Math.max(0.5, 1 + sum.zasieg / 100);
  p.attackCooldown = base.attackCooldown * (weapon?.cooldownMul ?? 1) * Math.max(TEMPO_FLOOR, 1 + sum.tempo / 100);
  p.starBonus = sum.gwiazdki;
}

/** The fastest the summed tempo can make a cooldown (-50%). */
export const TEMPO_FLOOR = 0.5;

/**
 * The player's defence against one incoming hit. A worn "domniemany" item is ignored by one hit in five
 * (items/absurd.ts hitIgnoresItem): its upor and resists are taken off for that roll. Rolls only when such an item is worn.
 */
export function wearerDefence(p: Player, rng: Rng): Defender {
  let out: Defender = p.stats;
  for (const slot of SLOTS) {
    const item = p.equipment[slot];
    if (!item || !hitIgnoresItem(item, rng)) continue;
    const e = effectiveStats(item);
    if (out === p.stats) out = { upor: p.stats.upor, resist: { ...p.stats.resist } };
    out.upor -= e.upor;
    for (const type of ['mechaniczny', 'regulaminowy', 'egzystencjalny'] as const) {
      const v = e[RESIST_KEY[type]];
      if (v) out.resist[type] = (out.resist[type] ?? 0) - v;
    }
  }
  return out;
}
