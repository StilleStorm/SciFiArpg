/** The numbers of the Kartograf's skills 6 to 10, his ultimates 2 and 3 and passives 8 to 10 (docs/SKILLS.md section 4). The first five keep theirs in heroes/numbers.ts. */

/** Indices of the skills in `def.ts` (the hero's own order; the first five are the original kit). */
export const IX = { triangulacja: 0, teren: 1, korekta: 2, skala: 3, legenda: 4, pomiar: 5, przekroj: 6, granica: 7, odniesienia: 8, roza: 9 } as const;

/** Pomiar: damage, the hit on the same enemy that marks it, seconds the mark holds. */
export const POMIAR_DAMAGE = 0.9;
export const POMIAR_MARK_AT = 3;
export const POMIAR_MARK_S = 3;
/** Pomiar § 2 przyblizony: how far from the first the second may stand. */
export const POMIAR_SECOND_R = 200;

/** Przekroj: lines in the fan, the fan's opening (degrees), the reach, damage of each, half the width of a line, seconds a line stays drawn (§ 3 keeps it longer). */
export const PRZEKROJ_LINES = 5;
export const PRZEKROJ_FAN_DEG = 40;
export const PRZEKROJ_REACH = 220;
export const PRZEKROJ_DAMAGE = 0.5;
export const PRZEKROJ_HALF = 8;
export const PRZEKROJ_SHOW_S = 0.6;

/** Granica: length across the aim, seconds, how far ahead of him it is put, the push of a crosser, the seconds of its status, § 2 damage of a crosser. */
export const GRANICA_LEN = 160;
export const GRANICA_S = 4;
export const GRANICA_FRONT = 70;
export const GRANICA_PUSH = 60;
export const GRANICA_STATUS_S = 1;
export const GRANICA_DAMAGE = 0.8;

/** Punkt odniesienia: seconds it stands, the seconds § 2 shortens it to, the interval and reach of § 3 pulling the eyes, how long they read, the angle within which a drag toward it is a blink to it. */
export const ODNIESIENIA_S = 20;
export const ODNIESIENIA_PULL_EVERY_S = 4;
export const ODNIESIENIA_PULL_R = 90;
export const ODNIESIENIA_PULL_S = 1;
export const ODNIESIENIA_BLINK_DEG = 25;

/** Roza wiatrow: radius, push, seconds of do_weryfikacji, § 2 damage, seconds the rose stays drawn. */
export const ROZA_R = 140;
export const ROZA_PUSH = 90;
export const ROZA_STATUS_S = 1;
export const ROZA_DAMAGE = 0.9;
export const ROZA_SHOW_S = 1.2;

/** Passive 8, Odleglosc w linii prostej: a share per ten units to the target, and the most it gives. */
export const ODLEGLOSC_STEP = 0.01;
export const ODLEGLOSC_MAX = 0.2;

/** Passive 9, Blad pomiaru: seconds a decoy lasts longer, the damage it deals to whoever touches it (of the roll), the seconds between two such blows. */
export const BLAD_EXTRA_S = 2;
export const BLAD_DAMAGE = 0.5;
export const BLAD_EVERY_S = 1;

/** Passive 10, Trzeci punkt: the hit that is a rebuttal, and the seconds after which an enemy's count is forgotten. */
export const TRZECI_AT = 3;
export const TRZECI_FORGET_S = 6;

/** The rule, passive 7 (Mapa z gory): an enemy must be this near to be named; the family names. */
export const NAME_SIGHT = 380;

/** Skreslenie z mapy: the rectangle (width, height), the ceiling for an existence to be crossed out, damage, the existence the rest are held at, how far from him it may be put. */
export const SKRESLENIE_W = 200;
export const SKRESLENIE_H = 140;
export const SKRESLENIE_BELOW = 0.5;
export const SKRESLENIE_DAMAGE = 2.5;
export const SKRESLENIE_EXISTENCE = 0.3;
export const SKRESLENIE_PLACE = 200;
export const SKRESLENIE_R = 125;

/** Pomiar kontrolny: rays from the point (§ 1 and § 3, § 2), the reach of a ray, damage of each, the radius of the crossing, how far from him the point may be, seconds the crossing stays a benchmark (§ 3). */
export const KONTROLNY_RAYS = 3;
export const KONTROLNY_RAYS_TWO = 6;
export const KONTROLNY_REACH = 200;
export const KONTROLNY_DAMAGE = 1.8;
export const KONTROLNY_CROSS_R = 26;
export const KONTROLNY_PLACE = 200;
export const KONTROLNY_BENCH_S = 20;
