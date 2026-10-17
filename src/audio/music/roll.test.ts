import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { PAGE_H, PAGE_INSET, PAGE_W, generateRunPages } from '../../world/pages';
import { STEPS_PER_BAR } from './profiles';
import { readRoll, rollRange } from './roll';
import { FALLBACK_SCALES, rollScale } from './scale';

const scale = rollScale(createRng(3), 'penta');
const pages = generateRunPages(createRng(77), 5);

describe('piano roll reading', () => {
  it('is a pure function of the page: the same page gives the same roll', () => {
    for (const p of pages) expect(readRoll(p, scale, 96)).toEqual(readRoll(p, scale, 96));
    const again = generateRunPages(createRng(77), 5);
    pages.forEach((p, i) => expect(readRoll(p, scale, 96)).toEqual(readRoll(again[i] ?? p, scale, 96)));
  });

  it('different pages play different motifs', () => {
    const rolls = pages.map((p) => JSON.stringify(readRoll(p, scale, 96)));
    expect(new Set(rolls).size).toBe(pages.length);
  });

  it('x is time and y is pitch: a pin on the right is later, a pin higher on the page is a higher note', () => {
    const page = { w: PAGE_W, h: PAGE_H, inset: PAGE_INSET, obstacles: [
      { kind: 'clip' as const, colliders: [{ x: 200, y: 1400, r: 9 }] },
      { kind: 'clip' as const, colliders: [{ x: 1000, y: 200, r: 9 }] },
    ] };
    const roll = readRoll(page, scale, 96);
    expect(roll).toHaveLength(2);
    const [a, b] = roll;
    expect(a && b && a.step < b.step).toBe(true);
    expect(a && b && a.degree < b.degree).toBe(true);
    expect(a?.voice).toBe('tick');
  });

  it('keeps every note inside the loop and the pitch range, and ranks inside 0..1', () => {
    for (const steps of [64, 96, 128]) {
      for (const p of pages) {
        for (const n of readRoll(p, scale, steps)) {
          expect(n.step).toBeGreaterThanOrEqual(0);
          expect(n.step).toBeLessThan(steps);
          expect(n.degree).toBeGreaterThanOrEqual(0);
          expect(n.degree).toBeLessThan(rollRange(scale));
          expect(n.rank).toBeGreaterThanOrEqual(0);
          expect(n.rank).toBeLessThan(1);
          expect(n.vel).toBeGreaterThanOrEqual(0.45);
          expect(n.vel).toBeLessThanOrEqual(1);
          expect(n.steps).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('the strongest pin of every bar always sounds, even in the sparsest page', () => {
    for (const p of pages) {
      const roll = readRoll(p, scale, 96);
      const byBar = new Map<number, number>();
      for (const n of roll) byBar.set(Math.floor(n.step / STEPS_PER_BAR), Math.min(byBar.get(Math.floor(n.step / STEPS_PER_BAR)) ?? 1, n.rank));
      for (const best of byBar.values()) expect(best).toBe(0);
    }
  });

  it('a real page makes a real figure: enough notes to play and not a wall', () => {
    for (const p of pages) {
      const n = readRoll(p, FALLBACK_SCALES.mode7, 96).length;
      expect(n).toBeGreaterThan(8);
      expect(n).toBeLessThan(200);
    }
  });

  it('the pitch follows the scale: degrees index into it', () => {
    const s = FALLBACK_SCALES.penta;
    for (const n of readRoll(pages[0] ?? pages[1]!, s, 96)) expect(Number.isInteger(n.degree)).toBe(true);
  });
});
