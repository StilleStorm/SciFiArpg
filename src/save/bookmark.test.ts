import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { enterPage, populatePage } from '../world/pageTurn';
import { createRun } from '../world/run';
import { BOOKMARK_VERSION, bookmarkOf, toBookmark } from './bookmark';
import { SAVE_KEY, defaultMeta, loadMeta, saveMeta } from './save';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) , raw: () => m.get(SAVE_KEY) };
}

describe('bookmark', () => {
  const bus = createBus();
  const played = createRun(77, { ticketNumber: 48220, pageCount: 5, lawId: 'grawitacja' });
  enterPage(played, bus, 3);
  played.time = 123.456;
  populatePage(played, bus);
  played.player.hp = 5;

  it('records the ticket, the seed, the page, the clause, the clock and the planet', () => {
    const b = bookmarkOf(played);
    expect(b).toMatchObject({ version: BOOKMARK_VERSION, ticketNumber: 48220, seed: 77, pageIndex: 3, lawId: 'grawitacja', pageCount: 5 });
    expect(b.clockS).toBeCloseTo(123.46, 2);
    expect(b.planetName).toBe(played.ticket.planet);
  });

  it('resuming regenerates the very same pages and stands on the same index with the clock restored', () => {
    const b = bookmarkOf(played);
    const r = createRun(b.seed, { resume: b });
    expect(r.pageIndex).toBe(3);
    expect(r.page).toEqual(played.page);
    expect(r.page.obstacles).toEqual(played.page.obstacles);
    expect(r.pages).toEqual(played.pages);
    expect(r.ticket.number).toBe(48220);
    expect(r.ticket.lawId).toBe('grawitacja');
    expect(r.pageCount).toBe(5);
    expect(r.time).toBeCloseTo(123.46, 2);
    expect(r.player.x).toBe(r.page.entry.x);
    expect(r.player.y).toBe(r.page.entry.y);
  });

  it('enemies are back, the floor loot is gone and racja is full', () => {
    const r = createRun(77, { resume: bookmarkOf(played) });
    expect(played.enemies.length).toBeGreaterThan(0);
    expect(r.enemies).toHaveLength(0);
    expect(r.populate).toBe(true);
    populatePage(r, createBus());
    expect(r.enemies.length).toBeGreaterThan(0);
    expect(r.pickups).toHaveLength(0);
    expect(r.player.hp).toBe(r.player.hpMax);
    expect(played.player.hp).toBe(5);
  });

  it('page 0 keeps the spawn point; a bookmark past the last page clamps to it', () => {
    const first = createRun(12);
    const r0 = createRun(12, { resume: bookmarkOf(first) });
    expect(r0.pageIndex).toBe(0);
    expect(r0.player.x).toBe(first.player.x);
    const far = toBookmark({ ...bookmarkOf(first), pageIndex: 99 });
    expect(far?.pageIndex).toBe(first.pageCount - 1);
  });

  it('survives storage, and a damaged bookmark is simply not there', () => {
    const store = memory();
    saveMeta({ ...defaultMeta(), bookmark: bookmarkOf(played) }, store);
    expect(loadMeta(store).bookmark).toEqual(bookmarkOf(played));
    expect(toBookmark(null)).toBeNull();
    expect(toBookmark({ seed: 1 })).toBeNull();
    expect(toBookmark({ ...bookmarkOf(played), lawId: 'nie-ma-takiej' })).toBeNull();
    expect(toBookmark({ ...bookmarkOf(played), pageCount: 0 })).toBeNull();
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultMeta(), bookmark: { seed: 'x' } }));
    expect(loadMeta(store).bookmark).toBeUndefined();
  });
});
