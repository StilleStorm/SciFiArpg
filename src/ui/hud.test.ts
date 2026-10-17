import { describe, expect, it } from 'vitest';
import { createRun } from '../world/run';
import { reputacjaText } from './hud';

describe('reputacjaText', () => {
  it('prints level and progress, and the progress as a debt once time runs backwards', () => {
    const s = createRun(2, { lawId: 'czas-wsteczny' });
    s.player.xp = 12;
    expect(reputacjaText(s)).toMatch(/^1 · 12\/\d+$/);
    s.law.reversed = true;
    expect(reputacjaText(s)).toMatch(/^1 · −12\/\d+$/);
  });
});
