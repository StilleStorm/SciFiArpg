import type { Rng } from '../core/rng';
import type { StatBlock } from './types';

/** Affix magnitude tiers I-V (ITEMS 3.2). Not the same thing as the item tier (zwykły ... unikatowy). */
export type ModTier = 1 | 2 | 3 | 4 | 5;
export const MOD_TIERS: readonly ModTier[] = [1, 2, 3, 4, 5];

/** Highest item level of each band: I 1-8, II 9-16, III 17-24, IV 25-32, V 33-40. */
export const MOD_BAND = 8;
export const MOD_MULTIPLIER: Record<ModTier, number> = { 1: 1, 2: 1.5, 3: 2, 4: 2.75, 5: 3.5 };
/** Chance that an item takes the tier one below its band. */
export const P_TIER_BELOW = 0.3;

const ROMAN: Record<ModTier, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };

/** The tier of an item level; levels above 40 stay in V. */
export function modTierForLevel(level: number): ModTier {
  const band = Math.ceil(Math.max(1, level) / MOD_BAND);
  return Math.max(1, Math.min(5, band)) as ModTier;
}

/** The band (70%) or one below (30%); never above the band, never below I. */
export function rollModTier(rng: Rng, level: number): ModTier {
  const band = modTierForLevel(level);
  return rng.chance(P_TIER_BELOW) && band > 1 ? ((band - 1) as ModTier) : band;
}

/** "(II)": the register mark printed after the model. Tier I prints nothing. Not part of the spoken name. */
export const modTierMark = (tier: ModTier | undefined): string => (!tier || tier === 1 ? '' : `(${ROMAN[tier]})`);

/** Totals of the affix contribution that are limited so that the multiplier cannot break the stat (a trial cannot be -105%). */
export const STAT_FLOOR: Partial<Record<keyof StatBlock, number>> = { tempo: -35, proba: -70 };
