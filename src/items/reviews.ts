import type { Rng } from '../core/rng';
import type { Player } from '../entities/types';
import { t } from '../i18n';
import { recomputeStats } from './stats';
import { STAT_KEYS, emptyStats, type Item, type ItemTier, type Review, type ReviewTruth, type StatBlock } from './types';

/** Kills of trial by tier (DESIGN section 7). */
export const TRIAL_KILLS: Record<ItemTier, number> = { zwykly: 5, nietypowy: 10, rzadki: 15, unikatowy: 0 };
/** The free version's trial is longer: the item is good, and then it is not. */
export const FREE_TRIAL_KILLS = 20;

export const P_BOUGHT = 0.15;
export const P_UNDERRATED = 0.05;
/** Honest items deviate by at most this fraction. */
export const HONEST_SPREAD = 0.1;

export function rollTruth(rng: Rng): ReviewTruth {
  const r = rng.next();
  if (r < P_UNDERRATED) return 'niedoceniony';
  if (r < P_UNDERRATED + P_BOUGHT) return 'bought';
  return 'honest';
}

function roundStat(v: number): number {
  return Math.round(v);
}

/** The real numbers behind the claimed ones. */
export function actualFrom(rng: Rng, claimed: StatBlock, truth: ReviewTruth): StatBlock {
  const out = emptyStats();
  const common = truth === 'bought' ? rng.range(0.5, 0.8) : truth === 'niedoceniony' ? rng.range(1.25, 1.5) : 1;
  for (const k of STAT_KEYS) {
    const spread = truth === 'honest' ? HONEST_SPREAD : 0.05;
    out[k] = roundStat(claimed[k] * common * (1 + rng.range(-spread, spread)));
  }
  if (out.dmgMax < out.dmgMin) out.dmgMax = out.dmgMin;
  return out;
}

/** Stars and number of reviews: bought ones look suspiciously perfect, underrated ones look empty. */
export function rollReview(rng: Rng, truth: ReviewTruth): Review {
  const round1 = (v: number): number => Math.round(v * 10) / 10;
  if (truth === 'bought') return { truth, rating: round1(rng.range(4.7, 5)), count: rng.int(600, 4800) };
  if (truth === 'niedoceniony') return { truth, rating: round1(rng.range(2.9, 3.7)), count: rng.int(3, 25) };
  return { truth, rating: round1(rng.range(3.8, 4.8)), count: rng.int(20, 400) };
}

/** "4,8" - decimal comma. */
export const formatRating = (rating: number): string => rating.toFixed(1).replace('.', ',');

/** "4,8 · 213 opinii zweryfikowanych" */
export function reviewLine(r: Review): string {
  return t('items.review.line', { rating: formatRating(r.rating), count: r.count });
}

/** What the hero sets: 2 for the Konsultant. Trial progress per kill. */
export function trialMultiplier(p: Pick<Player, 'trialSpeed'>): number {
  return p.trialSpeed ?? 1;
}

export type RevealKind = 'honest' | 'bought' | 'niedoceniony' | 'free';

export interface Revealed {
  item: Item;
  kind: RevealKind;
}

/** Items that are still in trial and count kills: equipped, not blocked. */
function inTrial(item: Item): boolean {
  return !item.revealed && !item.blockedBy && item.trialTarget > 0;
}

/** Reveal one item now. Idempotent. */
export function revealItem(item: Item): Revealed | null {
  if (item.revealed) return null;
  item.revealed = true;
  item.trialKills = Math.max(item.trialKills, item.trialTarget);
  const truth = item.review?.truth ?? 'honest';
  const kind: RevealKind = item.freeVersion && !item.bought ? 'free' : truth;
  return { item, kind };
}

/**
 * Count `kills` toward the trials of equipped items (scaled by the hero's trial speed).
 * Returns the items whose trial just ended; stats are recomputed when any did.
 */
export function advanceTrial(p: Player, kills = 1): Revealed[] {
  const gain = kills * trialMultiplier(p);
  const done: Revealed[] = [];
  for (const item of Object.values(p.equipment)) {
    if (!item || !inTrial(item)) continue;
    item.trialKills += gain;
    if (item.trialKills >= item.trialTarget) {
      const r = revealItem(item);
      if (r) done.push(r);
    }
  }
  if (done.length) recomputeStats(p);
  return done;
}

/** The footnote that follows a reveal (the spec text for lies, plain confirmation otherwise). */
export function revealNote(r: Revealed): string {
  const n = r.item.number;
  switch (r.kind) {
    case 'bought':
      return t('items.reveal.bought', { n });
    case 'niedoceniony':
      return t('items.reveal.underrated', { n });
    case 'free':
      return t('items.reveal.free', { n });
    default:
      return t('items.reveal.honest', { n });
  }
}
