import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { t } from '../i18n';
import { onPageEntry, hitIgnoresItem, isWithdrawn, TRIAL_PAGES } from './absurd';
import { AFFIXES, AFFIXES_BY_ID, canCombine, effectFor, modelToken } from './affixes';
import { BASES, BASES_BY_ID } from './bases';
import { buildItem, rollItem, statsFor } from './generate';
import { affixesOf, nameItem, nameParts } from './grammar';
import { MOD_MULTIPLIER, modTierForLevel, modTierMark, rollModTier } from './tiers';
import { SLOTS, STAT_KEYS, type Item } from './types';

const base = (id: string) => {
  const b = BASES_BY_ID.get(id);
  if (!b) throw new Error(id);
  return b;
};
const GENDERS = ['m', 'f', 'n', 'pl'] as const;

describe('the pool', () => {
  it('has 32 affixes, 6 of them absurd, 15 new', () => {
    expect(AFFIXES.length).toBe(32);
    expect(AFFIXES.filter((a) => a.absurd).length).toBe(6);
    const old = ['gwarancyjny', 'zweryfikowany', 'odnowiony', 'poleasingowy', 'uzywany', 'sponsorowany', 'nieuchronny', 'domniemany', 'ewentualny', 'zgodny', 'wzmocniony', 'certyfikowany', 'markowy', 'oryginalny', 'limitowany', 'fabrycznienowy', 'darmowy'];
    expect(old.length).toBe(17);
    expect(AFFIXES.filter((a) => !old.includes(a.id)).length).toBe(15);
  });
  it('has forms for all four genders and a model token for every non-phrase affix', () => {
    for (const a of AFFIXES) {
      for (const g of GENDERS) expect(t(`items.affix.${a.id}.${g}`)).not.toContain('items.');
      if (a.model) expect(modelToken(a.id)).not.toContain('items.');
      else expect(a.phrase).toBe(true);
    }
  });
  it('adjectival affixes inflect: m, f, n differ and n equals pl', () => {
    for (const a of AFFIXES.filter((x) => !x.phrase && x.id !== 'zgodny' && x.id !== 'fabrycznienowy')) {
      const f = (g: string) => t(`items.affix.${a.id}.${g}`);
      expect(f('m')).not.toBe(f('f'));
      expect(f('n')).toBe(f('pl'));
    }
  });
  it('names agree with the noun for every affix on a base of each gender', () => {
    const bases = ['pieczatka', 'kask', 'urzadzenie', 'sluchawki'].map(base);
    for (const b of bases) {
      for (const a of AFFIXES) {
        const name = nameItem(b, [a]);
        expect(name).toContain(t(`items.affix.${a.id}.${b.gender}`));
        expect(name).not.toContain('items.');
      }
    }
  });
  it('the slot gates follow the table', () => {
    const gate = (id: string) => AFFIXES_BY_ID.get(id)?.slots;
    expect(gate('sluzbowy')).toEqual(['bron']);
    expect(gate('podpisany')).toEqual(['dokument']);
    expect(gate('dalekosiezny')).toEqual(['bron']);
    expect(gate('antywstrzasowy')).toEqual(['nakrycie', 'odziez']);
    expect(gate('zgodny')).toBeUndefined();
  });
  it('wycofany z obiegu is damage on weapons and a resist on body and documents', () => {
    const w = AFFIXES_BY_ID.get('wycofany');
    if (!w) throw new Error('x');
    expect(effectFor(w, 'bron').dmgMax).toBe(4);
    expect(effectFor(w, 'odziez').resMechaniczny).toBe(8);
    expect(effectFor(w, 'dokument').resRegulaminowy).toBe(8);
  });
});

describe('tiers I-V', () => {
  it('follow the level bands', () => {
    const at = [1, 8, 9, 16, 17, 24, 25, 32, 33, 40, 55].map(modTierForLevel);
    expect(at).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5]);
  });
  it('roll 70% the band and 30% one below, never above', () => {
    const rng2 = createRng(4);
    let band = 0;
    let below = 0;
    for (let i = 0; i < 4000; i++) {
      const v = rollModTier(rng2, 20);
      expect([2, 3]).toContain(v);
      if (v === 3) band++;
      else below++;
    }
    expect(band / 4000).toBeGreaterThan(0.66);
    expect(band / 4000).toBeLessThan(0.74);
    expect(below).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) expect(rollModTier(rng2, 3)).toBe(1);
  });
  it('scale the affix by the table and the register mark is a roman numeral', () => {
    const b = base('pieczatka');
    const a = affixesOf(['poleasingowy']);
    const dmg = (t5: 1 | 2 | 3 | 4 | 5) => statsFor(b, a, 1, 'zwykly', t5).dmgMax - statsFor(b, [], 1, 'zwykly', t5).dmgMax;
    expect(dmg(1)).toBe(2);
    expect(dmg(2)).toBe(3);
    expect(dmg(3)).toBe(4);
    expect(dmg(4)).toBe(Math.round(2 * MOD_MULTIPLIER[4]));
    expect(dmg(5)).toBe(7);
    expect([1, 2, 3, 4, 5].map((n) => modTierMark(n as 1))).toEqual(['', '(II)', '(III)', '(IV)', '(V)']);
  });
  it('keep percentage stats sane at tier V', () => {
    const s = statsFor(base('czytnik'), affixesOf(['testowany', 'serwisowy']), 40, 'rzadki', 5);
    expect(s.proba).toBeGreaterThanOrEqual(-70);
    expect(s.tempo).toBeGreaterThanOrEqual(-35);
  });
});

