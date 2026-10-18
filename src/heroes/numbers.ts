/**
 * The numbers of the fourth and fifth skills (DESIGN 10.1). One place, so that the skills, the per-step code, the aim preview and the
 * tests read the same ones. Times are seconds, lengths are world units, damage factors multiply the rolled hit (then `power`).
 */

/** Pralka: Otwarcie bebna (skill 3), Wniosek o osobowosc (skill 4). */
export const BEBEN_REACH = 150;
export const BEBEN_HALF = (35 * Math.PI) / 180;
export const BEBEN_DAMAGE = 1.3;
export const BEBEN_KNOCKBACK = 40;
export const BEBEN_VERIFY_S = 3;
export const READING_S = 6;
export const READING_R = 140;
export const READING_DAMAGE = 0.35;
export const READING_EXISTENCE = 0.5;
export const READING_UPOR = 20;

/** Konsultant: Numer sprawy (skill 3), Rozlaczenie (skill 4). */
export const NUMER_S = 6;
export const NUMER_BONUS = 0.35;
export const NUMER_STAMP_DAMAGE = 0.5;
export const NUMER_HANDOVERS = 3;
export const NUMER_HANDOVER_R = 160;
export const ROZLACZENIE_REACH = 220;
export const ROZLACZENIE_THROW = 180;
export const ROZLACZENIE_BLOCK_S = 2;
export const ROZLACZENIE_DAMAGE = 1;
export const ROZLACZENIE_BELOW = 0.25;
/** Half the width of the line of the call, for who is on it (on top of the enemy's own radius). */
export const ROZLACZENIE_HALF = 6;

/** Petlowiec: Juz to bylo (skill 3), Odlozony start (skill 4). */
export const JUZ_SPREAD = 0.22;
export const START_R = 90;
export const START_DELAY_S = 0.8;
export const START_DAMAGE = 2;
export const START_KNOCKBACK = 60;
export const START_READ_S = 2;

/** Kartograf: Skala 1:1 (skill 3), Legenda (skill 4). */
export const SKALA_S = 5;
export const SKALA_RANGE = 1.6;
export const SKALA_VERIFY_S = 1.5;
export const LEGENDA_R = 130;
export const LEGENDA_S = 4;
export const LEGENDA_DAMAGE = 0.35;
export const LEGENDA_NAMES = 6;

/** Nalesnik: Plywy (skill 3), Ksiezyc (skill 4). */
export const PLYWY_R = 160;
export const PLYWY_S = 0.4;
export const PLYWY_PUSH = 70;
export const PLYWY_DAMAGE = 1.2;
export const KSIEZYC_ORBIT = 90;
export const KSIEZYC_RATE = 1.4;
export const KSIEZYC_S = 8;
export const KSIEZYC_DAMAGE = 0.5;
export const KSIEZYC_HIT_R = 10;
export const KSIEZYC_GAP_S = 0.6;
export const KSIEZYC_UPOR = 10;
/** How fast the pebble leaves the hand on its way to the circle (units per second). */
export const KSIEZYC_LAUNCH = 420;

/** Per-second effects (the reading, the legend) are applied this often, each tick with its share of the factor per second. */
export const TICK_S = 0.5;
