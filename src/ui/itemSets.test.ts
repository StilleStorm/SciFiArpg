/** The notes said when a set piece or a unique is put on (S17). */
import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { t } from '../i18n';
import { equipItem } from '../items/inventory';
import { makeSetPiece } from '../items/setPieces';
import { wornSetCounts } from '../items/sets';
import { UNIQUES_BY_ID, makeUnique } from '../items/uniques';
import { createRun } from '../world/run';
import { equipNotes, heroNote } from './itemSets';

function put(s: ReturnType<typeof createRun>, item: NonNullable<ReturnType<typeof makeSetPiece>>, number: number): string[] {
  item.number = number;
  s.player.inventory.push(item);
  const before = wornSetCounts(s.player.equipment);
  equipItem(s.player, item);
  return equipNotes(s.player, item, before);
}

describe('notes on putting on', () => {
  it('the joint footnote of a set comes with the second piece, the completion with the third, nothing before', () => {
    const s = createRun(5);
    const piece = (i: 0 | 1 | 2) => {
      const item = makeSetPiece(createRng(10 + i), 'serwis', 4, i);
      if (!item) throw new Error('piece');
      return item;
    };
    expect(put(s, piece(0), 1)).toEqual([]);
    expect(put(s, piece(1), 2)).toEqual([t('items.set.serwis.note')]);
    expect(t('items.set.serwis.note')).toBe('Usterkę usunięto. Usterki nie stwierdzono.');
    expect(put(s, piece(2), 3)).toEqual([t('items.set.complete', { name: t('items.set.serwis.name') })]);
  });

  it('a unique whose paragraph is another hero\'s says so, and the archive names the hero it concerns', () => {
    const def = UNIQUES_BY_ID.get('oczekiwanie');
    const item = def ? makeUnique(def, 77, 4) : null;
    if (!item) throw new Error('unique');
    const mine = createRun(5, { heroId: 'konsultant' });
    mine.player.inventory.push(item);
    const before = wornSetCounts(mine.player.equipment);
    equipItem(mine.player, item);
    expect(equipNotes(mine.player, item, before)).toEqual([]);
    const other = createRun(5, { heroId: 'pralka' });
    expect(equipNotes(other.player, item, {})).toEqual([t('items.unique.notYoursNote')]);
    expect(heroNote(item)).toBe('Paragraf dotyczy: Konsultant Infolinii.');
    const plain = UNIQUES_BY_ID.get('odmowa');
    const old = plain ? makeUnique(plain, 78, 4) : null;
    expect(old && heroNote(old)).toBeNull();
  });
});
