import { describe, expect, it } from 'vitest';
import { createRun } from '../world/run';
import { bracketPath, reputacjaText } from './hud';

describe('reputacjaText', () => {
  it('prints level and progress, and the progress as a debt once time runs backwards', () => {
    const s = createRun(2, { lawId: 'czas-wsteczny' });
    s.player.xp = 12;
    expect(reputacjaText(s)).toMatch(/^1 · 12\/\d+$/);
    s.law.reversed = true;
    expect(reputacjaText(s)).toMatch(/^1 · −12\/\d+$/);
  });
});

describe('bracketPath (S20, Opóźnienie on the racja line)', () => {
  it('brackets the owed part left of the racja end, at least 8 px wide, inside the line', () => {
    const d = bracketPath(200, 0.5, 0.25);
    expect(d.startsWith('M53 0L50 0L50 10')).toBe(true);
    expect(d).toContain('L100 0L100 10');
    const thin = bracketPath(200, 0.5, 0);
    expect(thin).toContain('L92 0L92 10');
    expect(thin).toContain('L100 0L100 10');
    expect(bracketPath(200, 0.2, 0.9).startsWith('M3 0L0 0')).toBe(true);
  });
});
