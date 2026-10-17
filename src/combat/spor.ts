import type { DamageType } from './damage';

/**
 * Spor (boss arguments), typed stubs only. Design: DESIGN section 5.4. At each boss phase the
 * boss posts a comment; three replies appear as margin buttons, one matches. Not implemented.
 */
export interface SporReply {
  /** i18n key of the reply button text. */
  textKey: string;
  type: DamageType;
}

export interface SporPrompt {
  /** i18n key of the boss comment (1-2 lines). */
  commentKey: string;
  /** Exactly three replies. */
  replies: readonly [SporReply, SporReply, SporReply];
  /** Index into `replies` of the one that matches the comment. */
  correct: 0 | 1 | 2;
}
