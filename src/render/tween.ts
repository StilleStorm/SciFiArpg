/** Tiny tween list driven by the render loop (never setTimeout). One shared clock, in milliseconds. */
export type Ease = (p: number) => number;
export const linear: Ease = (p) => p;
export const easeOut: Ease = (p) => 1 - (1 - p) * (1 - p);
export const easeIn: Ease = (p) => p * p;

interface Tween {
  t: number;
  delay: number;
  dur: number;
  ease: Ease;
  step: (p: number) => void;
  done?: () => void;
  dead: boolean;
}

let active: Tween[] = [];

export interface TweenOpts {
  delay?: number;
  ease?: Ease;
  done?: () => void;
}

/** Call `step(p)` with p in 0..1 over `dur` ms. The last call is always p = 1. Returns a cancel function. */
export function tween(dur: number, step: (p: number) => void, opts: TweenOpts = {}): () => void {
  const tw: Tween = { t: 0, delay: opts.delay ?? 0, dur: Math.max(1, dur), ease: opts.ease ?? linear, step, done: opts.done, dead: false };
  active.push(tw);
  return () => {
    tw.dead = true;
  };
}

/** Advance all tweens by `dtMs`. Called once per rendered frame. */
export function tickTweens(dtMs: number): void {
  if (active.length === 0) return;
  const current = active;
  const finished: Tween[] = [];
  for (const tw of current) {
    if (tw.dead) continue;
    tw.t += dtMs;
    const local = tw.t - tw.delay;
    if (local < 0) continue;
    const p = Math.min(1, local / tw.dur);
    tw.step(tw.ease(p));
    if (p >= 1) finished.push(tw);
  }
  for (const tw of finished) tw.dead = true;
  active = active.filter((tw) => !tw.dead);
  for (const tw of finished) tw.done?.();
}

export function activeTweens(): number {
  return active.filter((tw) => !tw.dead).length;
}

/** Drop everything (tests, restart). */
export function clearTweens(): void {
  active = [];
}
