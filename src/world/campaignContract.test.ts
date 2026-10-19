import { describe, expect, it } from 'vitest';
import {
  PLANET_COUNT,
  PRIORITY_IDS,
  closeTicket,
  enemyScaleFor,
  newCampaign,
  nextCampaignPlan,
  planScale,
  toCampaign,
  travelList,
  type TicketPlan,
} from './campaign';

const plan = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'ciasteczka' });

describe('campaign contract (tester)', () => {
  it('enemy scale never falls with the planet at a fixed priority, nor with the priority at a fixed planet', () => {
    for (const pr of PRIORITY_IDS) {
      for (let i = 1; i < PLANET_COUNT; i++) {
        const a = enemyScaleFor(i - 1, pr);
        const b = enemyScaleFor(i, pr);
        expect(b.hp).toBeGreaterThanOrEqual(a.hp);
        expect(b.dmg).toBeGreaterThanOrEqual(a.dmg);
        expect(b.tierOffset).toBeGreaterThanOrEqual(a.tierOffset);
      }
    }
    for (let p = 0; p < PLANET_COUNT; p++) {
      for (let i = 1; i < PRIORITY_IDS.length; i++) {
        const lo = enemyScaleFor(p, PRIORITY_IDS[i - 1] ?? 'normalny');
        const hi = enemyScaleFor(p, PRIORITY_IDS[i] ?? 'normalny');
        expect(hi.hp).toBeGreaterThanOrEqual(lo.hp);
        expect(hi.dmg).toBeGreaterThanOrEqual(lo.dmg);
      }
    }
  });

  it('a plan-less run is neutral', () => {
    expect(planScale(undefined)).toEqual({ hp: 1, dmg: 1, tierOffset: 0, eliteMul: 1 });
  });

  it('walking the whole sequence closes each planet exactly once', () => {
    let c = newCampaign();
    for (let i = 0; i < PLANET_COUNT; i++) {
      expect(nextCampaignPlan(c, 'normalny', 5)?.planet).toBe(i);
      c = closeTicket(c, plan(i)).campaign;
      expect(closeTicket(c, plan(i)).campaign.closed).toEqual(c.closed);
    }
    expect([...c.closed].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(travelList(newCampaign())).toEqual([]);
  });

  it('a damaged save of the campaign is repaired, never thrown', () => {
    expect(() => toCampaign({ current: 99, closed: 'x', cards: 7 })).not.toThrow();
    expect(toCampaign(null).current).toBe(0);
  });
});
