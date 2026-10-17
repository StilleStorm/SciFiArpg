/**
 * Typography rule (DESIGN 12.1): a one-letter Polish word (a, i, o, u, w, z) never ends a line.
 * The space after it becomes a non-breaking space, so it travels with the next word. This is a rule
 * for the renderer and for `t()`, not for the JSON, so the language files stay plain.
 *
 * The SVG wrappers (`wrapText`, `wrapClaim`) split on plain spaces only, so a bound pair stays one
 * word for them and needs no change.
 */
export const NBSP = ' ';

/** A one-letter word that is not the tail of a longer word, followed by one plain space. */
const ORPHAN = /(?<![\p{L}\p{N}_])([aiouwzAIOUWZ]) /gu;

/** Replace the space after every one-letter word with U+00A0. Idempotent. */
export function bindOrphans(text: string): string {
  return text.length < 3 ? text : text.replace(ORPHAN, `$1${NBSP}`);
}
