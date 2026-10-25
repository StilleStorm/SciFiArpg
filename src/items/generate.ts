import { createRng, type Rng } from '../core/rng';
import { AFFIXES_BY_ID, canCombine, effectFor, randomAffixPool, type Affix } from './affixes';
import { BASES, BASES_BY_ID, basesForSlot, oddStats, type BaseItem } from './bases';
import { affixesOf, nameItem } from './grammar';
import { TIER_BASE_MUL, ilvlScale, listPrice } from './level';
import { FREE_TRIAL_KILLS, TRIAL_KILLS, actualFrom, rollReview, rollTruth } from './reviews';
import { MOD_MULTIPLIER, STAT_FLOOR, modTierForLevel, rollModTier, type ModTier } from './tiers';
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
  /** Rolled for the Sklep: the weight of grade 3 affixes halves, so shop stock reads plainer than drops (ITEMS 3.4). */
  shop?: boolean;
}

/** Weights: zwykly, nietypowy, rzadki, unikatowy. */
export const TIER_WEIGHTS: Record<DropSource, readonly [number, number, number, number]> = {
  common: [70, 24, 5.5, 0.5],
  elite: [25, 45, 26, 4],
  boss: [0, 20, 55, 25],
};

const TIER_ORDER: readonly ItemTier[] = ['zwykly', 'nietypowy', 'rzadki', 'unikatowy'];
const TIER_MUL = TIER_BASE_MUL;
const TIER_GRADE: Record<ItemTier, 1 | 2 | 3> = { zwykly: 1, nietypowy: 2, rzadki: 3, unikatowy: 3 };
/** Probability that a rzadki delivered by post carries the free-version affix (ITEMS 6.4: the only channel it has). */
export const P_FREE = 0.1;
/** Zwykły items with no affix at all. */
export const P_NO_AFFIX = 0.4;

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

const levelScale = ilvlScale;

/** Selection weight; grade 3 halves in the shop, and the shop never stocks what it says does not exist (wycofany). */
const weightOf = (a: Affix, shop: boolean): number => (!shop ? a.weight : a.absurd === 'wycofany' ? 0 : a.grade === 3 ? a.weight / 2 : a.weight);

function pickWeighted(rng: Rng, pool: readonly Affix[], shop = false): Affix | null {
  const total = pool.reduce((s, a) => s + weightOf(a, shop), 0);
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const a of pool) {
    r -= weightOf(a, shop);
    if (r < 0) return a;
  }
  return [...pool].reverse().find((a) => weightOf(a, shop) > 0) ?? null;
}

/** "w wersji próbnej": +20% to every stat on the item, for the first two pages. */
export const TRIAL_BOOST = 1.2;

function computeStats(base: BaseItem, affixes: readonly Affix[], level: number, tier: ItemTier, modTier: ModTier, boost: boolean): StatBlock {
  const ls = levelScale(level);
  const mag = MOD_MULTIPLIER[modTier];
  let s = mapStats(addStats(emptyStats(), base.stats), (v) => (v === 0 ? 0 : Math.max(1, Math.round(v * ls * TIER_MUL[tier]))));
  s = addStats(s, oddStats(base)); // percentages: not scaled by level or tier
  for (const a of affixes) {
    s = addStats(
      s,
      mapStats(addStats(emptyStats(), effectFor(a, base.slot)), (v) => (v === 0 ? 0 : Math.sign(v) * Math.max(1, Math.round(Math.abs(v) * mag)))),
    );
  }
  for (const [k, floor] of Object.entries(STAT_FLOOR) as [keyof StatBlock, number][]) s[k] = Math.max(floor, s[k]);
  if (boost && affixes.some((a) => a.absurd === 'probny')) s = mapStats(s, (v) => Math.round(v * TRIAL_BOOST));
  if (s.dmgMax < s.dmgMin) s.dmgMax = s.dmgMin;
  return s;
}

/**
 * Roll the numbers of base + affixes at a level and tier. Integers; dmgMax >= dmgMin.
 * The base scales with the item level; affixes with the magnitude tier I-V (default: the band of the level).
 */
export function statsFor(base: BaseItem, affixes: readonly Affix[], level: number, tier: ItemTier, modTier: ModTier = modTierForLevel(level)): StatBlock {
  return computeStats(base, affixes, level, tier, modTier, true);
}

