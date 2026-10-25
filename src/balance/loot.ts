/**
 * Balance numbers of drops, gwiazdki and item budgets (systems/loot.ts, items/level.ts and world/quests.ts re-export or read
 * them; ITEMS 5.2, 6.1, 6.5, 7). Plain values; the types are written out so that this file imports nothing from the game.
 */

type Rank = 'common' | 'elite' | 'boss';
type Tier = 'zwykly' | 'nietypowy' | 'rzadki' | 'unikatowy';
type Priority = 'niski' | 'normalny' | 'wysoki' | 'krytyczny';

export interface DropRow {
  /** Chance of one item (bosses: `guaranteed` items instead). */
  item: number;
  guaranteed: number;
  /** Chance of a gwiazdki pile and its size. */
  star: number;
  starMin: number;
  starMax: number;
}

/** ITEMS 6.1 and 6.5. `boss` is the planet boss (the only boss a run has): three items, 25-35 gwiazdki. */
export const DROPS: Record<Rank, DropRow> = {
  common: { item: 0.12, guaranteed: 0, star: 0.6, starMin: 1, starMax: 2 },
  elite: { item: 1, guaranteed: 0, star: 1, starMin: 5, starMax: 8 },
  boss: { item: 1, guaranteed: 3, star: 1, starMin: 25, starMax: 35 },
};

/** Tier weights zwykly / nietypowy / rzadki / unikatowy (zestaw has no tier yet and counts as rzadki). */
export const DROP_TIER_WEIGHTS: Record<Rank, readonly [number, number, number, number]> = {
  common: [75, 22, 3, 0],
  elite: [35, 45, 19, 1],
  /** The two items after the guaranteed rzadki. */
  boss: [20, 50, 29, 1],
};

/** Share of rolls whose tier moves one column by priority: Niski left, Wysoki and Krytyczny right. */
export const PRIORITY_TIER_SHIFT: Record<Priority, number> = { niski: -0.2, normalny: 0, wysoki: 0.1, krytyczny: 0.25 };
/** Factor on every gwiazdki amount (ITEMS 6.5). */
export const PRIORITY_STAR_MUL: Record<Priority, number> = { niski: 0.8, normalny: 1, wysoki: 1.3, krytyczny: 1.6 };
/** The planet boss's first item: 12% a unique (doubled at Krytyczny). */
export const BOSS_UNIQUE_CHANCE = 0.12;
/** The planet boss's first item: 35% a zestaw piece of the planet's set (ITEMS 6.2); doubled at Krytyczny; none on a planet without a set. */
export const BOSS_SET_CHANCE = 0.35;
/** A shop offer is a zestaw piece of the planet's set this often (ITEMS 7.1); planets without a set always sell the plain offer. */
export const SHOP_SET_CHANCE = 0.1;

/** Tier multiplier on the base stats before affixes (ITEMS 5.2). */
export const TIER_BASE_MUL: Record<Tier, number> = { zwykly: 1, nietypowy: 1.1, rzadki: 1.2, unikatowy: 1.6 };
/** Effective budget against a zwykly (tests and the audit). */
export const TIER_BUDGET: Record<Tier, number> = { zwykly: 1, nietypowy: 1.6, rzadki: 2.4, unikatowy: 2.9 };
/** Shop price tier factor (ITEMS 7.1). */
export const TIER_PRICE_MUL: Record<Tier, number> = { zwykly: 1, nietypowy: 2.5, rzadki: 6, unikatowy: 14 };

/** The gwiazdki of a procedural side ticket (world/quests.ts): (base + perPlanet * planet + n * perUnit) rounded to 5. */
export const QUEST_STARS = { base: 18, perPlanet: 14, perUnit: { kill: 2, fetch: 2, reach: 6, deliver: 12 } as Record<string, number> };
