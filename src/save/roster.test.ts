import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { setUltimateParagraph } from '../heroes/ultimate';
import { rollItem } from '../items/generate';
import { INVENTORY_CAP } from '../items/inventory';
import { fillDemoInventory } from '../items/demo';
import { gainXp } from '../progression';
import { commitLoadout } from '../ui/konfLoadout';
import { createBus } from '../core/events';
import { createRun } from '../world/run';
import { settleRun, withBookmark, withCharacter } from './autosave';
import { serializeCharacter } from './character';
import { exportText, parseArchive } from './export';
import { activeRecord, createCharacter, deleteCharacter, itemsIn, moveItem, selectCharacter, ARCHIVE_CAP, MAX_CHARACTERS } from './roster';
import { SAVE_KEY, SAVE_VERSION, defaultMeta, loadMeta, migrate, saveMeta, toStored, type MetaState } from './save';

function memory(initial?: string) {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set(SAVE_KEY, initial);
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

const item = (n: number) => {
  const it = rollItem(createRng(n * 7919), { tier: 'zwykly', level: 3 });
  it.number = n;
  return it;
};
const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  expect(r.ok).toBe(true);
  return r as Extract<T, { ok: true }>;
};

/** A v2 save as S5 wrote it: one character who has played, a bookmark and a Historia. */
function v2Save(): Record<string, unknown> {
  const s = createRun(5, { heroId: 'pralka' });
  fillDemoInventory(s.player);
  s.player.gwiazdki = 33;
  s.player.potwierdzenia = 3;
  s.player.permissions.push('urzadzenia');
  gainXp(s, createBus(), 300);
  expect(commitLoadout(s, { pads: [2, 0, 1], specialization: 'osoba' }).ok).toBe(true);
  setUltimateParagraph(s, 3);
  const meta = withBookmark(settleRun(defaultMeta(), s, 'zgloszenie'), s);
  const v2 = JSON.parse(JSON.stringify({ ...meta, version: 2 })) as Record<string, unknown>;
  delete v2['characters'];
  delete v2['sharedArchive'];
  delete v2['activeCharacterId'];
  v2['stamps'] = 11;
  return v2;
}

describe('save v3 migration', () => {
  it('wraps the single v2 character in a roster of one and keeps everything', () => {
    const v2 = v2Save();
    const m = migrate(v2);
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.characters).toHaveLength(1);
    const rec = m.characters[0];
    expect(rec?.id).toBe(m.activeCharacterId);
    expect(rec?.character).toEqual(v2['character']);
    expect(rec?.character.potwierdzenia).toBe(3);
    expect(rec?.character.specialization).toBe('osoba');
    expect(rec?.character.ultParagraph).toBe(3);
    expect(rec?.character.pads).toEqual([2, 0, 1]);
    expect(rec?.history).toEqual(v2['history']);
    expect(rec?.bookmark ?? null).toEqual(v2['bookmark'] ?? null);
    expect(rec?.archive).toEqual([]);
    expect(m.character).toEqual(rec?.character);
    expect(m.history).toEqual(rec?.history);
    expect(m.heroId).toBe('pralka');
    expect(m.stamps).toBe(11);
    expect(m.sharedArchive).toEqual([]);
  });
  it('loads a v2 string from storage and writes v3 back', () => {
    const store = memory(JSON.stringify(v2Save()));
    const m = loadMeta(store);
    expect(saveMeta(m, store)).toBe(true);
    const stored = JSON.parse(store.m.get(SAVE_KEY) ?? '{}') as Record<string, unknown>;
    expect(stored['version']).toBe(SAVE_VERSION);
    expect(stored['character']).toBeUndefined();
    expect(stored['history']).toBeUndefined();
    expect(Array.isArray(stored['characters'])).toBe(true);
    expect(loadMeta(store)).toEqual(m);
  });
  it('an old save with a stash only (before the character record) still becomes one character', () => {
    const m = migrate({ version: 1, heroId: 'konsultant', gwiazdki: 12, stash: { inventory: [item(1)], equipment: {} } });
    expect(m.characters).toHaveLength(1);
    expect(m.character?.gwiazdki).toBe(12);
    expect(m.character?.inventory).toHaveLength(1);
    expect(m.heroId).toBe('konsultant');
  });
  it('an empty save has an empty roster and no active character', () => {
    const m = migrate({});
    expect(m.characters).toEqual([]);
    expect(m.activeCharacterId).toBeUndefined();
    expect(m.character).toBeUndefined();
  });
  it('damaged records are dropped, a bad active id falls back to the first', () => {
    const good = ok(createCharacter(defaultMeta(), 'pralka', 'A')).meta;
    const stored = JSON.parse(JSON.stringify(toStored(good))) as Record<string, unknown>;
    (stored['characters'] as unknown[]).push({ id: 'x', name: 'B', character: { heroId: 'nobody' } }, 7, null);
    stored['activeCharacterId'] = 'zzz';
    const m = migrate(stored);
    expect(m.characters).toHaveLength(1);
    expect(m.activeCharacterId).toBe(m.characters[0]?.id);
  });
  it('the mirror written by the run flow lands in the active record', () => {
    const m0 = ok(createCharacter(defaultMeta(), 'pralka', 'A')).meta;
    const s = createRun(3, { heroId: 'pralka', character: m0.character });
    s.player.gwiazdki = 77;
    const m1 = withCharacter(m0, s);
    const store = memory();
    saveMeta(m1, store);
    expect(loadMeta(store).character?.gwiazdki).toBe(77);
    expect(loadMeta(store).characters[0]?.character.gwiazdki).toBe(77);
  });
  it('a character made by the old flow (mirror only, no roster) gets a record', () => {
    const s = createRun(3, { heroId: 'konsultant' });
    const store = memory();
    saveMeta(withCharacter(defaultMeta(), s), store);
    const back = loadMeta(store);
    expect(back.characters).toHaveLength(1);
    expect(back.activeCharacterId).toBe(back.characters[0]?.id);
    expect(back.heroId).toBe('konsultant');
  });
});

