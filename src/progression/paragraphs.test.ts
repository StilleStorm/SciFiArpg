/** The unlock schedule of paragraphs and the character round trip (S2). */
import { describe, expect, it } from 'vitest';
import { heroDef } from '../heroes/defs';
import { applyUpgrade } from './update';
import { HERO_IDS } from '../heroes/registry';
import { applyCharacter, emptyCharacter, serializeCharacter, toCharacter, type Character } from '../save/character';
import { createRun } from '../world/run';
import {
  activeParagraph,
  activeParagraphsOf,
  applyParagraphs,
  isParagraphUnlocked,
  paragraphLevel,
  paragraphsOf,
  setActiveParagraph,
  setRunParagraph,
  skillLevelOf,
  unlockedParagraphs,
} from './paragraphs';

const at = (level: number, extra: Partial<Character> = {}): Character => ({ ...emptyCharacter('pralka'), level, ...extra });

describe('paragraphsOf', () => {
  it('gives three per skill of the hero, in order, and nothing for a skill it does not have', () => {
    for (const id of HERO_IDS) for (const sk of heroDef(id).skills) expect(paragraphsOf(id, sk.id).map((p) => p.n)).toEqual([1, 2, 3]);
    expect(paragraphsOf('pralka', 'nie-ma')).toEqual([]);
  });
});

describe('the unlock schedule', () => {
  it('§ 2 opens at the skill level + 6 and § 3 at + 14', () => {
    expect(skillLevelOf('pralka', 'wirowanie')).toBe(1);
    expect(paragraphLevel('pralka', 'wirowanie', 1)).toBe(1);
    expect(paragraphLevel('pralka', 'wirowanie', 2)).toBe(7);
    expect(paragraphLevel('pralka', 'wirowanie', 3)).toBe(15);
    expect(unlockedParagraphs(at(1))['wirowanie']).toEqual([1]);
    expect(unlockedParagraphs(at(6))['wirowanie']).toEqual([1]);
    expect(unlockedParagraphs(at(7))['wirowanie']).toEqual([1, 2]);
    expect(unlockedParagraphs(at(14))['wirowanie']).toEqual([1, 2]);
    expect(unlockedParagraphs(at(15))['wirowanie']).toEqual([1, 2, 3]);
  });

  it('a skill that opens later opens its paragraphs later', () => {
    expect(paragraphLevel('konsultant', 'pomoc', 2)).toBe(15);
    expect(paragraphLevel('konsultant', 'pomoc', 3)).toBe(23);
  });

  it('the fourth and fifth skill count only once installed', () => {
    const c = at(40);
    expect(unlockedParagraphs(c)['beben']).toEqual([]);
    expect(unlockedParagraphs(c)['osobowosc']).toEqual([]);
    c.upgrades['skill4'] = 1;
    expect(unlockedParagraphs(c)['beben']).toEqual([1, 2, 3]);
    expect(unlockedParagraphs(c)['osobowosc']).toEqual([]);
  });

  it('a family permission opens the paragraph that names it, and only that one', () => {
    const c = at(1, { upgrades: { skill5: 1 }, permissions: [] });
    expect(unlockedParagraphs(c)['osobowosc']).toEqual([1]);
    c.permissions = ['powiadomienia'];
    expect(unlockedParagraphs(c)['osobowosc']).toEqual([1, 3]);
    expect(unlockedParagraphs(c)['wirowanie']).toEqual([1]);
  });

  it('covers every skill of the hero', () => {
    for (const id of HERO_IDS) expect(Object.keys(unlockedParagraphs({ ...emptyCharacter(id), level: 40 })).sort()).toEqual(heroDef(id).skills.map((k) => k.id).sort());
  });
});

describe('the active paragraph of a character', () => {
  it('is § 1 until one is set, and only an open paragraph can be set', () => {
    const c = at(7);
    expect(activeParagraph(c, 'wirowanie')).toBe(1);
    expect(setActiveParagraph(c, 'wirowanie', 3)).toBe(false);
    expect(c.paragraphs).toBeUndefined();
    expect(setActiveParagraph(c, 'wirowanie', 2)).toBe(true);
    expect(activeParagraph(c, 'wirowanie')).toBe(2);
    expect(c.paragraphs).toEqual({ wirowanie: 2 });
    expect(setActiveParagraph(c, 'wirowanie', 1)).toBe(true);
    expect(c.paragraphs).toBeUndefined();
    expect(setActiveParagraph(c, 'nie-ma', 2)).toBe(false);
  });

  it('a stored paragraph that is no longer open counts as § 1', () => {
    const c = at(3, { paragraphs: { wirowanie: 3 } });
    expect(activeParagraph(c, 'wirowanie')).toBe(1);
    expect(isParagraphUnlocked(c, 'wirowanie', 3)).toBe(false);
  });
});

