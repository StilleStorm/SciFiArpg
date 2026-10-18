import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { enterPage } from '../world/pageTurn';
import { createRun, type RunState } from '../world/run';
import { bindAutosave, settleRun, withoutBookmark, type AutosaveDeps } from './autosave';
import { SAVE_KEY, defaultMeta, loadMeta, saveMeta, type MetaState } from './save';

/** A fake storage and a fake document: nothing here touches the browser. */
function rig(initial: MetaState = defaultMeta()) {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  let meta = initial;
  const commit = (next: MetaState): void => {
    meta = next;
    saveMeta(next, storage);
  };
  const listeners = new Set<() => void>();
  const doc = {
    hidden: false,
    addEventListener: (_: string, fn: () => void) => void listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => void listeners.delete(fn),
  };
  const hide = (): void => {
    doc.hidden = true;
    for (const fn of [...listeners]) fn();
  };
  const bus = createBus();
  const state = { s: createRun(31, { heroId: 'pralka', pageCount: 4 }) as RunState | null, screen: 'run' };
  const events: number[] = [];
  bus.on('run:bookmarked', (e) => events.push(e.pageIndex));
  const deps: AutosaveDeps = { bus, getState: () => state.s, getMeta: () => meta, commit, inRun: () => state.screen === 'run', doc: doc as unknown as AutosaveDeps['doc'] };
  const auto = bindAutosave(deps);
  return { bus, state, auto, hide, events, stored: () => loadMeta(storage), storage, meta: () => meta, store };
}

describe('autosave', () => {
  it('writes the character and a bookmark at every page turn', () => {
    const r = rig();
    const s = r.state.s;
    if (!s) throw new Error('no run');
    expect(r.stored().bookmark).toBeUndefined();
    s.player.gwiazdki = 9;
    enterPage(s, r.bus, 2);
    expect(r.stored().bookmark).toMatchObject({ seed: 31, pageIndex: 2, ticketNumber: s.ticket.number });
    expect(r.stored().character).toMatchObject({ heroId: 'pralka', gwiazdki: 9 });
    expect(r.events).toEqual([2]);
    s.time = 61.5;
    enterPage(s, r.bus, 3);
    expect(r.stored().bookmark).toMatchObject({ pageIndex: 3, clockS: 61.5 });
  });

  it('pause writes both, resume does not', () => {
    const r = rig();
    const s = r.state.s;
    if (!s) throw new Error('no run');
    s.player.gwiazdki = 4;
    r.bus.emit('game:paused', { paused: true });
    expect(r.stored().character?.gwiazdki).toBe(4);
    expect(r.stored().bookmark).toBeDefined();
    r.events.length = 0;
    s.player.gwiazdki = 99;
    r.bus.emit('game:paused', { paused: false });
    expect(r.events).toEqual([]);
    expect(r.stored().character?.gwiazdki).toBe(4);
  });

  it('Zakończ (save()) writes both; the app being hidden during a run writes both', () => {
    const r = rig();
    const s = r.state.s;
    if (!s) throw new Error('no run');
    s.player.gwiazdki = 6;
    expect(r.auto.save()).toBe(true);
    expect(r.stored().character?.gwiazdki).toBe(6);
    s.player.gwiazdki = 8;
    r.hide();
    expect(r.stored().character?.gwiazdki).toBe(8);
    expect(r.stored().bookmark).toBeDefined();
  });

  it('writes nothing outside a run, for a dead player or after unbinding', () => {
    const r = rig();
    const s = r.state.s;
    if (!s) throw new Error('no run');
    r.state.screen = 'baza';
    expect(r.auto.save()).toBe(false);
    r.state.screen = 'run';
    s.player.hp = 0;
    r.bus.emit('game:paused', { paused: true });
    r.hide();
    expect(r.store.has(SAVE_KEY)).toBe(false);
    s.player.hp = s.player.hpMax;
    r.auto.unbind();
    r.bus.emit('page:entered', { index: 1, count: 4 });
    expect(r.store.has(SAVE_KEY)).toBe(false);
  });

  it('a ticket that ends is filed, the character kept as it ended, and the bookmark torn up', () => {
    const r = rig();
    const s = r.state.s;
    if (!s) throw new Error('no run');
    s.player.gwiazdki = 15;
    enterPage(s, r.bus, 1);
    expect(r.meta().bookmark).toBeDefined();
    const after = settleRun(r.meta(), s, 'ukonczono');
    expect(after.bookmark).toBeUndefined();
    expect(after.history).toHaveLength(1);
    expect(after.runsCompleted).toBe(1);
    expect(after.character?.gwiazdki).toBe(15);
    expect(withoutBookmark(r.meta()).bookmark).toBeUndefined();
  });
});
