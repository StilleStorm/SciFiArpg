import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { AFFIXES_BY_ID } from '../items/affixes';
import { rollItem } from '../items/generate';
import { makeSetPiece } from '../items/setPieces';
import { SETS_BY_ID } from '../items/sets';
import { UNIQUES_BY_ID, makeUnique } from '../items/uniques';
import type { Item } from '../items/types';
import { t } from '../i18n';
import { reclaim, reclaimRefusal, reklamacjaCost, reklamacjaWords, rerollable, timesReclaimed } from './reklamacja';

/** A rzadki with at least one line a reclaim may touch. */
function rare(seed: number): Item {
  const rng = createRng(seed);
  for (let i = 0; i < 200; i++) {
    const item = rollItem(rng, { level: 12, tier: 'rzadki' });
    if (!item.uniqueId && rerollable(item).length > 0 && !item.plain) return item;
  }
  throw new Error('no rare item with a rerollable line');
}

const purse = (n: number) => ({ gwiazdki: n });

describe('Reklamacja (ITEMS 7.3)', () => {
  it('re-rolls one affix of the same grade and moves the numbers; the old line is recorded as struck', () => {
    const item = rare(3);
    const before = [...item.affixes];
    const claimed = { ...item.claimed };
    const p = purse(500);
    const res = reclaim(p, item, 0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const changed = item.affixes.map((a, i) => (a !== before[i] ? i : -1)).filter((i) => i >= 0);
    expect(changed).toHaveLength(1);
    const at = changed[0] ?? 0;
    expect(AFFIXES_BY_ID.get(item.affixes[at] ?? '')?.grade).toBe(AFFIXES_BY_ID.get(before[at] ?? '')?.grade);
    expect(item.reklamacje).toEqual([{ planet: 0, struck: before[at], typed: item.affixes[at], mod: expect.any(Number) }]);
    expect(item.claimed).not.toEqual(claimed);
    expect(item.name.length).toBeGreaterThan(0);
    expect(reklamacjaWords(item)).toHaveLength(1);
    expect(p.gwiazdki).toBe(500 - res.cost);
  });

  it('costs 10 x tier x (1 + 0.5 x times): a rzadki 60, 90, 120; a zestaw piece 100', () => {
    const item = rare(4);
    expect(reklamacjaCost(item)).toBe(60);
    item.reklamacje = [{ planet: 0, struck: 'a', typed: 'b', mod: 1 }];
    expect(reklamacjaCost(item)).toBe(90);
    item.reklamacje.push({ planet: 1, struck: 'a', typed: 'b', mod: 1 });
    expect(reklamacjaCost(item)).toBe(120);
    expect(timesReclaimed(item)).toBe(2);
    const piece = makeSetPiece(createRng(5), 'serwis', 10, 0);
    expect(piece && reklamacjaCost(piece)).toBe(100);
  });

  it('once per item per planet; another planet is open again, at the higher price', () => {
    const item = rare(5);
    const p = purse(900);
    expect(reclaim(p, item, 2).ok).toBe(true);
    const again = reclaim(p, item, 2);
    expect(again.ok).toBe(false);
    expect(!again.ok && again.reason).toBe('planet');
    const spent = 900 - p.gwiazdki;
    const next = reclaim(p, item, 3);
    expect(next.ok).toBe(true);
    expect(next.ok && next.cost).toBe(90);
    expect(900 - p.gwiazdki).toBe(spent + 90);
  });

  it('is a pure function of the item and how often it was reclaimed', () => {
    const a = rare(6);
    const b: Item = JSON.parse(JSON.stringify(a)) as Item;
    reclaim(purse(500), a, 0);
    reclaim(purse(500), b, 0);
    expect(a.affixes).toEqual(b.affixes);
    expect(a.claimed).toEqual(b.claimed);
  });

  it('refuses a unique, a wycofany item, an item in its trial; poor purse changes nothing', () => {
    const def = UNIQUES_BY_ID.get('odmowa');
    const unique = def ? makeUnique(def, 77, 8) : null;
    expect(unique && reclaimRefusal(unique, 0)?.reason).toBe('unique');
    const item = rare(7);
    item.affixes.push('wycofany');
    expect(reclaimRefusal(item, 0)?.reason).toBe('withdrawn');
    const p = purse(500);
    const res = reclaim(p, item, 0);
    expect(res.ok).toBe(false);
    expect(p.gwiazdki).toBe(500);
    const poor = rare(8);
    const before = JSON.stringify(poor);
    const refused = reclaim(purse(5), poor, 0);
    expect(!refused.ok && refused.reason).toBe('poor');
    expect(JSON.stringify(poor)).toBe(before);
  });

  it('never touches the fixed lines of a set piece, and a set piece keeps its set', () => {
    const def = SETS_BY_ID.get('serwis');
    for (let seed = 1; seed <= 12; seed++) {
      const piece = makeSetPiece(createRng(seed), 'serwis', 10, 0);
      if (!piece || !def) throw new Error('no piece');
      const fixed = piece.affixes.slice(0, 2);
      expect(rerollable(piece).every((i) => i >= 2)).toBe(true);
      const res = reclaim(purse(900), piece, 0);
      if (res.ok) {
        expect(piece.affixes.slice(0, 2)).toEqual(fixed);
        expect(piece.setId).toBe('serwis');
      }
    }
  });

  it('the Asystent: first time, a lying item, the third reclaim; each reclaim adds one opinion', () => {
    const honest = rare(9);
    honest.review = { rating: 4.2, count: 100, truth: 'honest' };
    const first = reclaim(purse(900), honest, 0);
    expect(first.ok && first.note).toBe(t('economy.reklamacja.note.first'));
    expect(honest.review?.count).toBe(101);
    const liar = rare(10);
    liar.review = { rating: 4.9, count: 900, truth: 'bought' };
    const second = reclaim(purse(900), liar, 0);
    expect(second.ok && second.note).toBe(t('economy.reklamacja.note.lying'));
    const triple = rare(11);
    triple.reklamacje = [
      { planet: 0, struck: 'x', typed: 'y', mod: 1 },
      { planet: 1, struck: 'x', typed: 'y', mod: 1 },
    ];
    const third = reclaim(purse(900), triple, 2);
    expect(third.ok && third.note).toBe(t('economy.reklamacja.note.third'));
  });
});
