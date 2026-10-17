import { afterEach, describe, expect, it } from 'vitest';
import { activeTweens, clearTweens, tickTweens, tween } from './tween';

afterEach(clearTweens);

describe('tween', () => {
  it('honours delay, ends exactly at 1 and calls done once', () => {
    const seen: number[] = [];
    let done = 0;
    tween(100, (p) => seen.push(p), { delay: 50, done: () => done++ });
    tickTweens(40);
    expect(seen).toEqual([]);
    tickTweens(20); // 10 ms into the tween
    expect(seen[0]).toBeCloseTo(0.1);
    tickTweens(500);
    expect(seen.at(-1)).toBe(1);
    expect(done).toBe(1);
    tickTweens(100);
    expect(done).toBe(1);
    expect(activeTweens()).toBe(0);
  });
  it('cancel stops it', () => {
    let calls = 0;
    const cancel = tween(100, () => calls++);
    cancel();
    tickTweens(50);
    expect(calls).toBe(0);
  });
});
