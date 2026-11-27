import { describe, expect, it } from 'vitest';
import { ankietaStarsLost } from './partsBosses';

describe('the Ankieta face stars', () => {
  it('fills floor(5 x (1 - racja / max)) of them', () => {
    expect(ankietaStarsLost(300, 300)).toBe(0);
    expect(ankietaStarsLost(241, 300)).toBe(0);
    expect(ankietaStarsLost(240, 300)).toBe(1);
    expect(ankietaStarsLost(150, 300)).toBe(2);
    expect(ankietaStarsLost(60, 300)).toBe(4);
    expect(ankietaStarsLost(1, 300)).toBe(4);
    expect(ankietaStarsLost(0, 300)).toBe(5);
  });
  it('stays within 0..5 for stray numbers', () => {
    expect(ankietaStarsLost(400, 300)).toBe(0);
    expect(ankietaStarsLost(-10, 300)).toBe(5);
    expect(ankietaStarsLost(10, 0)).toBe(0);
  });
});
