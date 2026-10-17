import type { RunState } from './run';

export type LawId =
  | 'parzystosc'
  | 'grawitacja'
  | 'godziny-konsultanta'
  | 'czas-wsteczny'
  | 'wymagana-aktualizacja'
  | 'nie-przeszkadzac'
  | 'oplata-serwisowa'
  | 'ciasteczka'
  | 'weryfikacja-dwuetapowa';

export interface Law {
  id: LawId;
  /** i18n keys, e.g. 'laws.parzystosc.name' and 'laws.parzystosc.text'. */
  nameKey: string;
  textKey: string;
}

const law = (id: LawId): Law => ({ id, nameKey: `laws.${id}.name`, textKey: `laws.${id}.text` });

/** The regulamin clauses of DESIGN section 4. Names only; the laws agent implements the modifiers. */
export const LAWS: readonly Law[] = [
  law('parzystosc'),
  law('grawitacja'),
  law('godziny-konsultanta'),
  law('czas-wsteczny'),
  law('wymagana-aktualizacja'),
  law('nie-przeszkadzac'),
  law('oplata-serwisowa'),
  law('ciasteczka'),
  law('weryfikacja-dwuetapowa'),
];

/** Stub: apply a regulamin clause to the run. Currently a no-op for every law. */
export function applyLaw(state: RunState, lawId: LawId): void {
  void state;
  void lawId;
}
