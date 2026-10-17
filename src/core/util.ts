/** Unwrap a value that must exist (replaces `!`). Throws with a message if it does not. */
export function must<T>(v: T | null | undefined, what = 'value'): T {
  if (v === null || v === undefined) throw new Error(`missing ${what}`);
  return v;
}
