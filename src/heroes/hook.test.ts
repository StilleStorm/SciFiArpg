import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { gainXp, xpToNext } from '../progression';
import { xpMul, type TicketPlan } from '../world/campaign';
import { createRun } from '../world/run';
import { levelUpXp } from './hook';

describe('the levelUp balance hook', () => {
  it('pays exactly one level whatever the priority pays', () => {
    for (const priority of ['niski', 'normalny', 'wysoki', 'krytyczny'] as const) {
      const plan: TicketPlan = { kind: 'campaign', planet: 0, priority, lawId: 'paragraf-12' as TicketPlan['lawId'] };
      const s = createRun(7, { heroId: 'pralka', plan });
      const bus = createBus();
      const before = s.player.level;
      expect(xpMul(s.plan)).toBeGreaterThan(0);
      for (let i = 0; i < 5; i++) {
        const want = s.player.level + 1;
        expect(gainXp(s, bus, levelUpXp(s)), priority).toBe(1);
        expect(s.player.level).toBe(want);
      }
      expect(s.player.level).toBe(before + 5);
      expect(xpToNext(s.player.level)).toBeGreaterThan(s.player.xp);
    }
  });
});
