import { must } from './util';

/** Seeded generator (mulberry32). Every gameplay roll goes through one of these. */
export interface Rng {
  readonly seed: number;
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [a, b). */
  range(a: number, b: number): number;
  /** Integer in [a, b], inclusive. */
  int(a: number, b: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Independent child stream; depends only on (seed, label), not on how much this stream was used. */
  fork(label: string): Rng;
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  const base = seed >>> 0;
  let s = base;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed: base,
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    pick: (items) => must(items[Math.floor(next() * items.length)], 'pick from empty list'),
    fork: (label) => createRng(Math.imul(base ^ hashString(label), 0x9e3779b1) >>> 0),
  };
}
