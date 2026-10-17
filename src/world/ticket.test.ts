import { describe, expect, it } from 'vitest';
import { LAWS } from './laws';
import { TICKET_BASE, ordinal, ticketForSeed } from './ticket';

describe('ticketForSeed', () => {
  it('is a pure function of the seed, with 4-6 pages and a known clause and family', () => {
    expect(ticketForSeed(12)).toEqual(ticketForSeed(12));
    expect(ticketForSeed(12, 50000).number).toBe(50000);
    expect(ticketForSeed(12).number).toBe(TICKET_BASE);
    for (let s = 1; s < 60; s++) {
      const t = ticketForSeed(s);
      expect(t.pageCount).toBeGreaterThanOrEqual(4);
      expect(t.pageCount).toBeLessThanOrEqual(6);
      expect(LAWS.some((l) => l.id === t.lawId)).toBe(true);
      expect(t.planet).toMatch(/^Planeta .+ \(.+\)$/);
      expect(t.planetLoc).toMatch(/^Planecie /);
    }
  });

  it('declines the planet ordinal', () => {
    expect(ordinal(23, 'nom')).toBe('Dwudziesta Trzecia');
    expect(ordinal(23, 'loc')).toBe('Dwudziestej Trzeciej');
    expect(ordinal(7, 'nom')).toBe('Siódma');
    expect(ordinal(40, 'loc')).toBe('Czterdziestej');
  });
});
