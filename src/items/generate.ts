import type { Rng } from '../core/rng';
import { AFFIXES_BY_ID, randomAffixPool, type Affix } from './affixes';
import { BASES, BASES_BY_ID, basesForSlot, type BaseItem } from './bases';
import { affixesOf, nameItem } from './grammar';
import { FREE_TRIAL_KILLS, TRIAL_KILLS, actualFrom, rollReview, rollTruth } from './reviews';
import { makeUnique, uniquesForSlot } from './uniques';
import { TAGS, addStats, emptyStats, mapStats, type DropSource, type Item, type ItemTier, type Slot, type StatBlock } from './types';

export interface RollOptions {
  /** Force a tier. Otherwise rolled by `source`. */
  tier?: ItemTier;
  slot?: Slot;
  /** Item level; scales the numbers. At least 1. */
  level: number;
  /** Enemy tier the drop came from. Default common. */
  source?: DropSource;
  /** Move the rolled tier up (a law: "loot quality +1 tier"). Never rolls a unique by itself. */
  tierBonus?: number;
  /** Force the base (shop variants use this). */
  baseId?: string;
}

/** Weights: zwykly, nietypowy, rzadki, unikatowy. */
export const TIER_WEIGHTS: Record<DropSource, readonly [number, number, number, number]> = {
  common: [70, 24, 5.5, 0.5],
  elite: [25, 45, 26, 4],
  boss: [0, 20, 55, 25],
};

const TIER_ORDER: readonly ItemTier[] = ['zwykly', 'nietypowy', 'rzadki', 'unikatowy'];
const TIER_MUL: Record<ItemTier, number> = { zwykly: 1, nietypowy: 1.15, rzadki: 1.35, unikatowy: 1.6 };
const TIER_PRICE: Record<ItemTier, number> = { zwykly: 1, nietypowy: 2.2, rzadki: 5, unikatowy: 14 };
const TIER_GRADE: Record<ItemTier, 1 | 2 | 3> = { zwykly: 1, nietypowy: 2, rzadki: 3, unikatowy: 3 };
/** Probability that a rare item carries the free-version affix. */
export const P_FREE = 0.12;

export function rollTier(rng: Rng, source: DropSource = 'common', bonus = 0): ItemTier {
  const w = TIER_WEIGHTS[source];
  const total = w[0] + w[1] + w[2] + w[3];
  let r = rng.next() * total;
  let idx = 0;
  for (let i = 0; i < 4; i++) {
    r -= w[i] ?? 0;
    if (r < 0) {
      idx = i;
      break;
    }
    idx = i;
  }
  if (bonus > 0 && idx < 2) idx = Math.min(2, idx + bonus);
  return TIER_ORDER[idx] ?? 'zwykly';
}

const levelScale = (level: number): number => 1 + 0.12 * (Math.max(1, level) - 1);

function pickWeighted(rng: Rng, pool: readonly Affix[]): Affix | null {
  const total = pool.reduce((s, a) => s + a.weight, 0);
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const a of pool) {
    r -= a.weight;
    if (r < 0) return a;
  }
  return pool[pool.length - 1] ?? null;
}

/** Roll the numbers of base + affixes at a level and tier. Integers; dmgMax >= dmgMin. */
export function statsFor(base: BaseItem, affixes: readonly Affix[], level: number, tier: ItemTier): StatBlock {
  const ls = levelScale(level);
  let s = mapStats(addStats(emptyStats(), base.stats), (v) => (v === 0 ? 0 : Math.max(1, Math.round(v * ls * TIER_MUL[tier]))));
  for (const a of affixes) {
    s = addStats(
      s,
      mapStats(addStats(emptyStats(), a.effect), (v) => (v === 0 ? 0 : Math.sign(v) * Math.max(1, Math.round(Math.abs(v) * ls)))),
    );
  }
  if (s.dmgMax < s.dmgMin) s.dmgMax = s.dmgMin;
  return s;
}

