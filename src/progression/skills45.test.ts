/** The fourth and fifth skill (DESIGN 10.1): rank 1 wants a permission, ranks 2 and 3 are free, the form follows with the pad step. */
import { describe, expect, it } from 'vitest';
import { heroDef, type SkillIndex } from '../heroes/defs';
import type { HeroId } from '../heroes';
import { t } from '../i18n';
import { createRun, type RunState } from '../world/run';
import { applyUpgrade, availableEntries, confirmUpdate, drawEntries, entryView, newSkillOf, poolFor, requirementOf, rollOffer, upgradeById } from './update';

const HEROES: HeroId[] = ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik'];
const NEW: SkillIndex[] = [3, 4];
const run = (heroId: HeroId, seed = 3): RunState => createRun(seed, { heroId });

describe('skills 4 and 5 in the pool', () => {
  it.each(HEROES)('%s: rank 1 is locked without the permission of the skill, offered unlocked with it', (hero) => {
    for (const i of NEW) {
      const family = heroDef(hero).skills[i].requires;
      expect(family).toBeDefined();
      const id = `skill${i + 1}`;
      const s = run(hero);
      const locked = availableEntries(s).find((e) => e.id === id);
      expect(locked).toEqual({ id, rank: 1, locked: true });
      expect(applyUpgrade(s, id)).toBe(false);
      expect(s.hero.ranks[i]).toBe(0);
      if (family) s.player.permissions.push(family);
      expect(availableEntries(s).find((e) => e.id === id)).toEqual({ id, rank: 1, locked: false });
      expect(applyUpgrade(s, id)).toBe(true);
      expect(s.hero.ranks[i]).toBe(1);
    }
  });

  it('a permission of another family does not unlock it', () => {
    const s = run('pralka'); // skill 4: urzadzenia
    s.player.permissions.push('powiadomienia');
    expect(availableEntries(s).find((e) => e.id === 'skill4')?.locked).toBe(true);
    expect(applyUpgrade(s, 'skill4')).toBe(false);
  });

  it.each(HEROES)('%s: ranks 2 and 3 of skills 4 and 5 are free', (hero) => {
    const s = run(hero);
    for (const i of NEW) {
      const def = upgradeById(hero, `skill${i + 1}`);
      expect(def).toBeDefined();
      if (!def) continue;
      expect(requirementOf(def, 1, hero)).toBe(heroDef(hero).skills[i].requires);
      expect(requirementOf(def, 2, hero)).toBeUndefined();
      expect(requirementOf(def, 3, hero)).toBeUndefined();
      s.player.permissions.push(heroDef(hero).skills[i].requires ?? 'urzadzenia');
      expect(applyUpgrade(s, def.id)).toBe(true);
      s.player.permissions.length = 0; // no permission now
      expect(availableEntries(s).find((e) => e.id === def.id)).toEqual({ id: def.id, rank: 2, locked: false });
      expect(applyUpgrade(s, def.id)).toBe(true);
      expect(applyUpgrade(s, def.id)).toBe(true);
      expect(s.hero.ranks[i]).toBe(3);
      expect(applyUpgrade(s, def.id)).toBe(false); // no fourth rank
    }
  });

  it('skills 1..3 are unchanged: rank 3 wants the permission, ranks 1 and 2 do not', () => {
    const s = run('konsultant');
    expect(applyUpgrade(s, 'skill1')).toBe(true);
    expect(applyUpgrade(s, 'skill1')).toBe(true);
    expect(applyUpgrade(s, 'skill1')).toBe(false);
    expect(availableEntries(s).find((e) => e.id === 'skill1')).toEqual({ id: 'skill1', rank: 3, locked: true });
  });

  it('entryView: rank 1 reads "Nowa umiejętność" with the skill description, ranks 2 and 3 the usual rank line', () => {
    const s = run('kartograf');
    s.player.permissions.push('powiadomienia');
    const sk = heroDef('kartograf').skills[3];
    const first = entryView(s, { id: 'skill4', rank: 1, locked: false });
    expect(first.title).toBe(t('forms.update.newSkill', { skill: t(sk.nameKey) }));
    expect(first.title.startsWith('Nowa umiejętność')).toBe(true);
    expect(first.desc).toBe(t(sk.descKey));
    expect(first.requires).toContain('powiadomienia');
    expect(first.locked).toBe(false);
    const second = entryView(s, { id: 'skill4', rank: 2, locked: false });
    expect(second.title).toBe(t('forms.update.skillRank', { skill: t(sk.nameKey), rank: 'II' }));
    expect(second.desc).toBe(t('forms.update.skillRankDesc'));
    expect(second.requires).toBeNull();
    expect(entryView(s, { id: 'skill4', rank: 3, locked: false }).title).toContain('III');
    // skills 1..3 never read "Nowa umiejętność"
    expect(entryView(s, { id: 'skill1', rank: 1, locked: false }).title).not.toContain('Nowa umiejętność');
  });

  it('entryView of a locked first rank says so and names the family', () => {
    const s = run('petlowiec');
    const v = entryView(s, { id: 'skill4', rank: 1, locked: true });
    expect(v.locked).toBe(true);
    expect(v.requires).toContain('wygenerowane');
  });

  it('an offer holds at most one gated entry, the new skills included', () => {
    for (const hero of HEROES) {
      for (let seed = 1; seed <= 80; seed++) {
        const s = run(hero, seed);
        const offer = rollOffer(s, 0);
        expect(offer.entries).toHaveLength(3);
        const gated = offer.entries.filter((e) => {
          const def = upgradeById(hero, e.id);
          return def !== undefined && requirementOf(def, e.rank, hero) !== undefined;
        });
        expect(gated.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('drawEntries over a pool made of gated entries still offers one at most', () => {
    const s = run('nalesnik', 9);
    const gated = poolFor('nalesnik').filter((u) => u.id === 'skill4' || u.id === 'skill5' || u.id === 'passive6').map((u) => ({ id: u.id, rank: 1, locked: true }));
    const rest = availableEntries(s).filter((e) => !gated.some((g) => g.id === e.id));
    for (let seed = 1; seed <= 40; seed++) {
      const picked = drawEntries('nalesnik', [...gated, ...rest], s.rng.fork(`t${seed}`));
      expect(picked.filter((e) => gated.some((g) => g.id === e.id)).length).toBeLessThanOrEqual(1);
    }
  });

  it('confirmUpdate installs skill 4 only from an unlocked offer', () => {
    const s = run('pralka');
    s.hero.offer = { entries: [{ id: 'skill4', rank: 1, locked: true }], level: 2 };
    expect(confirmUpdate(s, 'skill4')).toBe(false);
    s.player.permissions.push('urzadzenia');
    expect(confirmUpdate(s, 'skill4')).toBe(true);
    expect(s.hero.ranks[3]).toBe(1);
    expect(s.hero.offer).toBeNull();
  });
});

describe('newSkillOf', () => {
  it('names the skill whose rank went from 0 to above 0', () => {
    expect(newSkillOf([0, 0, 0, 0, 0], [0, 0, 0, 1, 0])).toBe(3);
    expect(newSkillOf([2, 0, 0, 3, 0], [2, 0, 0, 3, 1])).toBe(4);
  });
  it('is null for every other update', () => {
    expect(newSkillOf([0, 0, 0, 0, 0], [1, 0, 0, 0, 0])).toBeNull(); // skill 1 rank 1
    expect(newSkillOf([0, 0, 0, 1, 0], [0, 0, 0, 2, 0])).toBeNull(); // skill 4 rank 2
    expect(newSkillOf([0, 0, 0, 0, 0], [0, 0, 0, 0, 0])).toBeNull();
  });
});