describe('roll rules', () => {
  const rolls = (n: number, tier: 'zwykly' | 'nietypowy' | 'rzadki', slot?: (typeof SLOTS)[number], seed = 21): Item[] => {
    const rng = createRng(seed);
    const out: Item[] = [];
    for (let i = 0; i < n; i++) out.push(rollItem(rng, { level: 1 + (i % 40), tier, slot }));
    return out;
  };
  it('zwykły: 40% none, otherwise one grade 1', () => {
    const items = rolls(3000, 'zwykly');
    const none = items.filter((i) => i.affixes.length === 0).length / items.length;
    expect(none).toBeGreaterThan(0.36);
    expect(none).toBeLessThan(0.44);
    for (const i of items) for (const a of affixesOf(i.affixes)) expect(a.grade).toBe(1);
  });
  it('nietypowy has grade 1-2, rzadki 2-3 affixes with at least one grade 2+', () => {
    for (const i of rolls(1500, 'nietypowy')) {
      expect(i.affixes.length).toBeGreaterThanOrEqual(1);
      expect(i.affixes.length).toBeLessThanOrEqual(2);
      for (const a of affixesOf(i.affixes)) expect(a.grade).toBeLessThanOrEqual(2);
    }
    for (const i of rolls(3000, 'rzadki')) {
      expect(i.affixes.length).toBeGreaterThanOrEqual(2);
      expect(i.affixes.length).toBeLessThanOrEqual(3);
      expect(affixesOf(i.affixes).some((a) => a.grade >= 2)).toBe(true);
    }
  });
  it('respects slot gates and exclusions on every slot', () => {
    for (const slot of SLOTS) {
      for (const i of rolls(1200, 'rzadki', slot, 30 + SLOTS.indexOf(slot))) {
        const af = affixesOf(i.affixes);
        for (const a of af) if (a.slots) expect(a.slots).toContain(slot);
        expect(new Set(af.map((a) => a.family)).size).toBe(af.length);
        expect(af.filter((a) => ['odpMech', 'odpReg', 'odpEgz'].includes(a.family)).length).toBeLessThanOrEqual(2);
        expect(af.filter((a) => a.absurd).length).toBeLessThanOrEqual(1);
        expect(af.filter((a) => a.phrase).length).toBeLessThanOrEqual(1);
        expect(i.affixes.includes('rzekomy') && i.affixes.includes('testowany')).toBe(false);
        expect(i.affixes.filter((x) => x === 'darmowy').length).toBeLessThanOrEqual(1);
        expect(nameParts(af).adjectives.length).toBeLessThanOrEqual(2);
      }
    }
  });
  it('the exclusions are enforced by canCombine directly', () => {
    const f = (...ids: string[]) => affixesOf(ids);
    const n = (id: string) => {
      const a = AFFIXES_BY_ID.get(id);
      if (!a) throw new Error(id);
      return a;
    };
    expect(canCombine(f('gwarancyjny'), n('przemyslowy'))).toBe(false);
    expect(canCombine(f('uzywany', 'zgodny'), n('udokumentowany'))).toBe(false);
    expect(canCombine(f('uzywany', 'zgodny'), n('gwarancyjny'))).toBe(true);
    expect(canCombine(f('domniemany'), n('sponsorowany'))).toBe(false);
    expect(canCombine(f('probny'), n('darmowy'))).toBe(false);
    expect(canCombine(f('rzekomy'), n('testowany'))).toBe(false);
    expect(canCombine(f('testowany'), n('rzekomy'))).toBe(false);
  });
  it('every affix can appear: each is rolled at least once over the slots it fits', () => {
    const seen = new Set<string>();
    for (const slot of SLOTS) for (const i of rolls(4000, 'rzadki', slot, 90)) for (const id of i.affixes) seen.add(id);
    for (const a of AFFIXES) expect(seen.has(a.id), a.id).toBe(true);
  });
  it('the shop halves grade 3: it reads plainer than drops', () => {
    const share = (shop: boolean): number => {
      const rng = createRng(77);
      let g3 = 0;
      let all = 0;
      for (let i = 0; i < 3000; i++) {
        const it = rollItem(rng, { level: 10, tier: 'rzadki', shop });
        for (const a of affixesOf(it.affixes)) {
          if (a.free) continue;
          all++;
          if (a.grade === 3) g3++;
        }
      }
      return g3 / all;
    };
    expect(share(true)).toBeLessThan(share(false) - 0.02);
  });
  it('item stats are integers and carry the tier mark only above I', () => {
    for (const i of rolls(500, 'rzadki')) {
      for (const k of STAT_KEYS) expect(Number.isInteger(i.claimed[k])).toBe(true);
      expect(i.modTier === undefined || i.modTier > 1).toBe(true);
      expect(i.modTier ?? 1).toBeLessThanOrEqual(modTierForLevel(i.level));
    }
  });
  it('is deterministic by seed', () => {
    expect(rolls(50, 'rzadki', undefined, 5)).toEqual(rolls(50, 'rzadki', undefined, 5));
  });
  it('names stay valid: no raw keys, at most one model, bases of all slots', () => {
    for (const i of rolls(800, 'rzadki')) {
      expect(i.name).not.toContain('items.');
      expect((i.name.match(/model «/g) ?? []).length).toBeLessThanOrEqual(1);
      if (i.affixes.length === 3 && i.affixes.length === affixesOf(i.affixes).length) expect(i.name).toContain(', model «');
    }
    expect(BASES.length).toBeGreaterThan(0);
  });
});

