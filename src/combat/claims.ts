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
  /** The claim was rebutted (the bubble is struck through); a refuted claim no longer matches. */
  struck?: boolean;
  /**
   * A claim that needs more than one rebuttal (the elite affix dwuetapowy, STORY 8.11): `of` rebuttals in all, `step` the one
   * it is on (1-based). `textKey` is then the bracketed variant of `base` ("... 1/2"), so a new step is a new bubble, drawn in.
   */
  step?: number;
  of?: number;
  /** The plain key the bracketed `textKey` was made from. */
  base?: string;
  /** Run time of the last rebuttal that moved the step on (one blow of many hits counts once). */
  stepAt?: number;
}

/** A hit of `type` is a rebuttal when it matches a claim that still stands. */
export function isRebuttal(claim: Claim | undefined, type: DamageType): boolean {
  return claim !== undefined && claim.struck !== true && claim.type === type;
}

/** Rebuttals a claim of the dwuetapowy affix needs. */
export const CLAIM_STEPS = 2;
/** Blows of one volley or one tick land within this many seconds and count as one rebuttal. */
export const STEP_GAP_S = 0.35;

/** The key of the bracketed variant of a claim text: `enemies.claim.<x>` becomes `enemies.claimStep.<x>.<step>`. */
export function stepKey(base: string, step: number): string {
  return `${base.replace(/^enemies\.claim\./, 'enemies.claimStep.')}.${step}`;
}

/** The claim turned into a two-step one (step 1 of 2); a claim that already is one, or is struck, stays as it is. */
export function staged(claim: Claim, of = CLAIM_STEPS): Claim {
  if (claim.of !== undefined || claim.struck === true) return claim;
  return { ...claim, base: claim.textKey, textKey: stepKey(claim.textKey, 1), step: 1, of };
}

/**
 * A rebuttal lands on the claim. A one-step claim is struck. A staged one moves to its next step (a new bubble, "2/2") and
 * is struck only by the last. Returns true when the bubble is struck now. `now` is the run time, to count one volley once.
 */
export function rebut(claim: Claim, now = 0): boolean {
  const of = claim.of ?? 1;
  const step = claim.step ?? 1;
  if (of > 1 && claim.stepAt !== undefined && now - claim.stepAt < STEP_GAP_S) return false; // the same volley
  if (of <= 1 || step >= of) {
    claim.struck = true;
    return true;
  }
  claim.step = step + 1;
  claim.stepAt = now;
  if (claim.base) claim.textKey = stepKey(claim.base, claim.step);
  return false;
}
