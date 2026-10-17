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

export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
  after(seconds: number, fn: () => void): () => void;
}

export function createLoop(h: LoopHandlers): Loop {
  const stepper = createStepper();
  const timers = createTimers();
  let raf = 0;
  let last = 0;
  let running = false;

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const alpha = stepper.advance(dt, (s) => {
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
  };
}
