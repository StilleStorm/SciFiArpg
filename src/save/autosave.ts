/**
 * When the save is written (DESIGN 4.1, save like Diablo 3). The character and the bookmark go to storage at every page
 * turn, on pause, on Zakończ (main calls `save()`), and when the app is hidden during a run. When the ticket ends,
 * `settleRun` files it in the Historia, writes the character one last time and tears the bookmark up.
 * The functions on the meta state are pure; `bindAutosave` is the only part that listens to anything.
 */
import type { Bus } from '../core/events';
import type { RunState } from '../world/run';
import { bookmarkOf } from './bookmark';
import { serializeCharacter } from './character';
import { recordRun } from './history';
import type { MetaState, RunOutcome } from './save';

/** The meta state with the character as the run has it now. */
export const withCharacter = (meta: MetaState, s: RunState): MetaState => ({ ...meta, character: serializeCharacter(s) });

/** The meta state with a bookmark of the run as it stands. */
export const withBookmark = (meta: MetaState, s: RunState): MetaState => ({ ...meta, bookmark: bookmarkOf(s) });

/** The meta state without a bookmark (the ticket ended). */
export function withoutBookmark(meta: MetaState): MetaState {
  const next = { ...meta };
  delete next.bookmark;
  return next;
}

/** A ticket that is over, won or lost for good: Historia entry, the character kept as it ended, no bookmark. */
export function settleRun(meta: MetaState, s: RunState, outcome: RunOutcome): MetaState {
  const filed = recordRun(meta, {
    number: s.ticket.number,
    planet: s.ticket.planet,
    clause: s.ticket.lawId,
    outcome,
    kills: s.kills,
    pages: s.pageIndex + 1,
    total: s.pageCount,
  });
  return withoutBookmark(withCharacter(filed, s));
}

/** A run can be written down only while it is alive: a dead player's state is not a place to resume from. */
export const savable = (s: RunState | null): s is RunState => s !== null && s.status !== 'dead' && s.player.hp > 0;

export interface AutosaveDeps {
  bus: Bus;
  getState(): RunState | null;
  getMeta(): MetaState;
  /** Take the new meta state and write it to storage (main.ts). */
  commit(next: MetaState): void;
  /** True while the run screen is up. */
  inRun(): boolean;
  /** Where `visibilitychange` comes from; the page's document by default. */
  doc?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'hidden'> | null;
}

export interface Autosave {
  /** Write the character and the bookmark now. Returns false when there is no living run to write. */
  save(): boolean;
  unbind(): void;
}

export function bindAutosave(deps: AutosaveDeps): Autosave {
  const save = (): boolean => {
    const s = deps.getState();
    if (!deps.inRun() || !savable(s)) return false;
    deps.commit(withBookmark(withCharacter(deps.getMeta(), s), s));
    deps.bus.emit('run:bookmarked', { pageIndex: s.pageIndex });
    return true;
  };
  const offs = [
    deps.bus.on('page:entered', () => void save()),
    deps.bus.on('game:paused', (e) => {
      if (e.paused) save();
    }),
  ];
  const doc = deps.doc === undefined ? (typeof document === 'undefined' ? null : document) : deps.doc;
  const onVisibility = (): void => {
    if (doc?.hidden) save();
  };
  doc?.addEventListener('visibilitychange', onVisibility);
  return {
    save,
    unbind() {
      for (const off of offs) off();
      doc?.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
