/**
 * The numbers of the five skills the Pętlowiec gained in S20 (docs/SKILLS.md §3), his passives 8..10 and his two later ultimates.
 * One place, so that the casts, the per-step code, the tests and the texts read the same ones. Times are seconds, lengths are world
 * units, damage factors multiply the rolled hit (then `power`). The older five are in heroes/numbers.ts.
 */

/** The SkillIndex of each skill past the fifth. */
export const IX = { uwaga: 5, powtorzenie: 6, paradoks: 7, opoznienie: 8, zamiana: 9 } as const;

/** Uwaga na marginesie (skill 6): a remark flies from him and from each copy to its own target. */
export const UWAGA_DAMAGE = 0.9;
export const UWAGA_SPEED = 420;
export const UWAGA_TTL = 0.7;
/** A copy looks for its own target this far; extra remarks (a paragraph's or a set's `count`) fan out by this angle (radians). */
export const UWAGA_COPY_RANGE = 280;
export const UWAGA_FAN = 0.2;

/** Powtórzenie (skill 7): a ruled line, drawn by him and by each copy; § 3 leaves it standing. */
export const POWTORZENIE_REACH = 180;
export const POWTORZENIE_DAMAGE = 0.7;
export const POWTORZENIE_HALF = 8;
export const POWTORZENIE_STAY_S = 2;
export const POWTORZENIE_STAY_DPS = 0.2;

/** Paradoks (skill 8): a clock-face zone; every hit inside comes back after a delay. */
export const PARADOKS_R = 110;
export const PARADOKS_S = 4;
export const PARADOKS_ECHO_DELAY_S = 0.5;
export const PARADOKS_ECHO = 0.5;
export const PARADOKS_MAX = 2;

/** Opóźnienie (skill 9): for this long the damage he takes is logged and applied this long later, at this share. */
export const OPOZNIENIE_S = 3;
export const OPOZNIENIE_SHARE = 0.5;

/** Zamiana miejsc (skill 10): the circle round the place he leaves, how long it is read toward the copy, how far an enemy may be to swap with. */
export const ZAMIANA_R = 90;
export const ZAMIANA_READ_S = 2;
export const ZAMIANA_ENEMY_RANGE = 260;
/** A copy of Przybycie stays this long before the duration of the paragraph (the older skill's constant). */
export const COPY_S = 8;

/** Passive 8 (Sprzeczność): a copy's hit of a type other than his last hit deals this share more. */
export const SPRZECZNOSC_BONUS = 0.15;
/** Passive 9 (Dziennik pokładowy): every Nth identical cast in a row is free. */
export const DZIENNIK_EVERY = 3;

/** The positions of him and of every enemy are noted this often, and kept this long (Cofnięcie zgłoszenia looks back up to 10 s). */
export const SNAP_STEP_S = 0.5;
export const SNAP_KEEP_S = 11;

/** Cofnięcie zgłoszenia (ultimate 2): seconds withdrawn (§ 2 withdraws more), the blow the remaining take, the lock of § 3. */
export const COFNIECIE_BACK_S = 6;
export const COFNIECIE_BACK_LONG_S = 10;
export const COFNIECIE_DAMAGE = 1.5;
export const COFNIECIE_LOCK_S = 2;

/** Przedwczesny powrót (ultimate 3): the capsule's circle, the blow, what the generated inside keep of their existence, § 2's push, § 3's gap between capsules. */
export const PRZEDWCZESNY_R = 100;
export const PRZEDWCZESNY_DAMAGE = 2.5;
export const PRZEDWCZESNY_EXISTENCE = 0.3;
export const PRZEDWCZESNY_PUSH = 90;
export const PRZEDWCZESNY_GAP_S = 0.5;
