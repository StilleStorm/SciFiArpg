/** Identifiers shared by the enemy modules and by the entity types. No logic here. */
export type FamilyId = 'urzadzenia' | 'powiadomienia' | 'wygenerowane';
export const FAMILY_IDS: readonly FamilyId[] = ['urzadzenia', 'powiadomienia', 'wygenerowane'];

export type BossId = 'prototyp' | 'weryfikacja' | 'hipoteza';
export const BOSS_OF: Record<FamilyId, BossId> = {
  urzadzenia: 'prototyp',
  powiadomienia: 'weryfikacja',
  wygenerowane: 'hipoteza',
};

/** Factory defects of the Urzadzenia family (DESIGN 6). One mechanic each. */
export type DefectId = 'spins' | 'limp' | 'thinks' | 'overheat' | 'firmware' | 'loud' | 'standby';

/** Elite affixes (DESIGN 6): aura, speed, extra racja, one teleport. */
export type EliteId = 'zweryfikowany' | 'sponsorowany' | 'nieuchronny' | 'domniemany';

export const DEFECT_IDS: readonly DefectId[] = ['spins', 'limp', 'thinks', 'overheat', 'firmware', 'loud', 'standby'];
export const ELITE_IDS: readonly EliteId[] = ['zweryfikowany', 'sponsorowany', 'nieuchronny', 'domniemany'];
