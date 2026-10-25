import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { t } from '../i18n';
import { rollItem } from '../items/generate';
import { itemValue } from '../items/generate';
import { UNIQUES_BY_ID, makeUnique } from '../items/uniques';
import { makeSetPiece } from '../items/setPieces';
import { createRun } from '../world/run';
import { binItem, binValue, needsAsk } from './kosz';

describe('Odrzuć do kosza (ITEMS 8)', () => {
  it('pays 10% of the list price, without a fee, and takes the item out of the bag', () => {
    const p = createRun(1, { phase: 'run' }).player;
    const item = rollItem(createRng(4), { level: 20, tier: 'nietypowy' });
    p.inventory.push(item);
    p.gwiazdki = 3;
    const res = binItem(p, item);
    expect(res.ok).toBe(true);
    expect(p.inventory).not.toContain(item);
    expect(p.gwiazdki).toBe(3 + Math.max(1, Math.round(itemValue(item) * 0.1)));
    expect(binValue(item)).toBe(res.ok ? res.gwiazdki : -1);
  });

  it('a worn item can be binned too (the slot empties)', () => {
    const p = createRun(2, { phase: 'run' }).player;
    const item = rollItem(createRng(5), { level: 5, tier: 'zwykly' });
    p.equipment[item.slot] = item;
    expect(binItem(p, item).ok).toBe(true);
    expect(p.equipment[item.slot]).toBeUndefined();
  });

  it('rzadki, zestaw and unikatowy ask once; zwykły and nietypowy do not', () => {
    const rng = createRng(6);
    expect(needsAsk(rollItem(rng, { level: 5, tier: 'zwykly' }))).toBe(false);
    expect(needsAsk(rollItem(rng, { level: 5, tier: 'nietypowy' }))).toBe(false);
    expect(needsAsk(rollItem(rng, { level: 5, tier: 'rzadki' }))).toBe(true);
    const piece = makeSetPiece(rng, 'serwis', 5, 0);
    expect(piece && needsAsk(piece)).toBe(true);
  });

  it('a wycofany z obiegu item is refused and stays', () => {
    const p = createRun(3, { phase: 'run' }).player;
    const item = rollItem(createRng(7), { level: 5, tier: 'rzadki' });
    item.affixes.push('wycofany');
    p.inventory.push(item);
    const res = binItem(p, item);
    expect(res).toEqual({ ok: false, message: t('items.absurd.wycofanyOwn') });
    expect(p.inventory).toContain(item);
    expect(p.gwiazdki).toBe(createRun(3, { phase: 'run' }).player.gwiazdki);
  });

  it('a binned unique is noted by the Asystent', () => {
    const p = createRun(4, { phase: 'run' }).player;
    const def = UNIQUES_BY_ID.get('odmowa');
    const unique = def ? makeUnique(def, 9, 6) : null;
    if (!unique) throw new Error('no unique');
    p.inventory.push(unique);
    const res = binItem(p, unique);
    expect(res.ok && res.notes).toContain(t('economy.kosz.unique'));
  });
});
