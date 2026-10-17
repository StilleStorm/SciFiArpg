/**
 * Look-ahead step scheduler on the audio clock (DESIGN 14.5).
 *
 * The music is never timed by timers: each game frame calls `run(now)`, and every step that falls inside
 * `now + LOOKAHEAD_S` is handed to `onStep(time, counter)` with its exact audio-clock time. Frames that are
 * late by less than the look-ahead cost nothing. The driver is the game loop's render callback, gated to
 * one run per TICK_S, so there is no setTimeout and no setInterval anywhere.
 */
export const LOOKAHEAD_S = 0.1;
export const TICK_S = 0.025;

export interface StepScheduler {
  /** Start counting from `now` (first step at `now`). */
  reset(now: number): void;
  /** True when TICK_S has passed since the last run. */
  due(now: number): boolean;
  /** Emit every step that starts before `now + lookahead`; `stepDur` is asked per step (tempo may change). Returns the count. */
  run(now: number, stepDur: () => number, onStep: (time: number, counter: number) => void): number;
  readonly nextTime: number;
  readonly counter: number;
}

export function createScheduler(lookahead = LOOKAHEAD_S, tick = TICK_S): StepScheduler {
  let nextTime = 0;
  let counter = 0;
  let lastRun = -Infinity;
  let started = false;
  return {
    reset(now) {
      nextTime = now;
      counter = 0;
      lastRun = -Infinity;
      started = true;
    },
    due(now) {
      return now - lastRun >= tick;
    },
    run(now, stepDur, onStep) {
      if (!started) this.reset(now);
      lastRun = now;
      // After a long stall (tab in the background) do not play the missed steps in a burst.
      if (nextTime < now - 0.5) nextTime = now;
      let n = 0;
      while (nextTime < now + lookahead && n < 64) {
        onStep(nextTime, counter);
        nextTime += Math.max(0.02, stepDur());
        counter++;
        n++;
      }
      return n;
    },
    get nextTime() {
      return nextTime;
    },
    get counter() {
      return counter;
    },
  };
}
