export type FamilyId = 'urzadzenia' | 'powiadomienia' | 'wygenerowane';

/** Stub. Enemies agent: stats, resist, traits (defect / escalation / existence), claims, assembler. */
export interface FamilyDef {
  id: FamilyId;
  /** i18n key of the family name, e.g. 'enemies.urzadzenia.name'. */
  nameKey: string;
}

export const FAMILIES: readonly FamilyDef[] = [];
