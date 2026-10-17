import { describe, expect, it } from 'vitest';
import { createBus } from './events';
import { createStepper, createTimers } from './loop';
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
