/**
 * Reklamacja (ITEMS 7.3), the star sink at the kiosk: one affix of one item is re-rolled. Same grade, any family the slot allows,
 * exclusions as ITEMS 3.4, the magnitude tier of the new line rolled in the band again. No choice, one result. Once per item per planet;
 * the price grows with every reclaim of the same item. Uniques, the fixed lines of a set piece, absurd and free-version lines and
 * items still in their trial period are left alone. The roll is a pure function of the item's uid and how often it was reclaimed.
 */
import { createRng, type Rng } from '../core/rng';
import type { Player } from '../entities/types';
import { t } from '../i18n';
import { disposalRefusal } from '../items/absurd';
import { AFFIXES_BY_ID, affixForm, effectFor, randomAffixPool, type Affix } from '../items/affixes';
import { BASES_BY_ID } from '../items/bases';
import { actualOverClaim } from '../items/level';
import { renameItem } from '../items/rename';
import { SETS_BY_ID } from '../items/sets';
import { recomputeStats } from '../items/stats';
import { MOD_MULTIPLIER, STAT_FLOOR, rollModTier } from '../items/tiers';
import { STAT_KEYS, addStats, emptyStats, mapStats, type Item, type StatBlock } from '../items/types';
import { RECLAIM_BASE, RECLAIM_STEP, TIER_PRICE_MUL, ZESTAW_PRICE_MUL } from '../balance/loot';
import { spendStars } from './stars';

/** Why a reclaim did not happen. `message` is the Asystent's line when there is one. */
export type ReclaimRefusal = 'withdrawn' | 'unique' | 'planet' | 'trial' | 'nothing' | 'poor';

export type ReclaimResult =
  | { ok: true; cost: number; struck: string; typed: string; note: string }
  | { ok: false; reason: ReclaimRefusal; message: string };

/** The purse of a reclaim: gwiazdki, and (for a full player) the gear whose numbers are recomputed when the item is worn. */
export type ReclaimPurse = Pick<Player, 'gwiazdki'> & Partial<Pick<Player, 'equipment' | 'inventory' | 'baseStats'>>;
const isPlayer = (p: ReclaimPurse): p is Player => 'baseStats' in p && 'equipment' in p && 'inventory' in p;

export const timesReclaimed = (item: Pick<Item, 'reklamacje'>): number => item.reklamacje?.length ?? 0;

/** The tier factor of the price (ITEMS 7.1: zestaw x10, otherwise the tier's shop factor). */
const tierFactor = (item: Pick<Item, 'tier' | 'setId'>): number => (item.setId ? ZESTAW_PRICE_MUL : TIER_PRICE_MUL[item.tier]);

/** 10 x tier x (1 + 0.5 x times reclaimed on this item): a rzadki costs 60, 90, 120. */
export const reklamacjaCost = (item: Pick<Item, 'tier' | 'setId' | 'reklamacje'>): number =>
  Math.ceil(RECLAIM_BASE * tierFactor(item) * (1 + RECLAIM_STEP * timesReclaimed(item)));

/** Planets (0-based) the item was reclaimed on. */
export const reclaimedOn = (item: Pick<Item, 'reklamacje'>, planet: number): boolean => (item.reklamacje ?? []).some((r) => r.planet === planet);

const inTrial = (item: Item): boolean => item.plain !== undefined && item.absurd?.trialEnded !== true;

/** Indices into `item.affixes` that a reclaim may pick: not absurd, not free, not unwanted, not a fixed line of a set piece. */
export function rerollable(item: Item): number[] {
  const base = BASES_BY_ID.get(item.baseId);
  const fixed = item.setId ? (SETS_BY_ID.get(item.setId)?.pieces.find((p) => p.baseId === item.baseId)?.affixes.length ?? 2) : 0;
  const out: number[] = [];
  item.affixes.forEach((id, i) => {
    const a = AFFIXES_BY_ID.get(id);
    if (!a || !base || i < fixed || a.absurd || a.free || a.unwanted) return;
    out.push(i);
  });
  return out;
}

/** The affixes the new line may be: the old one's grade, the slot's, compatible with the others, none of the old. */
function replacements(item: Item, index: number): Affix[] {
  const base = BASES_BY_ID.get(item.baseId);
  const old = AFFIXES_BY_ID.get(item.affixes[index] ?? '');
  if (!base || !old) return [];
  const others = item.affixes.flatMap((id, i) => (i === index ? [] : AFFIXES_BY_ID.get(id) ?? []));
  return randomAffixPool(old.grade, item.slot, others, base.excludeAffixes).filter((a) => a.grade === old.grade && a.id !== old.id && !a.absurd);
}

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