describe('absurd mechanics', () => {
  const mk = (baseId: string, ids: string[], level = 1, seed = 1): Item => buildItem(createRng(seed), base(baseId), 'rzadki', level, ids);

  it('ewentualny is re-rolled between 50% and 150% on each page entry', () => {
    const item = mk('kask', ['ewentualny']);
    const nominal = item.absurd?.ewentNominal ?? 0;
    expect(nominal).toBe(16);
    const rng = createRng(2);
    const base0 = item.claimed.pewnosc - nominal;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 300; i++) {
      onPageEntry(item, rng, true);
      const v = item.claimed.pewnosc - base0;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThanOrEqual(8);
    expect(hi).toBeLessThanOrEqual(24);
    expect(hi - lo).toBeGreaterThan(8);
  });
  it('w wersji próbnej gives +20% and expires after two pages with a footnote', () => {
    const item = mk('czytnik', ['probny']);
    const plain = mk('czytnik', []);
    expect(item.claimed.pewnosc).toBe(Math.round(plain.claimed.pewnosc * 1.2));
    const rng = createRng(1);
    expect(onPageEntry(item, rng, false).changed).toBe(false);
    expect(onPageEntry(item, rng, true).changed).toBe(false);
    expect(TRIAL_PAGES).toBe(2);
    const r = onPageEntry(item, rng, true);
    expect(r.changed).toBe(true);
    expect(r.notes).toEqual(['Okres próbny dobiegł końca.']);
    expect(item.claimed.pewnosc).toBe(plain.claimed.pewnosc);
    expect(onPageEntry(item, rng, true).changed).toBe(false);
  });
  it('sponsorowany shows one advertisement per page, only when worn', () => {
    const item = mk('karta', ['sponsorowany']);
    const rng = createRng(3);
    expect(onPageEntry(item, rng, false).notes).toEqual([]);
    const notes = onPageEntry(item, rng, true).notes;
    expect(notes.length).toBe(1);
    expect(notes[0]).toMatch(/^Reklama:/);
  });
  it('domniemany ignores one hit in five', () => {
    const item = mk('kask', ['domniemany']);
    const rng = createRng(8);
    let n = 0;
    for (let i = 0; i < 5000; i++) if (hitIgnoresItem(item, rng)) n++;
    expect(n / 5000).toBeGreaterThan(0.17);
    expect(n / 5000).toBeLessThan(0.23);
    expect(hitIgnoresItem(mk('kask', ['gwarancyjny']), rng)).toBe(false);
  });
  it('rzekomy never completes its trial and is honest within 10%', () => {
    const item = mk('kask', ['rzekomy']);
    expect(item.trialTarget).toBe(0);
    for (const k of STAT_KEYS) expect(Math.abs(item.actual[k] - item.claimed[k])).toBeLessThanOrEqual(Math.ceil(Math.abs(item.claimed[k]) * 0.1) + 1);
  });
  it('testowany shortens the trial by 30%', () => {
    expect(mk('kask', ['testowany']).trialTarget).toBe(Math.round(15 * 0.7));
  });
  it('wycofany z obiegu is recognised', () => {
    expect(isWithdrawn(mk('kask', ['wycofany']))).toBe(true);
    expect(isWithdrawn(mk('kask', ['odnowiony']))).toBe(false);
  });
});
