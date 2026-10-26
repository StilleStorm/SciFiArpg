/** The numbers of the Nalesnik's skills 6 to 10, his ultimates 2 and 3 and passives 8 to 10 (docs/SKILLS.md section 5). The first five keep theirs in heroes/numbers.ts and nalesnik/steps.ts. */

/** Indices of the skills in `def.ts` (the hero's own order; the first five are the original kit). */
export const IX = { orbita: 0, grawitacja: 1, wniosek: 2, plywy: 3, ksiezyc: 4, krawedz: 5, pierscien: 6, zaokraglenie: 7, upadek: 8, zmiana: 9 } as const;

/** Krawedz: the length of the short roll, its seconds, the damage on the target (§ 2: on all on the path), how near counts as touching, seconds of the § 3 marker. */
export const KRAWEDZ_LEN = 80;
export const KRAWEDZ_S = 0.2;
export const KRAWEDZ_DAMAGE = 0.8;
export const KRAWEDZ_TOUCH = 6;
export const KRAWEDZ_MARK_S = 1;

/** Pierscien: the middle of the band round him and half its width (§ 2 shifts the middle in, `reach` 0.62), seconds, damage per crossing, seconds of the marker, the existence § 3 sets on the Wygenerowane that cross. */
export const PIERSCIEN_MID = 105;
export const PIERSCIEN_HALF = 15;
export const PIERSCIEN_S = 4;
export const PIERSCIEN_DAMAGE = 0.6;
export const PIERSCIEN_MARK_S = 1;
export const PIERSCIEN_EXISTENCE = 0.5;

/** Zaokraglenie: seconds, upor, the share of damage not taken (resist, all three types), the speed factor; § 3 (flat): melee is taken this much more, projectiles skim off entirely. */
export const ZAOKR_S = 3;
export const ZAOKR_UPOR = 20;
export const ZAOKR_RESIST = 35;
export const ZAOKR_SPEED = 0.8;
export const ZAOKR_FLAT_MELEE = 20;

/** Upadek na powierzchnie: how far the hop goes, the radius it lands in, the damage, the push, seconds he is round after it, the crater of § 3 (seconds, damage a second). */
export const UPADEK_RANGE = 140;
export const UPADEK_R = 100;
export const UPADEK_DAMAGE = 1.6;
export const UPADEK_PUSH = 50;
export const UPADEK_ROUND_S = 2;
export const KRATER_S = 3;
export const KRATER_DAMAGE = 0.3;

/** Zmiana orbity: how far the curve goes, its seconds, the bend (the control point stands this share of the length to the side), seconds of the marker, § 2 damage, § 3 ring radius. */
export const ZMIANA_REACH = 200;
export const ZMIANA_S = 0.4;
export const ZMIANA_BEND = 0.35;
export const ZMIANA_MARK_S = 2;
export const ZMIANA_DAMAGE = 0.7;
export const ZMIANA_RING_R = 80;

/** Passive 8, Pory: the share of a skimmed projectile's blow returned to its sender (mechaniczny). */
export const PORY_RETURN = 0.3;
/** Passive 9, Masa krytyczna: the share each enemy pulled adds to the next ofensywna, and the most it gives. */
export const MASA_STEP = 0.03;
export const MASA_MAX = 0.3;
/** Passive 10, Satelita staly: the damage a second of the satellite (of Orbita). */
export const SATELITA_DAMAGE = 0.2;

/** Zderzenie: the length of the roll, its seconds, the damage to all on the path, how near the path counts, the crater (radius, seconds), the Teren zones of § 2 (spacing, radius, seconds). */
export const ZDERZENIE_REACH = 600;
export const ZDERZENIE_S = 0.5;
export const ZDERZENIE_DAMAGE = 3;
export const ZDERZENIE_TOUCH = 8;
export const ZDERZENIE_PLACE = 300;
export const ZDERZENIE_CRATER_R = 70;
export const ZDERZENIE_CRATER_S = 4;
export const ZDERZENIE_TEREN_EVERY = 110;
export const ZDERZENIE_TEREN_R = 50;

/** Pelnia: moons, seconds, the orbit it widens from and to (over the seconds), the damage of a pass, the upor on top of the moon's own 10, the knock of § 2. */
export const PELNIA_MOONS = 3;
export const PELNIA_S = 8;
export const PELNIA_FROM = 90;
export const PELNIA_TO = 160;
export const PELNIA_DAMAGE = 0.7;
export const PELNIA_UPOR = 20;
export const PELNIA_KNOCK = 40;
export const PELNIA_TWO_MOONS_S = 14;
