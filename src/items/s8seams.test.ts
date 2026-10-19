import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { earnStars } from '../economy/stars';
import { makeListing } from '../economy/sklep';
import { createPlayer } from '../entities/factory';
import { t } from '../i18n';
import { AFFIX_MARK, affixMarks } from '../render/itemMarks';
import { disposalRefusal, pageEntryAll } from './absurd';
import { AFFIXES } from './affixes';
import { BASES_BY_ID, oddStats } from './bases';
import { buildItem, rollItem, statsFor } from './generate';
import { recomputeStats, wearerDefence } from './stats';
import { SLOTS, type Item } from './types';

const base = (id: string) => {
  const b = BASES_BY_ID.get(id);
  if (!b) throw new Error(id);
  return b;
};
const item = (baseId: string, affixes: string[], seed = 1): Item => buildItem(createRng(seed), base(baseId), 'nietypowy', 3, affixes);

describe('S8 seams: odd base stats', () => {
  it('turn into tempo, gwiazdki and proba, unscaled by level', () => {
    expect(oddStats(base('pilot'))).toMatchObject({ tempo: -5 });
    expect(oddStats(base('zegarek'))).toMatchObject({ proba: -30 });
    expect(statsFor(base('liczydlo'), [], 9, 'rzadki').gwiazdki).toBe(15);
    expect(statsFor(base('faktura'), [], 1, 'zwykly').gwiazdki).toBe(10);
  });
});

describe('S8 seams: recomputeStats reads the percentages', () => {
  it('tempo shortens the cooldown, zasieg widens the reach, gwiazdki sets the star bonus', () => {
    const p = createPlayer(1, 0, 0);
    recomputeStats(p);
    const cd = p.attackCooldown;
    const range = p.attackRange;
    const pilot = item('pilot', []);
    pilot.claimed.tempo = -10;
    pilot.claimed.zasieg = 20;
    pilot.claimed.gwiazdki = 15;
    p.equipment.przyrzad = pilot;
    recomputeStats(p);
    expect(p.attackCooldown).toBeCloseTo(cd * 0.9);
    expect(p.attackRange).toBeCloseTo(range * 1.2);
    expect(p.starBonus).toBe(15);
  });
  it('earnStars pays the bonus through a carry', () => {
    const p = { gwiazdki: 0, starBonus: 50 };
    earnStars(p, 1);
    earnStars(p, 1);
    expect(p.gwiazdki).toBe(3);
  });
});

describe('S8 seams: domniemany on the wearer', () => {
  it('about one hit in five ignores the item resist; without the affix nothing rolls', () => {
    const p = createPlayer(1, 0, 0);
    const it = item('kask', ['domniemany']);
    p.equipment.nakrycie = it;
    recomputeStats(p);
    const full = p.stats.resist.egzystencjalny ?? 0;
    const rng = createRng(7);
    let ignored = 0;
    for (let i = 0; i < 2000; i++) if ((wearerDefence(p, rng).resist.egzystencjalny ?? 0) < full) ignored++;
    expect(ignored / 2000).toBeGreaterThan(0.15);
    expect(ignored / 2000).toBeLessThan(0.25);
    const plain = createPlayer(1, 0, 0);
    recomputeStats(plain);
    const r = createRng(3);
    const before = r.next();
    const r2 = createRng(3);
    expect(wearerDefence(plain, r2)).toBe(plain.stats);
    expect(r2.next()).toBe(before);
  });
});

describe('S8 seams: page entry for the whole character', () => {
  it('counts the trial on worn items only and asks for a recompute when it ends', () => {
    const p = createPlayer(1, 0, 0);
    const worn = item('kask', ['probny']);
    const bag = item('czapka', ['probny']);
    p.equipment.nakrycie = worn;
    p.inventory.push(bag);
    const rng = createRng(5);
    expect(pageEntryAll(p, rng).changed).toBe(false);
    const second = pageEntryAll(p, rng);
    expect(second.changed).toBe(true);
    expect(second.notes).toContain(t('items.absurd.probny'));
    expect(bag.absurd?.pagesWorn ?? 0).toBe(0);
  });
});

describe('S8 seams: withdrawn items', () => {
  it('may only be dropped; the Sklep refuses a sale by its footnote', () => {
    const w = item('kask', ['wycofany']);
    expect(disposalRefusal(w, 'drop')).toBeNull();
    expect(disposalRefusal(w, 'sell')).toBe(t('items.absurd.wycofany'));
    expect(disposalRefusal(w, 'bin')).toBe(t('items.absurd.wycofanyOwn'));
    expect(disposalRefusal(w, 'reklamacja')).toBe(t('items.absurd.wycofanyOwn'));
    expect(disposalRefusal(item('kask', []), 'sell')).toBeNull();
  });
  it('the Sklep never stocks one (drops do carry it)', () => {
    const r = createRng(1);
    let drops = 0;
    for (let i = 0; i < 600; i++) {
      if (rollItem(r, { tier: 'rzadki', slot: 'bron', level: 6 }).affixes.includes('wycofany')) drops++;
      expect(rollItem(r, { tier: 'rzadki', slot: 'bron', level: 6, shop: true }).affixes).not.toContain('wycofany');
    }
    expect(drops).toBeGreaterThan(0);
    const rng = createRng(11);
    for (let i = 0; i < 600; i++) {
      const l = makeListing(rng, i, 6, SLOTS[i % SLOTS.length] ?? 'bron', 0.5);
      expect(l.item.affixes).not.toContain('wycofany');
      expect(l.delivered.affixes).not.toContain('wycofany');
    }
  });
});

describe('S8 seams: marks follow the real affix ids', () => {
  it('every absurd affix has a mark', () => {
    for (const a of AFFIXES) if (a.absurd) expect(affixMarks({ tier: 'zwykly', affixes: [a.id] })).toContain(AFFIX_MARK[a.absurd]);
  });
});
