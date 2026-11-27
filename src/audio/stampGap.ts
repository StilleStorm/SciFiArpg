/**
 * The stamp's thud waits like the stamp itself: render/stampQueue.ts holds a stamp that comes within STAMP_GAP_MS of the last
 * one, so the sound for that 'stamp' event is delayed by the same rule and lands with the ink, not before it.
 */
/** Same gap as render/stampQueue.ts STAMP_GAP_MS (the two domains do not import each other). */
export const STAMP_SOUND_GAP_MS = 400;

/** For a stamp at `nowMs` with the slot free at `freeAtMs`: the delay to play it after, and when the slot is free again. Pure. */
export function stampSoundDelay(nowMs: number, freeAtMs: number, gapMs: number = STAMP_SOUND_GAP_MS): { delayMs: number; freeAtMs: number } {
  const delayMs = Math.max(0, freeAtMs - nowMs);
  return { delayMs, freeAtMs: nowMs + delayMs + gapMs };
}
