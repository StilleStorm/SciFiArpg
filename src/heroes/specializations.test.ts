/** Specializations (S4): categories and columns as data for the five heroes, the capstone rule, the loadout rules, the effect at the cast. */
import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { t } from '../i18n';
import { emptyCharacter, toCharacter, type Character } from '../save/character';
import { createRun } from '../world/run';
import { heroDef, type SkillIndex } from './defs';
import { HERO_IDS } from './registry';
import { padSkill } from './loadout';
import { castSkill } from './skills';
import {
  activeCapstone,
  categoryNameKey,
  categoryOf,
  loadoutAdvice,
  mergeCapstone,
  setLoadout,
  SKILL_CATEGORIES,
  specializationsOf,
  ultimatesOf,
} from './specializations';

const withUpgrades = (c: Character): Character => ({ ...c, upgrades: { skill4: 1, skill5: 1 } });

describe('categories and specializations as data', () => {
  it.each(HERO_IDS)('%s: every skill has a category, three columns, all skill ids real, all text present', (id) => {
    const def = heroDef(id);
    for (const sk of def.skills) expect(SKILL_CATEGORIES).toContain(categoryOf(sk));
    for (const u of ultimatesOf(id)) expect(categoryOf(u)).toBe('ostateczna');
    const specs = specializationsOf(id);
    expect(specs).toHaveLength(3);
    const ids = def.skills.map((k) => k.id);
    for (const sp of specs) {
      expect(sp.skills.length).toBeGreaterThanOrEqual(3);
      for (const k of sp.skills) expect(ids).toContain(k);
      expect(sp.skills).toContain(sp.capstone.skill);
      for (const key of [sp.nameKey, sp.capstone.nameKey, sp.capstone.descKey]) expect(t(key)).not.toBe(key);
    }
    for (const c of SKILL_CATEGORIES) expect(t(categoryNameKey(c))).not.toBe(categoryNameKey(c));
  });
});

describe('the capstone rule', () => {
  const c0 = withUpgrades(emptyCharacter('pralka'));

  it('is granted when two equipped pad skills belong to the chosen column', () => {
    const c = { ...c0, pads: [0, 1, 4] as [SkillIndex, SkillIndex, SkillIndex], specialization: 'pralnia' }; // wirowanie, pranieWstepne, osobowosc
    expect(activeCapstone(c)?.spec.id).toBe('pralnia');
  });
  it('is not granted with one skill of the column, nor without a choice', () => {
    expect(activeCapstone({ ...c0, pads: [0, 3, 4], specialization: 'pralnia' })).toBeNull(); // only wirowanie
    expect(activeCapstone({ ...c0, pads: [0, 1, 2] })).toBeNull();
  });
  it('is one column at a time: the chosen one only, even when two columns qualify', () => {
    const c = { ...c0, pads: [0, 1, 4] as [SkillIndex, SkillIndex, SkillIndex] }; // fits Pralnia and Osoba
    expect(activeCapstone({ ...c, specialization: 'pralnia' })?.spec.id).toBe('pralnia');
    expect(activeCapstone({ ...c, specialization: 'osoba' })?.spec.id).toBe('osoba');
  });
  it('does not count a pad skill that is not unlocked (a damaged save)', () => {
    const c = { ...emptyCharacter('pralka'), pads: [0, 3, 4] as [SkillIndex, SkillIndex, SkillIndex], specialization: 'osoba' };
    expect(activeCapstone(c)).toBeNull(); // skills 4 and 5 are not installed: only wirowanie counts
  });
  it('merges: multipliers multiply, cd adds', () => {
    expect(mergeCapstone({ area: 1.2, cd: 2 }, { area: 1.5, cd: -1 })).toEqual({ area: 1.2 * 1.5, cd: 1 });
    expect(mergeCapstone(undefined, { dmg: 1.2 })).toEqual({ dmg: 1.2 });
  });

  it('is applied at the cast, and only to its skill', () => {
    const run = (spec?: string): number => {
      const s = createRun(5, { heroId: 'pralka' });
      s.hero.pads = [0, 1, 2];
      if (spec) s.hero.spec = spec;
      let seen = 0;
      const bus = createBus();
      bus.on('skill:cast', () => {
        seen = s.hero.patch?.[0]?.area ?? 1;
      });
      // the patch is visible to the cast itself: read it from inside by spying on the helper's input
      expect(castSkill(s, bus, 0)).toBe(true);
      expect(s.hero.patch).toBeUndefined(); // restored after the cast
      return seen;
    };
    expect(run()).toBe(1);
    expect(run('pralnia')).toBeCloseTo(1.2);
    expect(run('serwis')).toBe(1); // wirowanie is not the capstone skill of Serwis
  });
});

