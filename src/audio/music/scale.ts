/**
 * The strange fixed scales of the music (DESIGN 14.4): never major, never minor.
 *
 * A scale is a list of degrees in cents above the root, repeating every `periodCents`. Three families:
 *  - `bp`:    a subset of the 13-step Bohlen-Pierce tritave (3:1), so there are no octaves at all;
 *  - `mode7`: seven of the twelve semitones with two degrees detuned by 35-50 cents;
 *  - `penta`: five of the twelve semitones with one wrong note (a degree pushed 55-75 cents off).
 * Every rolled scale is rejected until `containsTriad` finds no major or minor triad in it, so a
 * 4:5:6 or 10:12:15 chord cannot be built from its notes however the roll is read.
 */
import type { Rng } from '../../core/rng';

export type ScaleKind = 'bp' | 'mode7' | 'penta';

export interface Scale {
  kind: ScaleKind;
  /** Length of one repeat in cents (1200, or the tritave for Bohlen-Pierce). */
  periodCents: number;
  /** Ascending, first is 0, all below `periodCents`. */
  degrees: number[];
  /** Index of the wrong note (`penta`), or -1. */
  wrong: number;
}

export const TRITAVE_CENTS = 1200 * Math.log2(3);
/** How close (cents) three notes must be to 4:5:6 or 10:12:15 to count as a triad. */
export const TRIAD_TOL = 40;
const M3 = 386.31;
const MIN3 = 315.64;
const P5 = 701.96;

function combos(n: number, k: number, rng: Rng): number[] {
  // A random k-subset of 1..n-1 plus the root 0, ascending.
  const pool = Array.from({ length: n - 1 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const a = pool[i] ?? 0;
    pool[i] = pool[j] ?? 0;
    pool[j] = a;
  }
  return [0, ...pool.slice(0, k - 1).sort((a, b) => a - b)];
}

/** The first major or minor triad hidden in `cents` (mod `period`), or null. Notes may sit in different repeats. */
export function containsTriad(cents: readonly number[], period: number, tol = TRIAD_TOL): 'major' | 'minor' | null {
  const ext = [...cents, ...cents.map((c) => c + period), ...cents.map((c) => c + 2 * period)];
  for (const a of cents) {
    const has = (interval: number): boolean => ext.some((c) => Math.abs(c - a - interval) < tol);
    if (!has(P5)) continue;
    if (has(M3)) return 'major';
    if (has(MIN3)) return 'minor';
  }
  return null;
}

const bpStep = (s: number): number => (s * TRITAVE_CENTS) / 13;

/** Used only if the random search somehow fails; checked triad-free in the tests. */
export const FALLBACK_SCALES: Record<ScaleKind, Scale> = {
  bp: { kind: 'bp', periodCents: TRITAVE_CENTS, degrees: [0, 1, 2, 3, 4, 8].map(bpStep), wrong: -1 },
  mode7: { kind: 'mode7', periodCents: 1200, degrees: [0, 60, 240, 300, 400, 500, 600], wrong: -1 },
  penta: { kind: 'penta', periodCents: 1200, degrees: [0, 160, 200, 300, 400], wrong: 1 },
};

function rollBp(rng: Rng): Scale {
  for (let tries = 0; tries < 500; tries++) {
    const steps = combos(13, rng.int(5, 7), rng);
    const degrees = steps.map(bpStep);
    if (!containsTriad(degrees, TRITAVE_CENTS)) return { kind: 'bp', periodCents: TRITAVE_CENTS, degrees, wrong: -1 };
  }
  return FALLBACK_SCALES.bp;
}

function rollMode7(rng: Rng): Scale {
  for (let tries = 0; tries < 800; tries++) {
    const degrees = combos(12, 7, rng).map((s) => s * 100);
    const a = rng.int(1, 6);
    let b = rng.int(1, 6);
    if (b === a) b = (a % 6) + 1;
    degrees[a] = (degrees[a] ?? 0) + (rng.chance(0.5) ? 1 : -1) * rng.range(35, 50);
    degrees[b] = (degrees[b] ?? 0) + (rng.chance(0.5) ? 1 : -1) * rng.range(35, 50);
    degrees.sort((x, y) => x - y);
    const first = degrees[0] ?? 0;
    const last = degrees[degrees.length - 1] ?? 0;
    if (first < 0 || last >= 1200 || degrees.some((d, i) => i > 0 && d - (degrees[i - 1] ?? 0) < 20)) continue;
    if (!containsTriad(degrees, 1200)) return { kind: 'mode7', periodCents: 1200, degrees, wrong: -1 };
  }
  return FALLBACK_SCALES.mode7;
}

function rollPenta(rng: Rng): Scale {
  for (let tries = 0; tries < 800; tries++) {
    const degrees = combos(12, 5, rng).map((s) => s * 100);
    const wrong = rng.int(1, 4);
    degrees[wrong] = (degrees[wrong] ?? 0) + (rng.chance(0.5) ? 1 : -1) * rng.range(55, 75);
    const sorted = [...degrees].sort((x, y) => x - y);
    const first = sorted[0] ?? 0;
    const last = sorted[sorted.length - 1] ?? 0;
    if (first < 0 || last >= 1200 || sorted.some((d, i) => i > 0 && d - (sorted[i - 1] ?? 0) < 20)) continue;
    if (!containsTriad(sorted, 1200)) return { kind: 'penta', periodCents: 1200, degrees: sorted, wrong: sorted.indexOf(degrees[wrong] ?? 0) };
  }
  return FALLBACK_SCALES.penta;
}

/** Roll a scale of `kind` (or of a random kind) from `rng`. Always triad-free. */
export function rollScale(rng: Rng, kind?: ScaleKind): Scale {
  const k = kind ?? rng.pick<ScaleKind>(['bp', 'mode7', 'penta']);
  if (k === 'bp') return rollBp(rng);
  if (k === 'mode7') return rollMode7(rng);
  return rollPenta(rng);
}

/** Cents above the root of degree `index` (any integer; negative goes below the root). */
export function degreeCents(scale: Scale, index: number): number {
  const n = scale.degrees.length;
  const rep = Math.floor(index / n);
  const i = index - rep * n;
  return rep * scale.periodCents + (scale.degrees[i] ?? 0);
}

export function degreeFreq(scale: Scale, rootHz: number, index: number): number {
  return rootHz * 2 ** (degreeCents(scale, index) / 1200);
}

/** The degree index nearest to `cents` below degree `index` (the "fifth below" of the second voice). */
export function degreeBelow(scale: Scale, index: number, cents = P5): number {
  const target = degreeCents(scale, index) - cents;
  let best = index - 1;
  let bestErr = Infinity;
  for (let k = index - 1; k >= index - scale.degrees.length * 2 - 1; k--) {
    const err = Math.abs(degreeCents(scale, k) - target);
    if (err < bestErr) {
      bestErr = err;
      best = k;
    }
  }
  return best;
}
