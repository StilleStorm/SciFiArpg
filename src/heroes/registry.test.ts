/** The registry (S1): five heroes, each folder complete, no hero id named outside its folder. */
import { describe, expect, it } from 'vitest';
import { RECIPES } from '../audio/recipes';
import { WASH_HUES } from '../render/wash';
import { HERO_ID_LIST, HERO_IDS, HEROES, heroById, heroDef } from './registry';

describe('registry', () => {
  it('lists the five heroes, once each, in the order of HERO_ID_LIST', () => {
    expect(HERO_IDS).toEqual([...HERO_ID_LIST]);
    expect(HEROES).toHaveLength(HERO_ID_LIST.length); // five shipped; a hero in the making (scripts/new-hero.mjs) adds one
    expect(new Set(HERO_IDS).size).toBe(HERO_ID_LIST.length);
  });

  it('heroById and heroDef find every hero and agree with each other', () => {
    for (const id of HERO_ID_LIST) {
      expect(heroById(id).def.id).toBe(id);
      expect(heroDef(id)).toBe(heroById(id).def);
    }
  });

  it('every hero has a cast for each of its skills (five, or ten once filled), and no cast without a skill', () => {
    for (const m of HEROES.map((d) => heroById(d.id))) {
      const ids = m.def.skills.map((s) => s.id);
      expect(Object.keys(m.casts).sort(), m.def.id).toEqual([...ids].sort());
    }
  });

  it('every hero has a figure that draws, poses its attack and times it', () => {
    for (const id of HERO_ID_LIST) {
      const f = heroById(id).figure;
      expect(f.attackMs).toBeGreaterThan(0);
      expect(f.def.legs).toHaveLength(2);
      expect(f.pose(0).lurch).toBeCloseTo(0, 6);
      expect(f.pose(f.attackMs).erase).toBeGreaterThanOrEqual(0);
    }
  });

  it('the sounds of the heroes are audio recipes, one distinct per skill', () => {
    for (const id of HERO_ID_LIST) {
      const m = heroById(id);
      const names = m.sounds.skills;
      expect(names.length, id).toBe(m.def.skills.length);
      expect(new Set(names).size, id).toBe(names.length);
      for (const n of names) expect(RECIPES[n], `${id} ${n}`).toBeDefined();
      const ults = m.sounds.ultimate;
      if (typeof ults === 'object') {
        expect(Object.keys(ults).sort(), id).toEqual((m.ultimates ?? []).map((u) => u.id).sort());
        for (const n of Object.values(ults)) expect(RECIPES[n], `${id} ${n}`).toBeDefined();
      }
    }
  });

  it('every hero has a pad glyph per skill and at least six passives, the sixth gated by a permission', () => {
    for (const id of HERO_ID_LIST) {
      const m = heroById(id);
      expect(m.pads, id).toHaveLength(m.def.skills.length);
      for (const g of m.pads) expect(g.length, id).toBeGreaterThan(0);
      expect(m.passives.length, id).toBeGreaterThanOrEqual(6);
      expect(m.passives[5]?.requires, id).toBeDefined();
      expect(WASH_HUES, id).toContain(m.figure.hue);
    }
  });

  it('i18n keys of the definitions exist', async () => {
    const { t } = await import('../i18n');
    for (const d of HEROES) {
      expect(t(d.nameKey)).not.toBe(d.nameKey);
      for (const k of [...d.descKeys, d.quirkKey, ...d.skills.flatMap((s) => [s.nameKey, s.padKey, s.descKey])]) expect(t(k), k).not.toBe(k);
      if (d.chosenNoteKey) expect(t(d.chosenNoteKey)).not.toBe(d.chosenNoteKey);
      for (let n = 1; n <= heroById(d.id).passives.length; n++) {
        for (const part of ['name', 'desc']) {
          const k = `forms.update.passive.${d.id}.${n}.${part}`;
          expect(t(k), k).not.toBe(k);
        }
      }
    }
  });
});

describe('no hero id outside its folder', () => {
  const sources = import.meta.glob<string>('/src/**/*.ts', { query: '?raw', import: 'default', eager: true });
  const literal = new RegExp(`(['"\`])(${HERO_ID_LIST.join('|')})\\1`);
  const key = new RegExp(`(?:^|[{,])\\s*(${HERO_ID_LIST.join('|')})\\??\\s*:`);

  it('no file outside src/heroes/<id>/ and the registry names a hero, as a literal or a table key', () => {
    const named: string[] = [];
    for (const [path, text] of Object.entries(sources)) {
      const rel = path.slice(1);
      if (rel.endsWith('.test.ts') || rel.includes('/i18n/') || rel === 'src/heroes/registry.ts') continue;
      if (HERO_ID_LIST.some((id) => rel.startsWith(`src/heroes/${id}/`))) continue;
      const code = text.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).map((l) => l.replace(/\/\/.*$/, ''));
      if (code.some((l) => literal.test(l) || key.test(l))) named.push(rel);
    }
    expect(named).toEqual([]);
  });
});
