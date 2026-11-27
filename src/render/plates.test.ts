import { describe, expect, it } from 'vitest';
import { setViewZoom } from './camera';
import { plateSize, plateWidth } from './plates';

describe('drawn plate lettering', () => {
  it('reads at least 11 css px at the zoom now, whatever the base size', () => {
    for (const z of [0.6, 0.75, 1, 1.4]) {
      setViewZoom(z);
      for (const base of [4.6, 6.2, 8.5]) expect(plateSize(base) * z).toBeGreaterThanOrEqual(11 - 1e-6);
    }
    setViewZoom(1);
  });

  it('leaves a size that is already large enough', () => {
    setViewZoom(1);
    expect(plateSize(14)).toBe(14);
  });

  it('accounts for a scaled group (a pickup card at 1.3)', () => {
    setViewZoom(0.75);
    expect(plateSize(6.4, 1.3) * 1.3 * 0.75).toBeGreaterThanOrEqual(11 - 1e-6);
    setViewZoom(1);
  });

  it('cuts the plate to the word', () => {
    expect(plateWidth(10, 10)).toBe(68);
    expect(plateWidth(2, 10, 4, 54)).toBe(54);
  });
});
