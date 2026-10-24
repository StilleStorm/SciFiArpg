/**
 * Balance numbers of the recovery of racja (systems/recovery.ts re-exports them; PLAN 8). One place, so a tuning pass
 * (scripts/balance-report.mjs) changes numbers here and nowhere else. Plain values, no imports from the game.
 */

/** Chance that a dead enemy of each tier leaves a potwierdzenie. */
export const POTWIERDZENIE_DROP: Record<'common' | 'elite' | 'boss', number> = { common: 0.1, elite: 0.5, boss: 1 };
/** How many slips a character may hold. */
export const HELD_CAP = 5;
/** Share of the maximum racja one slip restores. */
export const HEAL_SHARE = 0.25;
/** A blow that would leave less racja than this share uses a held slip first. */
export const AUTO_FLOOR = 0.15;
/** Walking this close (plus the radii) pulls a slip in. */
export const VACUUM_RADIUS = 90;
/** Regeneration out of combat: share of the maximum per second, after this many seconds without a blow. */
export const REGEN_RATE = 0.02;
export const REGEN_DELAY = 4;
