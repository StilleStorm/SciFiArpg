/**
 * Balance numbers of the priorities and of the growth of the enemies with the planet (world/campaign.ts reads them; PLAN 3.2).
 * A priority row is [hp, dmg, tierShift, eliteMul, xp, stars, lootTier, ilvl] (unlock levels stay in campaign.ts).
 */

export type PriorityRow = readonly [hp: number, dmg: number, tierShift: number, eliteMul: number, xp: number, stars: number, lootTier: number, ilvl: number];

export const PRIORITY_ROWS: Record<'niski' | 'normalny' | 'wysoki' | 'krytyczny', PriorityRow> = {
  niski: [0.8, 0.75, 0, 0.6, 0.8, 0.8, 0, -2],
  normalny: [1, 1, 0, 1, 1, 1, 0, 0],
  wysoki: [1.35, 1.25, 0, 1.5, 1.4, 1.4, 1, 3],
  krytyczny: [1.8, 1.55, 1, 2.2, 2, 2, 1, 6],
};

/** Racja and damage of the enemies grow by this much per planet index. */
export const PLANET_HP_GROWTH = 0.12;
export const PLANET_DMG_GROWTH = 0.08;