describe('the loadout', () => {
  const base = (): Character => withUpgrades(emptyCharacter('konsultant'));

  it('equips any three different unlocked skills and the chosen specialization', () => {
    const c = base();
    expect(setLoadout(c, { pads: [4, 3, 0], ultimate: ultimatesOf('konsultant')[0] ?? '', specialization: 'windykacja' })).toEqual({ ok: true });
    expect(c.pads).toEqual([4, 3, 0]);
    expect(c.specialization).toBe('windykacja');
    expect(setLoadout(c, { pads: [0, 1, 2], ultimate: c.ultimate ?? '', specialization: null })).toEqual({ ok: true });
    expect(c.specialization).toBeUndefined();
  });
  it('refuses, and changes nothing, for repeats, locked skills, unknown ultimate or specialization', () => {
    const c = { ...emptyCharacter('konsultant') };
    const ult = ultimatesOf('konsultant')[0] ?? '';
    expect(setLoadout(c, { pads: [0, 0, 1], ultimate: ult, specialization: null })).toEqual({ ok: false, reason: 'pads' });
    expect(setLoadout(c, { pads: [0, 1, 4], ultimate: ult, specialization: null })).toEqual({ ok: false, reason: 'locked' });
    expect(setLoadout(c, { pads: [0, 1, 2], ultimate: 'nope', specialization: null })).toEqual({ ok: false, reason: 'ultimate' });
    expect(setLoadout(c, { pads: [0, 1, 2], ultimate: ult, specialization: 'nope' })).toEqual({ ok: false, reason: 'specialization' });
    expect(c.pads).toEqual([0, 1, 2]);
    expect(c.specialization).toBeUndefined();
  });
  it('advice is advisory: nothing when the categories differ, the missing ones when two pads share one', () => {
    expect(loadoutAdvice({ heroId: 'pralka', pads: [0, 1, 2] })).toEqual([]); // podstawowa, obronna, uzytkowa
    expect(loadoutAdvice({ heroId: 'pralka', pads: [0, 3, 4] })).toEqual(['obronna', 'uzytkowa']); // ofensywna twice
  });
});

describe('the record', () => {
  it('an old save loads without a loadout; a stored one survives, a bad one is dropped', () => {
    const old = toCharacter({ heroId: 'pralka', level: 3 });
    expect(old?.specialization).toBeUndefined();
    expect(old?.ultimate).toBeUndefined();
    const ult = ultimatesOf('pralka')[0];
    const kept = toCharacter({ heroId: 'pralka', specialization: 'serwis', ultimate: ult });
    expect(kept?.specialization).toBe('serwis');
    expect(kept?.ultimate).toBe(ult);
    const bad = toCharacter({ heroId: 'pralka', specialization: 'osoba-x', ultimate: 7 });
    expect(bad?.specialization).toBeUndefined();
    expect(bad?.ultimate).toBeUndefined();
  });
});

describe('the pad preview shows the capstone', () => {
  it('padSkill carries the capstone patch of its skill only while the capstone is in force', () => {
    const s = createRun(4, { heroId: 'petlowiec' }); // pads: przybycie, spor, petla (two of Chronologia)
    const slot = s.hero.pads.indexOf(2) as 0 | 1 | 2;
    const base = padSkill(s, slot).cooldown;
    s.hero.spec = 'chronologia'; // capstone: petla, cooldown -1 s
    expect(padSkill(s, slot).cooldown).toBe(Math.max(1, base - 1));
    expect(padSkill(s, ((slot + 1) % 3) as 0 | 1 | 2).patch).toBeUndefined();
    s.hero.spec = 'ladowanie';
    expect(padSkill(s, slot).cooldown).toBe(base);
  });
});