/** Price in gwiazdki before the shop's fee. */
export function itemValue(item: Pick<Item, 'baseId' | 'tier' | 'level'>): number {
  const base = BASES_BY_ID.get(item.baseId);
  return Math.max(1, Math.round((base?.price ?? 4) * TIER_PRICE[item.tier] * levelScale(item.level)));
}

/** The price to buy out a free version. */
export const buyOutPrice = (item: Item): number => Math.max(6, Math.round(itemValue(item) * 1.5));

function pickBase(rng: Rng, slot: Slot | undefined, baseId: string | undefined): BaseItem {
  const forced = baseId ? BASES_BY_ID.get(baseId) : undefined;
  if (forced) return forced;
  return rng.pick(slot ? basesForSlot(slot) : BASES);
}

/** Make a generated (non-unique) item. */
export function buildItem(rng: Rng, base: BaseItem, tier: ItemTier, level: number, affixIds: readonly string[]): Item {
  const affixes = affixesOf(affixIds);
  const claimed = statsFor(base, affixes, level, tier);
  const truth = rollTruth(rng);
  const actual = actualFrom(rng, claimed, truth);
  const review = rollReview(rng, truth);
  const free = affixes.some((a) => a.free);
  const item: Item = {
    uid: rng.int(1, 0x3fffffff),
    number: 0,
    name: nameItem(base, affixes),
    slot: base.slot,
    baseId: base.id,
    gender: base.gender,
    tier,
    level,
    affixes: [...affixIds],
    drawing: base.drawing,
    claimed,
    actual,
    revealed: false,
    trialKills: 0,
    trialTarget: free ? FREE_TRIAL_KILLS : TRIAL_KILLS[tier],
    review,
  };
  if (tier === 'rzadki') {
    const like = rng.pick(TAGS);
    const dislike = rng.pick(TAGS.filter((x) => x !== like));
    item.likes = like;
    item.dislikes = dislike;
  }
  if (free) item.freeVersion = true;
  if (base.damageType) item.damageType = base.damageType;
  if (base.range !== undefined) item.range = base.range;
  if (base.cooldownMul !== undefined) item.cooldownMul = base.cooldownMul;
  return item;
}

function rollAffixIds(rng: Rng, base: BaseItem, tier: ItemTier): string[] {
  const count = tier === 'zwykly' ? rng.int(0, 1) : tier === 'nietypowy' ? rng.int(1, 2) : rng.int(2, 3);
  const ids: string[] = [];
  let pool = randomAffixPool(TIER_GRADE[tier], base.slot);
  if (tier === 'rzadki' && rng.chance(P_FREE)) {
    const free = AFFIXES_BY_ID.get('darmowy');
    if (free) ids.push(free.id);
  }
  while (ids.length < count && pool.length) {
    const a = pickWeighted(rng, pool);
    if (!a) break;
    ids.push(a.id);
    pool = pool.filter((x) => x.id !== a.id);
  }
  // Adjectives first, the free-version phrase last (grammar.joinName sorts the same way).
  return ids;
}

/**
 * Roll one item. Deterministic for a given rng state: same seed, same stream position, same item.
 * `number` is left 0; the loot system numbers it when it is picked up.
 */
export function rollItem(rng: Rng, opts: RollOptions): Item {
  const level = Math.max(1, Math.round(opts.level));
  let tier = opts.tier ?? rollTier(rng, opts.source ?? 'common', opts.tierBonus ?? 0);
  if (tier === 'unikatowy') {
    const defs = uniquesForSlot(opts.slot);
    const def = defs.length ? rng.pick(defs) : null;
    const uid = rng.int(1, 0x3fffffff);
    const unique = def ? makeUnique(def, uid, level) : null;
    if (unique) return unique;
    tier = 'rzadki';
  }
  const base = pickBase(rng, opts.slot, opts.baseId);
  return buildItem(rng, base, tier, level, rollAffixIds(rng, base, tier));
}
