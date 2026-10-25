import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import type { OfferEntry } from '../heroes/state';
import { createRun, type RunState } from '../world/run';
import { applyCharacter, serializeCharacter, toCharacter } from '../save/character';
import { runParagraph, setRunParagraph } from './paragraphs';
import { applyUpgrade, availableEntries, composeOffer, confirmUpdate, entryView, offerVersion, paragraphEntries, parseParagraphId, pickFeature, reroll, rollOffer } from './update';

const run = (level: number, seed = 5): RunState => {
  const s = createRun(seed, { heroId: 'pralka' });
  s.player.level = level;
  return s;
};
/** Pralka with every skill past the fifth installed (S19), so that no new skill leads the offer in front of a paragraph. */
const settled = (level: number): RunState => {
  const s = run(level);
  for (const id of ['skill6', 'skill7', 'skill8', 'skill9', 'skill10']) applyUpgrade(s, id);
  return s;
};
const e = (id: string): OfferEntry => ({ id, rank: 1, locked: false });

describe('pickFeature', () => {
  it('prefers an unlocked new skill, then a paragraph, else nothing', () => {
    expect(pickFeature({ newSkill: [e('skill4')], paragraph: [e('para:0:2')] })?.id).toBe('skill4');
    expect(pickFeature({ newSkill: [], paragraph: [e('para:0:2')] })?.id).toBe('para:0:2');
    expect(pickFeature({ newSkill: [], paragraph: [] })).toBeNull();
  });
});

describe('paragraph entries', () => {
  it('lead only at the level a paragraph opens: § 2 at skill level + 6, § 3 at + 14', () => {
    expect(paragraphEntries(run(6))).toEqual([]);
    expect(paragraphEntries(run(7)).map((x) => x.id)).toEqual(['para:0:2', 'para:1:2', 'para:2:2']);
    expect(paragraphEntries(run(8))).toEqual([]);
    expect(paragraphEntries(run(15)).map((x) => x.id)).toEqual(['para:0:3', 'para:1:3', 'para:2:3']);
  });

  it('follow the oldest queued level, skip an active paragraph and a skill not installed', () => {
    const s = run(9);
    s.hero.pendingLevels = 3;
    expect(offerVersion(s)).toBe(7);
    expect(setRunParagraph(s, 'wirowanie', 2)).toBe(true);
    const ids = paragraphEntries(s).map((x) => x.id);
    expect(ids).toEqual(['para:1:2', 'para:2:2']);
    expect(paragraphEntries(run(11)).some((x) => x.id.startsWith('para:3'))).toBe(false); // beben (level 5) is not installed
  });
});

describe('composeOffer', () => {
  it('leads with the feature and adds two passive or stat entries', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = run(7, seed);
      const feature = paragraphEntries(s)[0] ?? null;
      const out = composeOffer('pralka', feature, availableEntries(s), createRng(seed));
      expect(out).toHaveLength(3);
      expect(out[0]).toEqual(feature);
      expect(out.slice(1).every((x) => /^(passive|racja|pewnosc|upor|resist_|trial|gwiazdki)/.test(x.id))).toBe(true);
      expect(new Set(out.map((x) => x.id)).size).toBe(3);
    }
  });

  it('without a feature draws three from the whole pool', () => {
    const s = run(2);
    expect(composeOffer('pralka', null, availableEntries(s), createRng(3))).toHaveLength(3);
  });
});

describe('the offer on a level up', () => {
  it('carries a paragraph entry at level 7 and keeps it through the problem report', () => {
    const s = settled(7);
    const offer = rollOffer(s, 0);
    expect(offer.entries).toHaveLength(3);
    expect(offer.entries[0]?.id).toBe('para:0:2');
    s.hero.offer = offer;
    const again = reroll(s);
    expect(again?.entries[0]?.id).toBe('para:0:2');
    expect(again?.entries).toHaveLength(3);
  });

  it('shows the paragraph on the form with its skill and number', () => {
    const s = run(7);
    const view = entryView(s, { id: 'para:1:2', rank: 1, locked: false });
    expect(view.title).toContain('2');
    expect(view.tag.length).toBeGreaterThan(0);
    expect(view.locked).toBe(false);
  });

  it('picking it makes the paragraph active without an upgrade record; the character save keeps it', () => {
    const s = settled(7);
    s.hero.offer = rollOffer(s, 0);
    expect(confirmUpdate(s, 'para:0:2')).toBe(true);
    expect(runParagraph(s, 0)).toBe(2);
    expect(s.hero.patch?.[0]).toBeDefined();
    expect(Object.keys(s.hero.upgrades).some((id) => id.startsWith('para'))).toBe(false);
    const c = toCharacter(JSON.parse(JSON.stringify(serializeCharacter(s))));
    expect(c?.paragraphs).toEqual({ wirowanie: 2 });
    const fresh = createRun(5, { heroId: 'pralka' });
    if (c) applyCharacter(fresh, c);
    expect(runParagraph(fresh, 0)).toBe(2);
  });

  it('refuses a paragraph whose level has not come, and § 1 clears the record', () => {
    const s = run(7);
    expect(setRunParagraph(s, 'wirowanie', 3)).toBe(false);
    expect(setRunParagraph(s, 'wirowanie', 2)).toBe(true);
    expect(setRunParagraph(s, 'wirowanie', 1)).toBe(true);
    expect(runParagraph(s, 0)).toBe(1);
    expect(s.hero.para).toBeUndefined();
  });

  it('parses its own ids and nothing else', () => {
    expect(parseParagraphId('para:2:3')).toEqual({ skill: 2, n: 3 });
    expect(parseParagraphId('para:2:1')).toBeNull();
    expect(parseParagraphId('skill1')).toBeNull();
    expect(parseParagraphId('para:11:2')).toBeNull();
  });
});
