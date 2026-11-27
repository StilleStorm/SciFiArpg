/**
 * The stamp queue (S28): two stamps struck within a second overprinted (ZWERYFIKOWANO then WYCOFANO). A stamp that finds the
 * last one less than STAMP_GAP_MS old waits for the gap; a third waits behind the second. Driven by the tween clock, never setTimeout.
 */
import { tween } from './tween';

/** The quiet between two stamps slamming onto the page, ms. */
export const STAMP_GAP_MS = 400;

/** Milliseconds until the next slot is free. */
let busy = 0;
let cancelDrain: (() => void) | null = null;

/** The wait a stamp requested now would get (ms), without taking the slot. */
export function stampWait(): number {
  return busy;
}

/** Strike a stamp: `run` is called now when the page is quiet, else after the wait. Returns the wait in ms. */
export function queueStamp(run: () => void): number {
  const delay = busy;
  const total = delay + STAMP_GAP_MS;
  busy = total;
  cancelDrain?.();
  cancelDrain = tween(
    total,
    (p) => {
      busy = total * (1 - p);
    },
    {
      done: () => {
        busy = 0;
        cancelDrain = null;
      },
    },
  );
  if (delay <= 0) run();
  else tween(1, () => undefined, { delay, done: run });
  return delay;
}

/** Forget the queue (tests, restart). */
export function resetStampQueue(): void {
  cancelDrain?.();
  busy = 0;
  cancelDrain = null;
}
