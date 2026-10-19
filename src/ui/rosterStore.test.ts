import { describe, expect, it } from 'vitest';
import { loadMeta, saveMeta } from '../save/save';
import type { Item } from '../items/types';
import { createRosterStore } from './rosterStore';

function memory(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}
const item = (uid: number): Item => ({ uid, number: uid }) as unknown as Item;

describe('the roster store (adapter over save/roster.ts)', () => {
  it('creates two case files with separate progress and switches between them', () => {
    const mem = memory();
    const store = createRosterStore(mem);
    const a = store.create('pralka', '0001');
    expect(a.ok).toBe(true);
    const meta = loadMeta(mem);
    if (!meta.character) throw new Error('no character');
    meta.character.level = 4;
    saveMeta(meta, mem);
    const b = store.create('kartograf', '0002');
    expect(b.ok).toBe(true);
    expect(loadMeta(mem).character?.level).toBe(1);
    expect(store.files().map((f) => [f.name, f.heroId, f.level, f.active])).toEqual([
      ['0001', 'pralka', 4, false],
      ['0002', 'kartograf', 1, true],
    ]);
    if (a.ok) expect(store.select(a.value).ok).toBe(true);
    expect(loadMeta(mem).character?.level).toBe(4);
    expect(loadMeta(mem).heroId).toBe('pralka');
  });

  it('answers with codes: empty, taken, unknown file, full roster', () => {
    const store = createRosterStore(memory());
    store.create('pralka', 'A');
    expect(store.create('konsultant', ' a ')).toEqual({ ok: false, error: 'nameTaken' });
    expect(store.create('konsultant', '')).toEqual({ ok: false, error: 'nameEmpty' });
    expect(store.select('zzz')).toEqual({ ok: false, error: 'noCharacter' });
    for (let i = 0; i < 7; i++) expect(store.create('pralka', `N${i}`).ok).toBe(true);
    expect(store.create('pralka', 'extra')).toEqual({ ok: false, error: 'rosterFull' });
    expect(store.nextName()).toMatch(/^\d{4}$/);
  });

  it('deleting a file keeps the other with its own character', () => {
    const mem = memory();
    const store = createRosterStore(mem);
    const a = store.create('pralka', 'A');
    const b = store.create('nalesnik', 'B');
    if (!a.ok || !b.ok) throw new Error('create');
    expect(store.remove(b.value).ok).toBe(true);
    expect(store.files().map((f) => f.name)).toEqual(['A']);
    expect(loadMeta(mem).character?.heroId).toBe('pralka');
  });

  it('moves an item bag -> shared / personal; the shared one is seen by the other file, the personal one is not', () => {
    const mem = memory();
    const store = createRosterStore(mem);
    const a = store.create('pralka', 'A');
    const meta = loadMeta(mem);
    if (!a.ok || !meta.character) throw new Error('create');
    meta.character.inventory.push(item(5), item(6));
    saveMeta(meta, mem);
    expect(store.move(5, 'bag', 'shared').ok).toBe(true);
    expect(store.move(6, 'bag', 'personal').ok).toBe(true);
    const b = store.create('konsultant', 'B');
    expect(b.ok).toBe(true);
    const places = store.places();
    expect(places.shared.map((i) => i.uid)).toEqual([5]);
    expect(places.personal).toEqual([]);
    expect(places.bag).toEqual([]);
    expect(store.move(5, 'shared', 'bag').ok).toBe(true);
    if (a.ok) store.select(a.value);
    expect(store.places().personal.map((i) => i.uid)).toEqual([6]);
    expect(store.move(5, 'bag', 'shared')).toEqual({ ok: false, error: 'noItem' });
    expect(store.move(6, 'personal', 'personal')).toEqual({ ok: false, error: 'samePlace' });
  });
});