describe('on a run', () => {
  it('applyParagraphs lays the open ones on the hero and drops the rest', () => {
    const s = createRun(3, { heroId: 'pralka' });
    s.player.level = 7;
    applyParagraphs(s, { wirowanie: 2, pranieWstepne: 3, nie_ma: 2 });
    expect(s.hero.para).toEqual([2, 1, 1, 1, 1]);
    expect(s.hero.patch?.[0]).toBeDefined();
    expect(s.hero.patch?.[1]).toBeUndefined();
    expect(activeParagraphsOf(s)).toEqual({ wirowanie: 2 });
    applyParagraphs(s, undefined);
    expect(s.hero.para).toBeUndefined();
    expect(s.hero.patch).toBeUndefined();
  });

  it('setRunParagraph switches, refuses what is shut, and leaves no trace when everything is § 1 again', () => {
    const s = createRun(3, { heroId: 'pralka' });
    expect(setRunParagraph(s, 'wirowanie', 2)).toBe(false);
    expect(setRunParagraph(s, 'wirowanie', 2, true)).toBe(true);
    expect(s.hero.para?.[0]).toBe(2);
    s.player.level = 15;
    expect(setRunParagraph(s, 'pranieWstepne', 3)).toBe(true);
    expect(activeParagraphsOf(s)).toEqual({ wirowanie: 2, pranieWstepne: 3 });
    expect(setRunParagraph(s, 'wirowanie', 1)).toBe(true);
    expect(setRunParagraph(s, 'pranieWstepne', 1)).toBe(true);
    expect(s.hero.para).toBeUndefined();
  });
});

describe('the character save', () => {
  it('round-trips the active paragraphs through JSON and back onto a fresh run', () => {
    const a = createRun(5, { heroId: 'konsultant' });
    a.player.level = 24;
    a.player.permissions.push('powiadomienia');
    expect(applyUpgrade(a, 'skill4')).toBe(true);
    expect(setRunParagraph(a, 'prosze', 3)).toBe(true);
    expect(setRunParagraph(a, 'numer', 2)).toBe(true);
    const saved = serializeCharacter(a);
    expect(saved.paragraphs).toEqual({ prosze: 3, numer: 2 });
    const c = toCharacter(JSON.parse(JSON.stringify(saved)));
    expect(c?.paragraphs).toEqual({ prosze: 3, numer: 2 });
    if (!c) return;
    const b = createRun(9, { heroId: 'konsultant', character: c });
    expect(b.hero.para).toEqual([3, 1, 1, 2, 1]);
    expect(b.hero.patch?.[0]).toEqual(paragraphsOf('konsultant', 'prosze')[2]?.patch);
    expect(serializeCharacter(b).paragraphs).toEqual({ prosze: 3, numer: 2 });
  });

  it('an old save has no paragraphs and loads with § 1 active, byte for byte as before', () => {
    const old = JSON.parse(JSON.stringify(emptyCharacter('pralka'))) as Record<string, unknown>;
    delete old['paragraphs'];
    const c = toCharacter(old);
    expect(c).not.toBeNull();
    expect(c && 'paragraphs' in c).toBe(false);
    if (!c) return;
    const s = createRun(1, { heroId: 'pralka', character: c });
    expect(s.hero.para).toBeUndefined();
    expect(s.hero.patch).toBeUndefined();
    expect(serializeCharacter(s)).not.toHaveProperty('paragraphs');
  });

  it('damaged paragraph fields are dropped, and a paragraph not open is not applied', () => {
    const c = toCharacter({ ...emptyCharacter('pralka'), paragraphs: { wirowanie: 9, nie_ma: 2, pranieWstepne: 'x', odwirowanie: 3 } });
    expect(c?.paragraphs).toEqual({ odwirowanie: 3 });
    if (!c) return;
    const s = createRun(1, { heroId: 'pralka', character: c }); // level 1: § 3 is shut
    expect(s.hero.para).toBeUndefined();
    const other = createRun(1, { heroId: 'konsultant', character: c }); // another hero: the record does not belong to it
    expect(other.hero.para).toBeUndefined();
  });
});

describe('applyCharacter', () => {
  it('keeps § 1 when the hero differs from the record', () => {
    const s = createRun(2, { heroId: 'petlowiec' });
    applyCharacter(s, { ...emptyCharacter('pralka'), level: 40, paragraphs: { wirowanie: 2 } });
    expect(s.hero.para).toBeUndefined();
  });
});
