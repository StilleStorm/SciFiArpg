/** The numbers of the Konsultant's skills 6 to 10 and of his passives (docs/SKILLS.md section 2). The first five keep theirs in heroes/numbers.ts. */

/** Indices of the skills in `def.ts` (the hero's own order; the first five are the original kit). */
export const IX = { prosze: 0, przekierowuje: 1, pomoc: 2, numer: 3, rozlaczenie: 4, zgloszenie: 5, formularz: 6, muzyka: 7, przerwa: 8, oddzwonimy: 9 } as const;

/** Zgloszenie przyjete: damage of the ticket, how far it bounces, the fan (degrees between tickets), how far a ticket flies. */
export const ZGLOSZENIE_DAMAGE = 0.8;
export const ZGLOSZENIE_BOUNCE_R = 90;
export const ZGLOSZENIE_FAN_DEG = 20;
export const ZGLOSZENIE_REACH = 300;
export const ZGLOSZENIE_HALF = 10;

/** Formularz kontaktowy: radius, seconds, damage per second (of the roll), seconds a "pole obowiazkowe" holds, how far past the rim. */
export const FORMULARZ_R = 60;
export const FORMULARZ_S = 3;
export const FORMULARZ_DPS = 0.3;
export const FORMULARZ_CAGE_S = 1.5;
export const FORMULARZ_REACH = 300;

/** Muzyka w sluchawce: seconds, radius, the share of damage taken it takes off (before the paragraph). */
export const MUZYKA_S = 4;
export const MUZYKA_R = 120;
export const MUZYKA_REDUCTION = 0.3;

/** Przerwa techniczna: how far he steps back, seconds the chair holds the enemies, the reach of the chair's pull, how far it strikes back. */
export const PRZERWA_STEP = 120;
export const PRZERWA_S = 2;
export const PRZERWA_PULL_R = 100;
export const PRZERWA_STRIKE_R = 34;

/** Oddzwonimy: seconds before the phone rings, radius it calls, seconds the callers stay przeczytane, the share of the radius the blow reaches, damage, throw. */
export const ODDZWONIMY_DELAY_S = 3;
export const ODDZWONIMY_R = 110;
export const ODDZWONIMY_HOLD_S = 1.6;
export const ODDZWONIMY_BLOW_SHARE = 0.7;
export const ODDZWONIMY_DAMAGE = 1.2;
export const ODDZWONIMY_THROW = 120;
export const ODDZWONIMY_REACH = 300;

/** Passive 8, Numerek: crit per step of the queue, and the most it gives, and for how long after the last kill. */
export const NUMEREK_STEP = 0.03;
export const NUMEREK_MAX = 0.15;
export const NUMEREK_S = 8;

/** Passive 9, Polaczenie nagrywane: seconds the bubble lies on the floor, and how close an enemy must step to it. */
export const NAGRANIE_S = 3;
export const NAGRANIE_R = 26;

/** Passive 10, Wstrzymanie oplat: the cut per Czy moge jeszcze w czyms pomoc, and its ceiling. */
export const OPLATY_STEP = 0.1;
export const OPLATY_MAX = 0.3;

/** Koniec kolejki: radius, seconds, damage, throw, the line's spacing and how far in front of him it starts. */
export const KONIEC_R = 220;
export const KONIEC_S = 2;
export const KONIEC_DAMAGE = 1.6;
export const KONIEC_THROW = 160;
export const KONIEC_GAP = 40;
export const KONIEC_FRONT = 64;
export const KONIEC_MAX = 8;

/** Ankieta: radius, seconds of rating, damage, where the form may be put at most from him. */
export const ANKIETA_R = 160;
export const ANKIETA_S = 3;
export const ANKIETA_RATE_S = 2;
export const ANKIETA_DAMAGE = 2;
export const ANKIETA_PLACE = 200;