/** What the affix adds at a magnitude, as the generator counts it (items/generate.ts): signed, at least 1 when not 0. */
function effectAt(a: Affix, item: Item, mag: number): StatBlock {
  return mapStats(addStats(emptyStats(), effectFor(a, item.slot)), (v) => (v === 0 ? 0 : Math.sign(v) * Math.max(1, Math.round(Math.abs(v) * mag))));
}

/** The refusal for this item on this planet, or null when a reclaim is possible (the price is not checked). */
export function reclaimRefusal(item: Item, planet: number): { reason: ReclaimRefusal; message: string } | null {
  const bin = disposalRefusal(item, 'reklamacja');
  if (bin) return { reason: 'withdrawn', message: bin };
  if (item.uniqueId) return { reason: 'unique', message: t('economy.reklamacja.unique') };
  if (inTrial(item)) return { reason: 'trial', message: t('economy.reklamacja.trial') };
  if (reclaimedOn(item, planet)) return { reason: 'planet', message: t('economy.reklamacja.planet') };
  const list = rerollable(item);
  if (list.length === 0 || list.every((i) => replacements(item, i).length === 0)) return { reason: 'nothing', message: t('economy.reklamacja.nothing') };
  return null;
}

/** The Asystent's reaction: the third reclaim of one item, a lying item, the second reclaim, the first. */
function noteFor(item: Item, times: number): string {
  if (times >= 3) return t('economy.reklamacja.note.third');
  if (item.review?.truth === 'bought') return t('economy.reklamacja.note.lying');
  return t(times >= 2 ? 'economy.reklamacja.note.again' : 'economy.reklamacja.note.first');
}

/**
 * Reclaim one affix of `item` on `planet` (0-based), paying from the player's purse. On success the old line is recorded as struck
 * (`item.reklamacje`), the new one typed under it, the numbers moved by the difference, the name regenerated, one opinion added.
 */
export function reclaim(p: ReclaimPurse, item: Item, planet: number): ReclaimResult {
  const refused = reclaimRefusal(item, planet);
  if (refused) return { ok: false, ...refused };
  const times = timesReclaimed(item);
  const rng = createRng(item.uid).fork(`reklamacja:${times}`);
  const candidates = rerollable(item).filter((i) => replacements(item, i).length > 0);
  const index = rng.pick(candidates);
  const oldId = item.affixes[index] ?? '';
  const old = AFFIXES_BY_ID.get(oldId);
  const next = pickWeighted(rng, replacements(item, index));
  if (!old || !next) return { ok: false, reason: 'nothing', message: t('economy.reklamacja.nothing') };
  const cost = reklamacjaCost(item);
  if (!spendStars(p, cost)) return { ok: false, reason: 'poor', message: t('economy.reklamacja.poor', { price: cost }) };

  const mod = rollModTier(rng, item.level);
  const take = effectAt(old, item, MOD_MULTIPLIER[item.modTier ?? 1]);
  const give = effectAt(next, item, MOD_MULTIPLIER[mod]);
  const delta = emptyStats();
  for (const k of STAT_KEYS) delta[k] = give[k] - take[k];
  const apply = (block: StatBlock, factor: number): StatBlock => {
    const out = emptyStats();
    for (const k of STAT_KEYS) {
      const floor = STAT_FLOOR[k];
      const v = Math.round(block[k] + delta[k] * factor);
      out[k] = floor !== undefined ? Math.max(floor, v) : v;
    }
    if (out.dmgMax < out.dmgMin) out.dmgMax = out.dmgMin;
    return out;
  };
  item.claimed = apply(item.claimed, 1);
  item.actual = apply(item.actual, actualOverClaim(item.tier, item.review?.truth ?? 'honest'));
  item.affixes[index] = next.id;
  (item.reklamacje ??= []).push({ planet, struck: oldId, typed: next.id, mod });
  if (item.review) item.review = { ...item.review, count: item.review.count + 1 };
  renameItem(item);
  if (isPlayer(p)) recomputeStats(p);
  return { ok: true, cost, struck: oldId, typed: next.id, note: noteFor(item, times + 1) };
}

/** The record of an item's reclaims as words for the card: the struck line and the one typed under it, in the item's gender. */
export const reklamacjaWords = (item: Pick<Item, 'reklamacje' | 'gender'>): { struck: string; typed: string }[] =>
  (item.reklamacje ?? []).map((r) => ({ struck: affixForm(r.struck, item.gender), typed: affixForm(r.typed, item.gender) }));
