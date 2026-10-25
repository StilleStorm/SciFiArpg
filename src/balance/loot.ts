/**
 * Balance numbers of drops, gwiazdki and item budgets (systems/loot.ts, items/level.ts and world/quests.ts re-export or read
 * them; ITEMS 5.2, 6.1, 6.5, 7). Plain values; the types are written out so that this file imports nothing from the game.
 */

type Rank = 'common' | 'elite' | 'named' | 'boss';
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
  /** S18: a named elite (ITEMS 6.5): 12-18 gwiazdki; its item rows are the elite's roll plus the guaranteed `dropGuaranteed` one (the weights below). */
  named: { item: 1, guaranteed: 0, star: 1, starMin: 12, starMax: 18 },
  boss: { item: 1, guaranteed: 3, star: 1, starMin: 25, starMax: 35 },
};

/** Tier weights, ITEMS 6.1: zwykly / nietypowy / rzadki / zestaw / unikatowy (S18 split the zestaw column off rzadki; each row sums to 100). */
export type DropWeights = readonly [number, number, number, number, number];
export const DROP_TIER_WEIGHTS: Record<Rank, DropWeights> = {
  common: [75, 22, 3, 0, 0],
  elite: [35, 45, 17, 2, 1],
  /** The guaranteed item of a named elite (nietypowy or better, `dropGuaranteed`); its first roll is the elite's. */
  named: [0, 55, 40, 4, 1],
  /** The two items after the guaranteed rzadki (the boss's first item has its own set and unique chances below). */
  boss: [20, 50, 29, 0, 1],
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

/** The gwiazdki of a procedural side ticket (world/quests.ts): (base + perPlanet * planet + n * perUnit) rounded to 5. Planet 1 averages 22 (ITEMS 7.4; S18 lowered base 18 -> 8). */
export const QUEST_STARS = { base: 8, perPlanet: 14, perUnit: { kill: 2, fetch: 2, reach: 6, deliver: 12 } as Record<string, number> };

/** Permission card of the family from a named elite (ITEMS 6.3, S18): always, if the hero does not hold it. */
export const NAMED_PERMISSION_CHANCE = 1;

// ---------- S18: Reklamacja, the bin, przesyłka (ITEMS 6.4, 7.3, 7.4, 8) ----------
/** Share of rzadki drops of a common or elite that arrive as an awizo (a zestaw piece or a unique always do), max one per page. */
export const RZADKI_AWIZO_CHANCE = 0.3;
/** Zestaw piece price factor (ITEMS 7.1; a piece is a rzadki item, so the factor lives here, not in `TIER_PRICE_MUL`). */
export const ZESTAW_PRICE_MUL = 10;
/** Reklamacja: `RECLAIM_BASE x tier x (1 + RECLAIM_STEP x times reclaimed)` gwiazdki (ITEMS 7.3). */
export const RECLAIM_BASE = 10;
export const RECLAIM_STEP = 0.5;
/** Odrzuć do kosza pays this share of the list price (ITEMS 8); rzadki and up ask once first. */
export const BIN_SHARE = 0.1;
/** Pickup at the base paczkomat (ITEMS 8), and the runs an awizo waits there before it goes back to the sender. */
export const PACZKOMAT_FEE = 15;
export const AWIZO_RUNS_AT_BASE = 2;
/** In a run, the code arrives by SMS this many seconds after the paczkomat is reached (DESIGN 7). */
export const CODE_DELAY: readonly [number, number] = [6, 12];
/** The code is requested within CODE_REACH of the paczkomat (page units) and is lost if the player strays past CODE_KEEP before it arrives. */
export const CODE_REACH = 130;
export const CODE_KEEP = 230;
