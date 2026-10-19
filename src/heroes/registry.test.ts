/** The registry (S1): five heroes, each folder complete, no hero id named outside its folder. */
import { describe, expect, it } from 'vitest';
import lintScript from '../../scripts/lint-rules.mjs?raw';
import { HERO_SKILL_SOUNDS } from '../audio/recipes';
import { HERO_ID_LIST, HERO_IDS, HEROES, heroById, heroDef } from './registry';

describe('registry', () => {
  it('lists the five heroes, once each, in the order of HERO_ID_LIST', () => {
    expect(HERO_IDS).toEqual([...HERO_ID_LIST]);
    expect(HEROES).toHaveLength(5);
    expect(new Set(HERO_IDS).size).toBe(5);
  });

  it('heroById and heroDef find every hero and agree with each other', () => {
    for (const id of HERO_ID_LIST) {
      expect(heroById(id).def.id).toBe(id);
      expect(heroDef(id)).toBe(heroById(id).def);
    }
  });

  it('every hero has a cast for each of its five skills, and no cast without a skill', () => {
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

  it('the sounds of the heroes are the ones the audio recipes list', () => {
    for (const id of HERO_ID_LIST) expect(heroById(id).sounds.skills, id).toEqual(HERO_SKILL_SOUNDS[id]);
  });

  it('i18n keys of the definitions exist', async () => {
    const { t } = await import('../i18n');
    for (const d of HEROES) {
      expect(t(d.nameKey)).not.toBe(d.nameKey);
      for (const k of [...d.descKeys, d.quirkKey, ...d.skills.flatMap((s) => [s.nameKey, s.padKey, s.descKey])]) expect(t(k), k).not.toBe(k);
      if (d.chosenNoteKey) expect(t(d.chosenNoteKey)).not.toBe(d.chosenNoteKey);
    }
  });
});

describe('no hero id outside its folder', () => {
  const sources = import.meta.glob<string>('/src/**/*.ts', { query: '?raw', import: 'default', eager: true });
  const debt = new Set([...(lintScript.match(/HERO_ID_DEBT = new Set\(\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const literal = new RegExp(`(['"\`])(${HERO_ID_LIST.join('|')})\\1`);

  it('only the files listed as debt in scripts/lint-rules.mjs still name a hero', () => {
    const named: string[] = [];
    for (const [path, text] of Object.entries(sources)) {
      const rel = path.slice(1);
      if (rel.endsWith('.test.ts') || rel.includes('/i18n/') || rel === 'src/heroes/registry.ts') continue;
      if (HERO_ID_LIST.some((id) => rel.startsWith(`src/heroes/${id}/`))) continue;
      const code = text.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).map((l) => l.replace(/\/\/.*$/, ''));
      if (code.some((l) => literal.test(l))) named.push(rel);
    }
    expect(named.sort()).toEqual([...debt].sort());
  });
});