describe('roster', () => {
  it('creates characters, active one at a time, with generated unique names', () => {
    const a = ok(createCharacter(defaultMeta(), 'pralka'));
    const b = ok(createCharacter(a.meta, 'konsultant'));
    expect(a.meta.characters[0]?.name).toBe('0001');
    expect(b.meta.characters.map((r) => r.name)).toEqual(['0001', '0002']);
    expect(b.meta.activeCharacterId).toBe(b.id);
    expect(b.meta.heroId).toBe('konsultant');
    expect(b.meta.history).toEqual([]);
    expect(b.meta.character?.level).toBe(1);
  });
  it('error codes: hero, full, duplicate', () => {
    expect(createCharacter(defaultMeta(), 'nobody' as never)).toEqual({ ok: false, error: 'hero' });
    const a = ok(createCharacter(defaultMeta(), 'pralka', '  Sprawa   7 '));
    expect(a.meta.characters[0]?.name).toBe('Sprawa 7');
    expect(createCharacter(a.meta, 'pralka', 'Sprawa 7')).toEqual({ ok: false, error: 'duplicate' });
    let m = defaultMeta();
    for (let i = 0; i < MAX_CHARACTERS; i++) m = ok(createCharacter(m, 'pralka')).meta;
    expect(createCharacter(m, 'pralka')).toEqual({ ok: false, error: 'full' });
  });
  it('separate progress: switching keeps each character, bookmark and Historia apart', () => {
    const a = ok(createCharacter(defaultMeta(), 'pralka', 'A'));
    const s = createRun(4, { heroId: 'pralka', character: a.meta.character });
    s.player.gwiazdki = 50;
    const played = settleRun(withBookmark(a.meta, s), s, 'zgloszenie');
    expect(played.history).toHaveLength(1);
    const b = ok(createCharacter(played, 'konsultant', 'B'));
    expect(b.meta.history).toEqual([]);
    expect(b.meta.character?.gwiazdki).toBe(0);
    const back = ok(selectCharacter(b.meta, a.id)).meta;
    expect(back.history).toHaveLength(1);
    expect(back.character?.gwiazdki).toBe(50);
    expect(back.heroId).toBe('pralka');
    expect(ok(selectCharacter(back, b.id)).meta.history).toEqual([]);
    expect(selectCharacter(back, 'nope')).toEqual({ ok: false, error: 'unknown' });
  });
  it('delete: removes the record, moves the active one, keeps the shared archive', () => {
    const a = ok(createCharacter(defaultMeta(), 'pralka', 'A'));
    const b = ok(createCharacter(a.meta, 'konsultant', 'B'));
    const withShared = { ...b.meta, sharedArchive: [item(5)] };
    const afterB = ok(deleteCharacter(withShared, b.id)).meta;
    expect(afterB.characters.map((r) => r.id)).toEqual([a.id]);
    expect(afterB.activeCharacterId).toBe(a.id);
    expect(afterB.heroId).toBe('pralka');
    expect(afterB.sharedArchive).toHaveLength(1);
    const none = ok(deleteCharacter(afterB, a.id)).meta;
    expect(none.characters).toEqual([]);
    expect(none.activeCharacterId).toBeUndefined();
    expect(none.character).toBeUndefined();
    expect(none.heroId).toBeUndefined();
    expect(deleteCharacter(none, a.id)).toEqual({ ok: false, error: 'unknown' });
  });
});

