import { describe, expect, it } from 'vitest';
import { createBus } from './events';
import { createFreezer, createStepper, createTimers, FREEZE_MAX_MS, FREEZE_REST_MS } from './loop';
import { createRng } from './rng';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(5);
    const b = createRng(5);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    expect(createRng(6).next()).not.toBe(createRng(5).next());
  });
  it('fork depends on label only, not on draws', () => {
    const a = createRng(9);
    const b = createRng(9);
    a.next();
    a.next();
    expect(a.fork('page').next()).toBe(b.fork('page').next());
    expect(a.fork('page').next()).not.toBe(a.fork('loot').next());
  });
  it('int is inclusive and pick throws on empty', () => {
    const r = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(r.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
    expect(() => r.pick([])).toThrow();
  });
});

describe('stepper', () => {
  it('runs fixed steps and carries the remainder', () => {
    const s = createStepper(1 / 60);
    let n = 0;
    s.advance(0.05, () => n++);
    expect(n).toBe(3);
    s.advance(0.05, () => n++);
    expect(n).toBe(6);
  });
  it('clamps huge frames', () => {
    const s = createStepper(1 / 60, 0.25);
    let n = 0;
    s.advance(10, () => n++);
    expect(n).toBe(15);
  });
});

describe('timers', () => {
  it('fires after the delay and can be cancelled', () => {
    const t = createTimers();
    const hits: string[] = [];
    t.after(0.1, () => hits.push('a'));
    const cancel = t.after(0.1, () => hits.push('b'));
    cancel();
    for (let i = 0; i < 5; i++) t.update(1 / 60);
    expect(hits).toEqual([]);
    for (let i = 0; i < 2; i++) t.update(1 / 60);
    expect(hits).toEqual(['a']);
    expect(t.size).toBe(0);
  });
});

describe('bus', () => {
  it('delivers typed payloads and unsubscribes', () => {
    const bus = createBus();
    const got: number[] = [];
    const off = bus.on('enemy:miss', (p) => got.push(p.id));
    bus.emit('enemy:miss', { id: 3 });
    off();
    bus.emit('enemy:miss', { id: 4 });
    expect(got).toEqual([3]);
  });
});

describe('hit-stop', () => {
  it('holds the simulation for the requested time, never more than 40 ms', () => {
    expect(FREEZE_MAX_MS).toBe(40);
    const f = createFreezer();
    expect(f.request(500)).toBe(true);
    let frozenFor = 0;
    while (f.frame(16.7)) frozenFor += 16.7;
    expect(frozenFor).toBeGreaterThanOrEqual(FREEZE_MAX_MS - 0.1);
    expect(frozenFor).toBeLessThan(FREEZE_MAX_MS + 17);
  });

  it('ignores a request while frozen and during the rest after it, then works again', () => {
    const f = createFreezer();
    expect(f.request(40)).toBe(true);
    expect(f.request(40)).toBe(false);
    while (f.frame(10)) {
      /* run it out */
    }
    expect(f.request(40)).toBe(false);
    f.frame(FREEZE_REST_MS + 1);
    expect(f.request(40)).toBe(true);
  });

  it('a frame without a freeze is not held, and a zero request does nothing', () => {
    const f = createFreezer();
    expect(f.frame(16)).toBe(false);
    expect(f.request(0)).toBe(false);
    expect(f.frozen).toBe(false);
  });
});
