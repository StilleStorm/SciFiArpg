import { describe, expect, it } from 'vitest';
import { captionStepAside } from './enemyFigures';
import { GRID_CELL } from '../enemies/bosses';

describe('captionStepAside (Ankieta name vs survey row)', () => {
  it('leaves the name alone when the row is elsewhere', () => {
    expect(captionStepAside(40, 0, -200)).toBe(0);
    expect(captionStepAside(40, 400, 40)).toBe(0);
  });
  it('moves the name just under a row that crosses it', () => {
    const d = captionStepAside(40, 30, 50);
    expect(d).toBe(50 + GRID_CELL / 2 + 12 - 40);
    expect(40 + d - 9).toBeGreaterThan(50 + GRID_CELL / 2);
  });
});
