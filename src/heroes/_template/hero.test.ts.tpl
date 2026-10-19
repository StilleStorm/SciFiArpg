/** Tests of the __ID__ hero. TODO: one test per skill x paragraph x aim kind, the auto-attack, the quirk, the figure. */
import { describe, expect, it } from 'vitest';
import { createBus } from '../../core/events';
import { createRun } from '../../world/run';
import { castSkill } from '../skills';
import { assignPad } from '../loadout';
import { heroById } from '../registry';

describe('__ID__', () => {
  it('is registered and every skill has a cast', () => {
    const m = heroById('__ID__');
    for (const sk of m.def.skills) expect(m.casts[sk.id], sk.id).toBeTypeOf('function');
  });

  it('every skill can be cast without a crash', () => {
    for (let i = 0; i < 5; i++) {
      const s = createRun(5, { heroId: '__ID__' });
      s.hero.ranks[3] = 1;
      s.hero.ranks[4] = 1;
      assignPad(s, 0, i as 0 | 1 | 2 | 3 | 4);
      expect(() => castSkill(s, createBus(), 0)).not.toThrow();
    }
  });

  it.todo('each skill does what its description says (see heroes/skills45.test.ts for the pattern)');
});