describe('moveItem', () => {
  const start = (): MetaState => {
    const m = ok(createCharacter(defaultMeta(), 'pralka', 'A')).meta;
    return { ...m, character: m.character ? { ...m.character, inventory: [item(1), item(2)] } : m.character };
  };
  it('bag -> personal -> shared -> bag', () => {
    const m0 = start();
    const r1 = ok(moveItem(m0, { zone: 'bag', index: 0 }, 'personal'));
    expect(itemsIn(r1.meta, 'bag')).toHaveLength(1);
    expect(itemsIn(r1.meta, 'personal')).toHaveLength(1);
    expect(activeRecord(r1.meta)?.archive).toHaveLength(1);
    const r2 = ok(moveItem(r1.meta, { zone: 'personal', index: 0 }, 'shared'));
    expect(itemsIn(r2.meta, 'shared')[0]?.uid).toBe(r1.item.uid);
    expect(itemsIn(r2.meta, 'personal')).toHaveLength(0);
    const r3 = ok(moveItem(r2.meta, { zone: 'shared', index: 0 }, 'bag'));
    expect(itemsIn(r3.meta, 'bag')).toHaveLength(2);
    expect(itemsIn(r3.meta, 'shared')).toHaveLength(0);
  });
  it('the shared archive is the same for every character; the personal one is not', () => {
    const m0 = start();
    const shared = ok(moveItem(m0, { zone: 'bag', index: 0 }, 'shared')).meta;
    const personal = ok(moveItem(shared, { zone: 'bag', index: 0 }, 'personal')).meta;
    const other = ok(createCharacter(personal, 'konsultant', 'B')).meta;
    expect(itemsIn(other, 'shared')).toHaveLength(1);
    expect(itemsIn(other, 'personal')).toHaveLength(0);
    expect(itemsIn(other, 'bag')).toHaveLength(0);
    const taken = ok(moveItem(other, { zone: 'shared', index: 0 }, 'bag'));
    expect(itemsIn(taken.meta, 'bag')).toHaveLength(1);
    const first = ok(selectCharacter(taken.meta, personal.activeCharacterId ?? '')).meta;
    expect(itemsIn(first, 'personal')).toHaveLength(1);
    expect(itemsIn(first, 'bag')).toHaveLength(0);
  });
  it('capacity: full bag (20), full archives (40), and the error codes', () => {
    let m = start();
    const fullBag = { ...m, character: m.character ? { ...m.character, inventory: Array.from({ length: INVENTORY_CAP }, (_, i) => item(i + 1)) } : m.character };
    m = { ...fullBag, sharedArchive: [item(100)] };
    expect(moveItem(m, { zone: 'shared', index: 0 }, 'bag')).toEqual({ ok: false, error: 'full' });
    const fullShared = { ...m, sharedArchive: Array.from({ length: ARCHIVE_CAP }, (_, i) => item(i + 1)) };
    expect(moveItem(fullShared, { zone: 'bag', index: 0 }, 'shared')).toEqual({ ok: false, error: 'full' });
    const fullPersonal = { ...m, characters: m.characters.map((r) => ({ ...r, archive: Array.from({ length: ARCHIVE_CAP }, (_, i) => item(i + 1)) })) };
    expect(moveItem(fullPersonal, { zone: 'bag', index: 0 }, 'personal')).toEqual({ ok: false, error: 'full' });
    expect(moveItem(start(), { zone: 'bag', index: 5 }, 'shared')).toEqual({ ok: false, error: 'missing' });
    expect(moveItem(start(), { zone: 'bag', index: 0 }, 'bag')).toEqual({ ok: false, error: 'same' });
    expect(moveItem(defaultMeta(), { zone: 'shared', index: 0 }, 'bag')).toEqual({ ok: false, error: 'noCharacter' });
  });
  it('a failed move changes nothing', () => {
    const m = start();
    const before = JSON.stringify(m);
    moveItem(m, { zone: 'bag', index: 9 }, 'shared');
    expect(JSON.stringify(m)).toBe(before);
  });
  it('an item entering a bag keeps its identity but takes a free plate number', () => {
    const m0 = start();
    const shared = { ...ok(moveItem(m0, { zone: 'bag', index: 0 }, 'shared')).meta };
    const dup = { ...shared, character: shared.character ? { ...shared.character, inventory: [item(1)] } : shared.character };
    const back = ok(moveItem(dup, { zone: 'shared', index: 0 }, 'bag'));
    expect(back.item.number).toBe(2);
    expect(back.item.uid).toBe(itemsIn(shared, 'shared')[0]?.uid);
  });
  it('survives storage', () => {
    const m = ok(moveItem(start(), { zone: 'bag', index: 0 }, 'shared')).meta;
    const personal = ok(moveItem(m, { zone: 'bag', index: 0 }, 'personal')).meta;
    const store = memory();
    saveMeta(personal, store);
    const back = loadMeta(store);
    expect(itemsIn(back, 'shared')).toHaveLength(1);
    expect(itemsIn(back, 'personal')).toHaveLength(1);
    expect(itemsIn(back, 'bag')).toHaveLength(0);
  });
});

