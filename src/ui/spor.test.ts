import { describe, expect, it } from 'vitest';
import { clearStand } from './spor';

const rect = (top: number, bottom: number, left = 100, right = 200) => ({ top, bottom, left, right });

describe('clearStand (the Spór reply strip in portrait)', () => {
  it('stays at the lowest stand when nothing is in the way', () => {
    expect(clearStand(844, 177, 8, 294, 190, 120, [])).toBe(190);
    expect(clearStand(844, 177, 8, 294, 190, 120, [rect(100, 200)])).toBe(190);
  });
  it('steps up past a hero standing where the lowest stand would cover him', () => {
    // the lowest stand covers y 477..654; the hero's feet are at 600
    const at = clearStand(844, 177, 8, 294, 190, 120, [rect(540, 600)]);
    expect(at).toBeGreaterThan(190);
    const top = 844 - at - 177;
    expect(top + 177).toBeLessThanOrEqual(540 - 6);
  });
  it('lets a figure beside the strip go by and gives the least-covering stand when none is clear', () => {
    expect(clearStand(844, 177, 8, 294, 190, 120, [rect(500, 640, 320, 380)])).toBe(190);
    const at = clearStand(844, 177, 8, 294, 190, 120, [rect(130, 700)]);
    expect(at).toBeGreaterThanOrEqual(190);
  });
});
