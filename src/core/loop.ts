export const STEP = 1 / 60;
const MAX_FRAME = 0.25;

/** Fixed-step accumulator. Pure, so it can be unit tested without rAF. */
export function createStepper(step = STEP, maxFrame = MAX_FRAME) {
  let acc = 0;
  return {
    /** Feed a frame delta (seconds); calls `update(step)` zero or more times; returns blend alpha. */
    advance(frameDt: number, update: (dt: number) => void): number {
      acc += Math.min(frameDt, maxFrame);
      while (acc >= step) {
        update(step);
        acc -= step;
      }
      return acc / step;
    },
    reset(): void {
      acc = 0;
    },
  };
}

/** Timers advanced by the loop's update step (never setTimeout for game logic). */
export function createTimers() {
  interface Timer {
    left: number;
    fn: () => void;
    dead: boolean;
  }
  let timers: Timer[] = [];
  return {
    /** Run `fn` after `seconds` of loop time. Returns a cancel function. */
    after(seconds: number, fn: () => void): () => void {
      const t: Timer = { left: seconds, fn, dead: false };
      timers.push(t);
      return () => {
        t.dead = true;
      };
    },
    update(dt: number): void {
      const due: Timer[] = [];
      for (const t of timers) {
        t.left -= dt;
        if (t.left <= 0 && !t.dead) due.push(t);
      }
      timers = timers.filter((t) => t.left > 0 && !t.dead);
      for (const t of due) t.fn();
    },
    get size(): number {
      return timers.length;
    },
  };
}

export interface LoopHandlers {
  /** Fixed step, dt in seconds. */
  update(dt: number): void;
  /** Once per animation frame; `frameDt` in seconds (clamped), `alpha` = blend between steps. */
  render(frameDt: number, alpha: number): void;
}

/** The longest hit-stop (DESIGN 14.1: 40 ms on crits and kills). */
export const FREEZE_MAX_MS = 40;
/** After a freeze ends, this long must pass before the next one can start (a swarm of kills must not lock the game). */
export const FREEZE_REST_MS = 90;

/** Hit-stop bookkeeping, pure: `request` asks for a freeze, `frame(dtMs)` says whether this frame is frozen. */
export function createFreezer(maxMs = FREEZE_MAX_MS, restMs = FREEZE_REST_MS) {
  let frozen = 0;
  let rest = 0;
  return {
    request(ms: number): boolean {
      if (rest > 0 || frozen > 0 || ms <= 0) return false;
      frozen = Math.min(maxMs, ms);
      return true;
    },
    /** True while the simulation must hold this frame. */
    frame(dtMs: number): boolean {
      if (frozen > 0) {
        frozen -= dtMs;
        if (frozen <= 0) rest = restMs;
        return true;
      }
      rest = Math.max(0, rest - dtMs);
      return false;
    },
    get frozen(): boolean {
      return frozen > 0;
    },
  };
}

export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
  after(seconds: number, fn: () => void): () => void;
  /** The simulation and its timers hold (the pause sheet); frames keep rendering. Nothing is replayed on resume. */
  pause(): void;
  resume(): void;
  readonly paused: boolean;
  /** Hit-stop: the simulation holds for `ms` (at most FREEZE_MAX_MS) while frames keep rendering. */
  freeze(ms: number): void;
}

export function createLoop(h: LoopHandlers): Loop {
  const stepper = createStepper();
  const timers = createTimers();
  let raf = 0;
  let last = 0;
  let running = false;
  const freezer = createFreezer();
  let held = false;

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Hit-stop: no simulation while frozen; the accumulator keeps what it had so nothing is lost or replayed.
    const frozen = freezer.frame(dt * 1000);
    const alpha = stepper.advance(frozen || held ? 0 : dt, (s) => {
      timers.update(s);
      h.update(s);
    });
    h.render(dt, alpha);
  };
  const begin = (): void => {
    if (running) return;
    running = true;
    last = performance.now();
    stepper.reset();
    raf = requestAnimationFrame(frame);
  };
  const halt = (): void => {
    running = false;
    cancelAnimationFrame(raf);
  };
  let wanted = false;
  document.addEventListener('visibilitychange', () => {
    if (!wanted) return;
    if (document.hidden) halt();
    else begin();
  });
  return {
    start() {
      wanted = true;
      if (!document.hidden) begin();
    },
    stop() {
      wanted = false;
      halt();
    },
    get running() {
      return running;
    },
    after: timers.after,
    pause() {
      held = true;
    },
    resume() {
      held = false;
    },
    get paused() {
      return held;
    },
    freeze(ms) {
      freezer.request(ms);
    },
  };
}
