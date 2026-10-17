import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { FALLBACK_SCALES, TRIAD_TOL, TRITAVE_CENTS, containsTriad, degreeBelow, degreeCents, degreeFreq, rollScale, type Scale, type ScaleKind } from './scale';

const KINDS: ScaleKind[] = ['bp', 'mode7', 'penta'];

/** A second, independent subset check: every triple of notes (any repeats) against the 4:5:6 and 10:12:15 shapes. */
function hasTriadBruteForce(s: Scale, tol = TRIAD_TOL): boolean {
  const pool: number[] = [];
  for (let rep = 0; rep < 3; rep++) for (const d of s.degrees) pool.push(d + rep * s.periodCents);
  for (const a of s.degrees) {
    for (const b of pool) {
      for (const c of pool) {
        const third = b - a;
        const fifth = c - a;
        const isThird = Math.abs(third - 386.31) < tol || Math.abs(third - 315.64) < tol;
        if (isThird && Math.abs(fifth - 701.96) < tol) return true;
      }
    }
  }
  return false;
}

describe('triad detector', () => {
  it('finds the triads of the ordinary scales', () => {
    expect(containsTriad([0, 200, 400, 500, 700, 900, 1100], 1200)).toBe('major');
    expect(containsTriad([0, 200, 300, 500, 700, 800, 1000], 1200)).toBe('minor');
    expect(containsTriad([0, 200, 400, 700, 900], 1200)).toBe('major');
    expect(containsTriad([0, 300, 500, 700, 1000], 1200)).toBe('minor');
  });
});

describe('scales', () => {
  for (const kind of KINDS) {
    it(`${kind}: 200 rolled scales contain no major or minor triad as a subset`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const s = rollScale(createRng(seed * 7919), kind);
        expect(containsTriad(s.degrees, s.periodCents), `${kind} ${seed}`).toBeNull();
        expect(hasTriadBruteForce(s), `${kind} ${seed} brute force`).toBe(false);
      }
    });
    it(`${kind}: the fallback is triad-free too`, () => {
      const s = FALLBACK_SCALES[kind];
      expect(containsTriad(s.degrees, s.periodCents)).toBeNull();
      expect(hasTriadBruteForce(s)).toBe(false);
    });
  }

  it('Bohlen-Pierce has no octave: the period is the tritave and degrees are multiples of 1/13 of it', () => {
    const s = rollScale(createRng(5), 'bp');
    expect(s.periodCents).toBeCloseTo(TRITAVE_CENTS, 6);
    expect(s.degrees[0]).toBe(0);
    for (const d of s.degrees) {
      const step = d / (TRITAVE_CENTS / 13);
      expect(step).toBeCloseTo(Math.round(step), 6);
    }
    expect(s.degrees.length).toBeGreaterThanOrEqual(5);
    expect(s.degrees.length).toBeLessThanOrEqual(7);
  });

  it('the 7-note mode has seven degrees, two of them off the semitone grid', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = rollScale(createRng(seed), 'mode7');
      expect(s.degrees).toHaveLength(7);
      const off = s.degrees.filter((d) => Math.abs(d - Math.round(d / 100) * 100) > 20);
      expect(off).toHaveLength(2);
    }
  });

  it('the pentatonic has five degrees and exactly one wrong note', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = rollScale(createRng(seed), 'penta');
      expect(s.degrees).toHaveLength(5);
      const off = s.degrees.filter((d) => Math.abs(d - Math.round(d / 100) * 100) > 20);
      expect(off).toHaveLength(1);
      expect(s.degrees[s.wrong]).toBe(off[0]);
    }
  });

  it('degrees ascend, start at the root and stay inside the period', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = rollScale(createRng(seed));
      expect(s.degrees[0]).toBe(0);
      s.degrees.forEach((d, i) => {
        if (i > 0) expect(d).toBeGreaterThan(s.degrees[i - 1] ?? 0);
        expect(d).toBeLessThan(s.periodCents);
      });
    }
  });

  it('is deterministic per seed and varies between seeds', () => {
    expect(rollScale(createRng(11))).toEqual(rollScale(createRng(11)));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) seen.add(JSON.stringify(rollScale(createRng(seed)).degrees.map(Math.round)));
    expect(seen.size).toBeGreaterThan(20);
  });

  it('degree arithmetic wraps by periods, up and down', () => {
    const s = FALLBACK_SCALES.penta;
    expect(degreeCents(s, 0)).toBe(0);
    expect(degreeCents(s, 5)).toBe(1200);
    expect(degreeCents(s, 7)).toBe(1200 + 200);
    expect(degreeCents(s, -1)).toBe(-1200 + 400);
    expect(degreeFreq(s, 220, 5)).toBeCloseTo(440, 6);
  });

  it('the second voice sits below, near a fifth', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = rollScale(createRng(seed));
      for (let i = s.degrees.length * 2; i < s.degrees.length * 3; i++) {
        const below = degreeBelow(s, i);
        expect(below).toBeLessThan(i);
        const gap = degreeCents(s, i) - degreeCents(s, below);
        // the nearest degree to a fifth below: never closer than a second, never farther than a sixth in these scales
        expect(gap).toBeGreaterThan(200);
        expect(gap).toBeLessThan(1300);
      }
    }
  });
});
