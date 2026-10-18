import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { HOLE_RX, HOLE_RY, hatchInside, holeOutline, tapeOutline } from './tunnelFx';

describe('the hole and the tape', () => {
  it('the cut stays near the ellipse and goes round once (the points are in angle order)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const pts = holeOutline(createRng(seed));
      expect(pts.length).toBeGreaterThanOrEqual(10);
      for (const p of pts) {
        const k = Math.hypot(p.x / HOLE_RX, p.y / HOLE_RY);
        expect(k).toBeGreaterThan(0.8);
        expect(k).toBeLessThan(1.15);
      }
      const angles = pts.map((p) => Math.atan2(p.y / HOLE_RY, p.x / HOLE_RX));
      expect([...angles].sort((a, b) => a - b)).toEqual(angles);
    }
  });

  it('the hatch strokes lie inside the ellipse they are clipped to', () => {
    const d = hatchInside(20, 10, 5, -0.55);
    const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    expect(nums.length).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < nums.length; i += 2) {
      const x = nums[i] ?? 0;
      const y = nums[i + 1] ?? 0;
      expect((x * x) / 400 + (y * y) / 100).toBeLessThanOrEqual(1.02);
    }
  });

  it('the tape is wider and taller than the hole under it', () => {
    const pts = tapeOutline(createRng(4));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(HOLE_RX * 2 * 1.12);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(HOLE_RY * 2 * 1.12);
  });
});
