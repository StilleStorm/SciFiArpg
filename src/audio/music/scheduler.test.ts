import { describe, expect, it } from 'vitest';
import { LOOKAHEAD_S, TICK_S, createScheduler } from './scheduler';

describe('look-ahead scheduler', () => {
  it('uses a 100 ms look-ahead and a 25 ms tick', () => {
    expect(LOOKAHEAD_S).toBeCloseTo(0.1, 6);
    expect(TICK_S).toBeCloseTo(0.025, 6);
  });

  it('emits exactly the steps that start inside the look-ahead, once each, in order', () => {
    const s = createScheduler();
    const times: number[] = [];
    for (let now = 0; now < 2; now += 0.025) s.run(now, () => 0.25, (t) => times.push(t));
    expect(times).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
    // never scheduled earlier than now + look-ahead allows
    const s2 = createScheduler();
    let now = 0;
    for (now = 0; now < 5; now += 0.025) {
      s2.run(now, () => 0.2, (t) => {
        expect(t).toBeGreaterThanOrEqual(now - 1e-9);
        expect(t).toBeLessThan(now + LOOKAHEAD_S + 1e-9);
      });
    }
  });

  it('counts the steps and follows a tempo change on the next step', () => {
    const s = createScheduler();
    let dur = 0.4;
    const times: number[] = [];
    for (let now = 0; now < 3; now += 0.025) {
      if (now >= 1.5) dur = 0.2;
      s.run(now, () => dur, (t) => times.push(t));
    }
    const gaps = times.slice(1).map((t, i) => Math.round((t - (times[i] ?? 0)) * 100) / 100);
    expect(gaps[0]).toBe(0.4);
    expect(gaps[gaps.length - 1]).toBe(0.2);
    expect(s.counter).toBe(times.length);
  });

  it('after a stall (background tab) it does not play the missed steps in a burst', () => {
    const s = createScheduler();
    s.run(0, () => 0.25, () => undefined);
    const times: number[] = [];
    s.run(30, () => 0.25, (t) => times.push(t));
    expect(times.length).toBeLessThanOrEqual(2);
    expect(times[0]).toBeGreaterThanOrEqual(30 - 1e-9);
  });

  it('due() gates the ticks to 25 ms', () => {
    const s = createScheduler();
    s.run(1, () => 1, () => undefined);
    expect(s.due(1.01)).toBe(false);
    expect(s.due(1.03)).toBe(true);
  });

  it('reset starts the counting again from now', () => {
    const s = createScheduler();
    s.run(0, () => 0.1, () => undefined);
    s.reset(5);
    const times: number[] = [];
    s.run(5, () => 0.1, (t) => times.push(t));
    expect(times[0]).toBe(5);
    expect(s.counter).toBe(times.length);
  });
});
