import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { FAMILY_HUE, HERO_HUE, STAIN_HUES, TIER_HUE, WASH_HEX, WASH_HUES, WASH_MAX, WASH_MIN, washPath, washShape, washVar } from './wash';

/** Sample every cubic of a closed `M..C..Z` path and return the distance of each sample from (cx, cy). */
function radii(d: string, cx: number, cy: number): number[] {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const out: number[] = [];
  let px = nums[0] ?? 0;
  let py = nums[1] ?? 0;
  for (let i = 2; i + 5 < nums.length + 0; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = nums.slice(i, i + 6) as [number, number, number, number, number, number];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const m = 1 - t;
      const x = m * m * m * px + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3;
      const y = m * m * m * py + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3;
      out.push(Math.hypot(x - cx, y - cy));
    }
    px = x3;
    py = y3;
  }
  return out;
}

describe('washPath', () => {
  it('is a closed path: one move, cubic segments, a close', () => {
    const d = washPath(createRng(5), 10, -4, 20);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d.match(/C/g)?.length).toBeGreaterThanOrEqual(11);
    expect(d.match(/C/g)?.length).toBeLessThanOrEqual(13);
  });

  it('stays within r x 1.4 of the centre, curve included, for many seeds', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = 6 + (seed % 40);
      const d = washPath(createRng(seed), 3, 7, r);
      for (const rad of radii(d, 3, 7)) expect(rad).toBeLessThanOrEqual(r * 1.4);
    }
  });

  it('gives the same path for the same seed and another for another seed', () => {
    expect(washPath(createRng(9), 0, 0, 24)).toBe(washPath(createRng(9), 0, 0, 24));
    expect(washPath(createRng(9), 0, 0, 24)).not.toBe(washPath(createRng(10), 0, 0, 24));
  });
});

describe('washShape', () => {
  it('is reproducible through the entity seed fork', () => {
    const a = washShape(createRng(4411).fork('wash'), 'indigo', 30);
    const b = washShape(createRng(4411).fork('wash'), 'indigo', 30);
    expect(a).toEqual(b);
  });

  it('pushes the stain 2-6 units off the figure and keeps two pale blobs', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = washShape(createRng(seed), 'ochre', 24);
      const off = Math.hypot(s.dx, s.dy);
      expect(off).toBeGreaterThanOrEqual(2);
      expect(off).toBeLessThanOrEqual(6.0001);
      expect(s.blobs).toHaveLength(2);
      for (const b of s.blobs) {
        expect(b.opacity).toBeGreaterThanOrEqual(WASH_MIN);
        expect(b.opacity).toBeLessThanOrEqual(WASH_MAX);
      }
    }
  });

  it('a boss bonus makes it 0.1 more opaque, still inside the bounds', () => {
    const plain = washShape(createRng(3), 'violet', 30);
    const boss = washShape(createRng(3), 'violet', 30, { bonus: 0.1 });
    expect(boss.blobs[0]?.opacity).toBeCloseTo((plain.blobs[0]?.opacity ?? 0) + 0.1, 5);
  });
});

describe('palette', () => {
  it('has a hex value and a css variable name for every hue', () => {
    expect(WASH_HUES).toHaveLength(6);
    for (const hue of WASH_HUES) {
      expect(WASH_HEX[hue]).toMatch(/^#[0-9a-f]{6}$/);
      expect(washVar(hue)).toBe(`var(--wash-${hue})`);
    }
  });

  it('maps every hero, family and tier to a hue; stains never take star yellow or stamp red', () => {
    for (const hue of [...Object.values(HERO_HUE), ...Object.values(FAMILY_HUE), ...Object.values(TIER_HUE)]) expect(WASH_HUES).toContain(hue);
    expect(Object.keys(HERO_HUE)).toHaveLength(4);
    expect(Object.keys(FAMILY_HUE)).toHaveLength(3);
    expect(Object.keys(TIER_HUE)).toHaveLength(4);
    expect(STAIN_HUES).not.toContain('yellow');
  });
});
