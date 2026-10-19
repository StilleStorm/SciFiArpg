import { describe, expect, it } from 'vitest';
import { HERO_IDS } from '../heroes/registry';
import { specializationsOf } from '../heroes/specializations';
import { applyStatus } from '../combat/status';
import { t } from '../i18n';
import { createRun } from '../world/run';
import { osobowaInputFromRun, osobowaModel } from './karta-osobowa';
import { questCard } from './board';
import { proceduralOffer } from '../world/quests';

describe('osobowaModel', () => {
  it('reads every hero: racja, the numbers, three kinds of damage, three resists, three permissions', () => {
    for (const id of HERO_IDS) {
      const s = createRun(4, { heroId: id });
      const m = osobowaModel(osobowaInputFromRun(s));
      expect(m.racja.text).toBe(`${Math.ceil(s.player.hp)}/${s.player.hpMax}`);
      expect(m.stats.map((r) => r.id)).toEqual(['pewnosc', 'upor', 'atak', 'krytyk', 'tempo', 'zasieg', 'ruch']);
      expect(m.damage).toHaveLength(3);
      expect(m.damage.filter((d) => d.basic !== null)).toHaveLength(1);
      expect(m.damage.flatMap((d) => d.skills).length).toBeGreaterThanOrEqual(3);
      expect(m.resists).toHaveLength(3);
      expect(m.permissions.map((p) => p.held)).toEqual([false, false, false]);
      expect(m.specialization.id).toBeNull();
    }
  });

  it('follows the meter, the slips, the permissions, the statuses and the specialization', () => {
    const s = createRun(4, { heroId: 'pralka' });
    s.player.meter = 0.5;
    s.player.potwierdzenia = 3;
    s.player.permissions.push('wygenerowane');
    s.player.stats.resist.mechaniczny = 20;
    applyStatus(s.player, 'zgloszony', 3.2, null);
    const m = osobowaModel(osobowaInputFromRun(s));
    expect(m.meter).toEqual({ text: '50%', ratio: 0.5 });
    expect(m.potwierdzenia.count).toBe(3);
    expect(m.permissions.find((p) => p.family === 'wygenerowane')?.held).toBe(true);
    expect(m.resists.find((r) => r.id === 'mechaniczny')?.value).toBe('20%');
    expect(m.annotations).toHaveLength(1);
    expect(m.annotations[0]?.seconds).toBeCloseTo(3.2, 5);
    const spec = specializationsOf('pralka')[0];
    s.hero.spec = spec?.id;
    const after = osobowaModel(osobowaInputFromRun(s)).specialization;
    expect(after.id).toBe(spec?.id);
    expect(after.capstone).toBeTruthy();
  });
});

describe('questCard', () => {
  it('prints the text with the family, the reward words and the progress of a taken ticket', () => {
    for (let e = 0; e < 8; e++) {
      for (let slot = 0; slot < 2; slot++) {
        const def = proceduralOffer(e % 9, e, slot);
        const card = questCard(def, undefined);
        expect(card.text).not.toContain('screens.quests');
        expect(card.text).not.toContain('{');
        expect(card.reward[0]).toContain(String(def.reward.stars));
        expect(card.progress).toBeNull();
        const held = questCard(def, { id: def.id, progress: def.n, stage: 1 });
        expect(held.ready).toBe(true);
        expect(held.progress).toBeTruthy();
      }
    }
    expect(t('screens.quests.accept')).toBe('Przyjmuję');
  });
});
