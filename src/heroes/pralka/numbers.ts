/**
 * The numbers of the five skills Pralka gained in S19 (docs/SKILLS.md §1), her passives 8..10 and her two later ultimates.
 * One place, so that the casts, the per-step code, the tests and the texts read the same ones. Times are seconds, lengths are world
 * units, damage factors multiply the rolled hit (then `power`). The older five are in heroes/numbers.ts.
 */

/** Płukanie (skill 6): a splash at the nearest enemy within the range, else round her; every Nth cast in § 3 makes Wirowanie ready. */
export const PLUKANIE_R = 70;
export const PLUKANIE_RANGE = 170;
export const PLUKANIE_DAMAGE = 0.6;
export const PLUKANIE_EVERY = 3;

/** Program 90 (skill 7): a zone under her, damage per second in `TICK_S` steps, she is slowed while it runs. */
export const PROGRAM_R = 90;
export const PROGRAM_S = 3;
export const PROGRAM_DAMAGE = 0.4;
export const PROGRAM_SLOW = 0.7;
/** § 3: an enemy that leaves the zone is struck once more for this factor. */
export const PROGRAM_LEAVE = 0.8;

/** Tryb oszczędny (skill 8): less taken, slower, and a hit on her counts double for the rule. */
export const ECO_S = 4;
export const ECO_RESIST = 40;
export const ECO_RESIST_NIGHT = 25;
export const ECO_SLOW = 0.7;

/** Zmiana programu (skill 9): the price in racja of § 1 and § 2 (never fatal). */
export const ZMIANA_COST = 10;

/** Odpompowanie (skill 10): the puddle; loot inside slides out to the rim; § 2 deals damage per second inside; § 3 pulls to the centre. */
export const PUDDLE_R = 100;
export const PUDDLE_S = 5;
export const PUDDLE_SLIDE = 40;
export const PUDDLE_DAMAGE = 0.5;
export const PUDDLE_PULL = 20;

/** Passive 8 (Wersja 1.1): the rule fires every 7th hit instead of the 10th. */
export const WERSJA_HITS = 7;
/** Passive 9 (Gwarancja): once a page, below this share of racja, a foam shield of this size. */
export const GWARANCJA_BELOW = 0.2;
export const GWARANCJA_SHIELD = 40;
export const GWARANCJA_S = 5;
/** Passive 10 (Bęben pełny): each enemy Wirowanie pulls adds this share to her next offensive skill, up to the cap. */
export const BEBEN_STEP = 0.04;
export const BEBEN_CAP = 0.24;

/** Uznanie osobowości (ultimate 2): upór, the existence the hearers keep, damage per second. */
export const UZNANIE_RADIUS = 160;
export const UZNANIE_UPOR = 30;
export const UZNANIE_EXISTENCE = 0.3;
export const UZNANIE_DAMAGE = 0.8;
/** Reklamacja (ultimate 3): seconds of zgłoszony on every enemy, the lock of § 2 and how many it takes. */
export const REKLAMACJA_MARK_S = 8;
export const REKLAMACJA_LOCK_S = 2;
export const REKLAMACJA_LOCKED = 3;
/** The § signs drawn over the struck, at most. */
export const REKLAMACJA_SIGNS = 8;
