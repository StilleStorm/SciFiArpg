/**
 * Item level and budgets (ITEMS 5). Pure data and functions; the loot system, the Sklep and the item generator read them.
 * ilvl = 5 * (planet - 1) + 1 + page offset (0-2, the boss page +2) + priority bonus, capped at 40.
 */
import { ilvlBase, PRIORITIES, type PriorityId } from '../world/campaign';
import type { ItemTier } from './types';
import { TIER_BASE_MUL, TIER_BUDGET, TIER_PRICE_MUL } from '../balance/loot';

export const ILVL_CAP = 40;
export const ILVL_MIN = 1;
/** Page offset reaches this on the last (boss) page, and the boss drop adds it on top of the page's own. */
export const PAGE_OFFSET_MAX = 2;

export const clampIlvl = (n: number): number => Math.max(ILVL_MIN, Math.min(ILVL_CAP, Math.round(n)));

/** Page offset 0..2 spread over the run's pages; the last page is always 2. */
export function pageOffset(pageIndex: number, pageCount: number): number {
  const n = Math.max(1, Math.floor(pageCount));
  const i = Math.max(0, Math.min(n - 1, Math.floor(pageIndex)));
  if (n === 1) return PAGE_OFFSET_MAX;
  return Math.min(PAGE_OFFSET_MAX, Math.floor((i * (PAGE_OFFSET_MAX + 1)) / n));
}

export interface IlvlInput {
  /** 0-based planet index. */
  planet: number;
  priority: PriorityId;
  pageIndex: number;
  pageCount: number;
  /** A boss drop: +2 on top of the page offset. */
  boss?: boolean;
}

/** The item level of a drop (ITEMS 5.1). Planet 1 Normalny gives 1-5; planet 8 Krytyczny reaches 40. */
export function ilvlFor(i: IlvlInput): number {
  const boss = i.boss ? PAGE_OFFSET_MAX : 0;
  return clampIlvl(ilvlBase(i.planet) + pageOffset(i.pageIndex, i.pageCount) + boss + PRIORITIES[i.priority].ilvl);
}

/** The Sklep stocks the planet's band at page offset 1; the priority does not move it. */
export const shopIlvl = (planet: number): number => clampIlvl(ilvlBase(planet) + 1);

/** Base stats scale by this per item level (ITEMS 5.2). */
export const ILVL_STEP = 0.06;
export const ilvlScale = (ilvl: number): number => 1 + ILVL_STEP * (Math.max(ILVL_MIN, ilvl) - 1);

// the tier multipliers (base stats ITEMS 5.2, budget, shop price ITEMS 7.1) live in balance/loot.ts (S16)
export { TIER_BASE_MUL, TIER_BUDGET, TIER_PRICE_MUL };

/** price1 * (1 + 0.1 * ilvl) * tier, before the service fee. */
export const listPrice = (price1: number, ilvl: number, tier: ItemTier): number =>
  Math.max(1, Math.round(price1 * (1 + 0.1 * Math.max(ILVL_MIN, ilvl)) * TIER_PRICE_MUL[tier]));

/**
 * Review lies (ITEMS 5.3). `bought`: the claim is the actual inflated by this much, so actual = claim / (1 + m).
 * `underrated`: the actual is the claim inflated by this much. Uniques have no reviews.
 */
export const LIE_MAGNITUDE: Record<ItemTier, { bought: number; underrated: number }> = {
  zwykly: { bought: 0.15, underrated: 0.1 },
  nietypowy: { bought: 0.25, underrated: 0.15 },
  rzadki: { bought: 0.35, underrated: 0.2 },
  unikatowy: { bought: 0, underrated: 0 },
};

/** The factor that turns a claimed number into the actual one for a lying item; 1 for an honest one. */
export function actualOverClaim(tier: ItemTier, truth: 'honest' | 'bought' | 'niedoceniony'): number {
  const m = LIE_MAGNITUDE[tier];
  if (truth === 'bought') return 1 / (1 + m.bought);
  if (truth === 'niedoceniony') return 1 + m.underrated;
  return 1;
}
