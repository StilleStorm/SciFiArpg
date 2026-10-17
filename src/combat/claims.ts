import type { DamageType } from './damage';

/**
 * A claim (teza): the short text in the speech bubble over an enemy, and its type (DESIGN 5.2).
 * A hit whose type matches the claim is a rebuttal. Stub: enemies agent fills claim lists per family
 * and the combat agent adds the rebuttal rule (crit, strike the bubble, "nie na temat" note).
 */
export interface Claim {
  /** i18n key, e.g. 'enemies.urzadzenia.claim.update'. */
  textKey: string;
  type: DamageType;
}