/** Price in gwiazdki before the shop's fee. */
export function itemValue(item: Pick<Item, 'baseId' | 'tier' | 'level'>): number {
  const base = BASES_BY_ID.get(item.baseId);
  return listPrice(base?.price ?? 4, item.level, item.tier);
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
  const modTier = affixes.length ? rollModTier(rng, level) : modTierForLevel(level);
  const claimed = statsFor(base, affixes, level, tier, modTier);
  const rzekomy = affixes.some((a) => a.absurd === 'rzekomy');
  // "Rzekomy": the claim is honest within 10%, and the register keeps it forever.
  const truth = rzekomy ? 'honest' : rollTruth(rng);
  const actual = actualFrom(rng, claimed, truth, tier);
  const review = rollReview(rng, truth);
  const free = affixes.some((a) => a.free);
  const baseTrial = free ? FREE_TRIAL_KILLS : TRIAL_KILLS[tier];
  const trialTarget = rzekomy ? 0 : Math.max(1, Math.round(baseTrial * (1 + claimed.proba / 100)));
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
    trialTarget,
    review,
  };
  if (modTier > 1) item.modTier = modTier;
  if (affixes.some((a) => a.absurd === 'probny')) {
    const plainClaimed = computeStats(base, affixes, level, tier, modTier, false);
    const ratio = (k: keyof StatBlock): number => (claimed[k] === 0 ? 0 : plainClaimed[k] / claimed[k]);
    item.plain = { claimed: plainClaimed, actual: mapStats(actual, (v, k) => Math.round(v * ratio(k))) };
  }
  if (affixes.some((a) => a.absurd === 'ewentualny')) {
    const nominal = Math.round(16 * MOD_MULTIPLIER[modTier]);
    item.absurd = { ewentNominal: nominal, ewentNow: nominal };
  }
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

/**
 * Affix ids for a generated item (ITEMS 3.4): count by tier (zwykły 0-1 with 40% none, nietypowy 1-2,
 * rzadki 2-3 with at least one grade 2+), exclusions in `canCombine`. The free version is never rolled here (ITEMS 6.4: it comes
 * only by post, `freeVersionOf`); the rzadki still draws its old chance at 0, so every seeded stream after it stays where it was.
 */
export function rollAffixIds(rng: Rng, base: BaseItem, tier: ItemTier, shop = false): string[] {
  const count = tier === 'zwykly' ? (rng.chance(P_NO_AFFIX) ? 0 : 1) : tier === 'nietypowy' ? rng.int(1, 2) : rng.int(2, 3);
  const chosen: Affix[] = [];
  if (tier === 'rzadki' && rng.chance(0)) {
    const free = AFFIXES_BY_ID.get('darmowy');
    if (free) chosen.push(free);
  }
  while (chosen.length < count) {
    let pool = randomAffixPool(TIER_GRADE[tier], base.slot, chosen, base.excludeAffixes);
    if (tier === 'rzadki' && chosen.length === count - 1 && !chosen.some((a) => a.grade >= 2)) {
      const better = pool.filter((a) => a.grade >= 2);
      if (better.length) pool = better;
    }
    const a = pickWeighted(rng, pool, shop);
    if (!a) break;
    chosen.push(a);
  }
  return chosen.map((a) => a.id);
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
  return buildItem(rng, base, tier, level, rollAffixIds(rng, base, tier, opts.shop === true));
}

/**
 * A rzadki that travels by post (items/delivery.ts): one time in ten (`P_FREE`) it arrives "w wersji darmowej", the free version
 * replacing one rolled affix (one that cannot stand beside it first, else the last). Rebuilt from the same base, tier and level; the roll
 * is a fork of the item's uid, so the loot stream is not moved. Anything else, or the nine times in ten, comes back as it was.
 */
export function freeVersionOf(item: Item): Item {
  if (item.tier !== 'rzadki' || item.setId || item.uniqueId || item.freeVersion) return item;
  const rng = createRng(item.uid).fork('darmowy');
  if (!rng.chance(P_FREE)) return item;
  const base = BASES_BY_ID.get(item.baseId);
  const free = AFFIXES_BY_ID.get('darmowy');
  if (!base || !free) return item;
  const rolled = affixesOf(item.affixes);
  const clash = rolled.findIndex((a) => !canCombine([a], free));
  const drop = clash >= 0 ? clash : rolled.length - 1;
  const kept = rolled.filter((_, i) => i !== drop);
  if (!canCombine(kept, free)) return item;
  return buildItem(rng, base, 'rzadki', item.level, [free.id, ...kept.map((a) => a.id)]);
}