describe('Archiwum eksportowe with a roster', () => {
  it('imports an S5 archive (format 1, one character) into v3', () => {
    const v2 = v2Save();
    const file = JSON.stringify({ kind: 'zgloszenie-archiwum', format: 1, version: 2, exportedAt: new Date(0).toISOString(), meta: v2 });
    const res = parseArchive(file);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.version).toBe(2);
    expect(res.meta.version).toBe(SAVE_VERSION);
    expect(res.meta.characters).toHaveLength(1);
    expect(res.meta.character).toEqual(v2['character']);
    expect(res.meta.stamps).toBe(11);
  });
  it('carries every character and the shared archive, and the round trip is byte-identical', () => {
    const a = ok(createCharacter(defaultMeta(), 'pralka', 'A'));
    const s = createRun(4, { heroId: 'pralka', character: a.meta.character });
    fillDemoInventory(s.player);
    s.player.potwierdzenia = 2;
    const played = withBookmark(settleRun(withCharacter(a.meta, s), s, 'petla'), s);
    let m = ok(createCharacter(played, 'konsultant', 'B')).meta;
    m = { ...m, character: m.character ? { ...m.character, inventory: [item(1), item(2)] } : m.character };
    m = ok(moveItem(m, { zone: 'bag', index: 0 }, 'shared')).meta;
    m = ok(moveItem(m, { zone: 'bag', index: 0 }, 'personal')).meta;
    const text = exportText(m, new Date(0));
    const file = JSON.parse(text) as { meta: Record<string, unknown> };
    expect((file.meta['characters'] as unknown[]).length).toBe(2);
    expect((file.meta['sharedArchive'] as unknown[]).length).toBe(1);
    expect(file.meta['character']).toBeUndefined();
    const back = parseArchive(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(exportText(back.meta, new Date(0))).toBe(text);
    expect(back.meta.characters.map((r) => r.name)).toEqual(['A', 'B']);
    expect(back.meta.characters[0]?.character.potwierdzenia).toBe(2);
    expect(back.meta.characters[0]?.history).toHaveLength(1);
    expect(back.meta.activeCharacterId).toBe(m.activeCharacterId);
    expect(serializeCharacter(s).potwierdzenia).toBe(2);
  });
  it('a fresh character survives the whole trip with its default pads', () => {
    const s = createRun(5, { heroId: 'pralka' });
    const m = withCharacter(ok(createCharacter(defaultMeta(), 'pralka', 'A')).meta, s);
    const back = parseArchive(exportText(m, new Date(0)));
    expect(back.ok && back.meta.character?.pads).toEqual([0, 1, 2]);
  });
});
