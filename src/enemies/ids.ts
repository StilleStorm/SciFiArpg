/** Identifiers shared by the enemy modules and by the entity types. No logic here. */
export type FamilyId = 'urzadzenia' | 'powiadomienia' | 'wygenerowane';
export const FAMILY_IDS: readonly FamilyId[] = ['urzadzenia', 'powiadomienia', 'wygenerowane'];

export type BossId = 'prototyp' | 'weryfikacja' | 'hipoteza' | 'ankieta';
export const BOSS_OF: Record<FamilyId, BossId> = {
  urzadzenia: 'prototyp',
  powiadomienia: 'weryfikacja',
  wygenerowane: 'hipoteza',
};
/** The family a boss body belongs to. A planet may name a body of its family other than `BOSS_OF` (planet 6: Ankieta, Powiadomienia). */
export const BOSS_FAMILY: Record<BossId, FamilyId> = {
  prototyp: 'urzadzenia',
  weryfikacja: 'powiadomienia',
  hipoteza: 'wygenerowane',
  ankieta: 'powiadomienia',
};

/** Factory defects of the Urzadzenia family (DESIGN 6). One mechanic each. */
export type DefectId = 'spins' | 'limp' | 'thinks' | 'overheat' | 'firmware' | 'loud' | 'standby';

/** Elite affixes (DESIGN 6): aura, speed, extra racja, one teleport; S9 adds six more (enemies/elites.ts holds their mechanics). */
export type EliteId =
  | 'zweryfikowany'
  | 'sponsorowany'
  | 'nieuchronny'
  | 'domniemany'
  | 'pilny'
  | 'odnawialny'
  | 'powielony'
  | 'poufny'
  | 'nadgorliwy'
  | 'wielokrotny'
  | 'oddzwaniajacy'
  | 'dwuetapowy';

export const DEFECT_IDS: readonly DefectId[] = ['spins', 'limp', 'thinks', 'overheat', 'firmware', 'loud', 'standby'];
export const ELITE_IDS: readonly EliteId[] = [
  'zweryfikowany',
  'sponsorowany',
  'nieuchronny',
  'domniemany',
  'pilny',
  'odnawialny',
  'powielony',
  'poufny',
  'nadgorliwy',
  'wielokrotny',
];

/** The two affixes of Akt II (planets 4-6, STORY 8.11): they join the pool there and nowhere else, so Akt I rolls stay as they were. */
export const AKT2_ELITE_IDS: readonly EliteId[] = ['oddzwaniajacy', 'dwuetapowy'];
/** First and last planet index (0-based) of Akt II. */
export const AKT2_PLANETS = [3, 5] as const;

/** The affixes a spawner may roll on a planet (0-based index; undefined = no plan): the ten, plus the two of Akt II on planets 4-6. */
export function eliteIdsFor(planet: number | undefined): readonly EliteId[] {
  return planet !== undefined && planet >= AKT2_PLANETS[0] && planet <= AKT2_PLANETS[1] ? [...ELITE_IDS, ...AKT2_ELITE_IDS] : ELITE_IDS;
}
