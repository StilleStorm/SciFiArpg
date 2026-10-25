/**
 * ARCHIWUM at the desk (ITEMS 8, 12): the bag, the character's personal archive and the archive shared by every case file.
 * A transfer is two taps: the item, then the place it goes to (a button of the bar, or an empty box of that place).
 */
import { t } from '../i18n';
import type { Item } from '../items/types';
import { capacityOf, caseTitle, errorText, ARCHIVE_PLACES, type ArchivePlace } from './rosterModel';
import type { Places, Result } from './rosterStore';
import { h } from './dom';
import { displayName, figure, shownStats, summary, tierWord } from './itemView';
import { heroNote } from './itemSets';
import { attachScrollCue } from './konfiguracja';
import { createSheet, type Sheet } from './sheet';
import './archive.css';

export interface ArchiveHost {
  /** Who is shown in the sub-title. */
  who(): { name: string; level: number };
  /** The three lists as they stand now. */
  places(): Places;
  /** Move one item; the host keeps the live run in step with the bag. */
  move(uid: number, from: ArchivePlace, to: ArchivePlace): Result<Item>;
}

export interface ArchiveSheet {
  el: HTMLElement;
  refresh(): void;
  close(): void;
}

const placeName = (p: ArchivePlace): string => t(`screens.archive.${p}`);
const COLS = 6;

export function openArchive(root: HTMLElement, host: ArchiveHost, onClose: () => void): ArchiveSheet {
  const who = host.who();
  const sheet: Sheet = createSheet(root, { title: t('screens.archive.title'), sub: t('screens.archive.sub', { name: caseTitle(who.name), level: who.level }), onClose });
  sheet.el.classList.add('ar-sheet');
  sheet.note(t('screens.archive.noteShared'));
  sheet.note(t('screens.archive.noteTap'));
  const bar = h('div', 'ar-bar');
  const body = h('div', 'ar-body');
  sheet.scroll.before(bar);
  sheet.scroll.append(body);

  let picked: { uid: number; from: ArchivePlace } | null = null;

  const move = (to: ArchivePlace): void => {
    if (!picked) return;
    const { uid, from } = picked;
    const res = host.move(uid, from, to);
    picked = null;
    if (res.ok) sheet.note(t('screens.archive.moved', { name: displayName(res.value), place: placeName(to) }));
    else sheet.note(errorText(res.error));
    refresh();
  };

  const cellFor = (item: Item, place: ArchivePlace): HTMLElement => {
    const b = h('button', `ar-cell${picked?.uid === item.uid ? ' sel' : ''}`);
    b.type = 'button';
    b.dataset['uid'] = String(item.uid);
    b.dataset['place'] = place;
    b.setAttribute('aria-label', displayName(item));
    b.append(figure(item, 40), h('span', 'ar-n', String(item.number)));
    b.addEventListener('click', () => {
      picked = picked?.uid === item.uid ? null : { uid: item.uid, from: place };
      refresh();
    });
    return b;
  };

  const emptyFor = (place: ArchivePlace): HTMLElement => {
    const targetable = picked !== null && picked.from !== place;
    const b = h('button', `ar-cell empty${targetable ? ' target' : ''}`);
    b.type = 'button';
    b.dataset['place'] = place;
    b.disabled = !targetable;
    b.setAttribute('aria-label', t('screens.archive.moveTo', { place: placeName(place) }));
    if (targetable) b.addEventListener('click', () => move(place));
    return b;
  };

  function drawBar(places: Places): void {
    bar.replaceChildren();
    const item = picked ? places[picked.from].find((i) => i.uid === picked?.uid) : undefined;
    if (!picked || !item) {
      picked = null;
      bar.append(h('p', 'ar-none', t('screens.archive.none')));
      return;
    }
    const from = picked.from;
    const line = h('p', 'ar-chosen');
    line.append(h('b', '', displayName(item)), document.createTextNode(` · ${tierWord(item)} · ${summary(shownStats(item))}`));
    const row = h('div', 'ar-moves');
    for (const place of ARCHIVE_PLACES) {
      if (place === from) continue;
      const btn = h('button', 'ar-move', t('screens.archive.moveTo', { place: placeName(place) }));
      btn.type = 'button';
      btn.dataset['to'] = place;
      btn.disabled = places[place].length >= capacityOf(place);
      btn.addEventListener('click', () => move(place));
      row.append(btn);
    }
    const drop = h('button', 'link-btn ar-drop', t('screens.archive.cancel'));
    drop.type = 'button';
    drop.addEventListener('click', () => {
      picked = null;
      refresh();
    });
    row.append(drop);
    const hero = heroNote(item); // S17: which hero the paragraph of an archived unique concerns
    bar.append(line, ...(hero ? [h('p', 'ar-hero', hero)] : []), row);
  }

  function refresh(): void {
    const places = host.places();
    drawBar(places);
    body.replaceChildren();
    for (const place of ARCHIVE_PLACES) {
      const list = places[place];
      const cap = capacityOf(place);
      const section = h('section', 'ar-sec');
      section.dataset['place'] = place;
      const head = h('div', 'ar-head');
      head.append(h('h3', 'ar-title', placeName(place)), h('span', 'ar-count', t('screens.archive.count', { count: list.length, cap })));
      const grid = h('div', 'ar-grid');
      for (const item of list) grid.append(cellFor(item, place));
      // the empty boxes: enough to finish the row, and one more row to tap into while an item is picked
      const free = cap - list.length;
      const toRow = (COLS - (list.length % COLS)) % COLS;
      const extra = picked && picked.from !== place ? Math.max(toRow, 1) : toRow;
      for (let i = 0; i < Math.min(free, Math.max(extra, list.length === 0 ? COLS : 0)); i++) grid.append(emptyFor(place));
      section.append(head, grid);
      if (list.length === 0) section.append(h('p', 'ar-empty', t('screens.archive.empty')));
      body.append(section);
    }
  }
  refresh();

  const cue = attachScrollCue(sheet, 'screens.archive.cue');

  return {
    el: sheet.el,
    refresh,
    close: () => {
      cue.dispose();
      sheet.remove();
    },
  };
}

/** The desk row, in the right-hand column of the desk. Call right after the desk sheet was opened. */
export function addArchiveDeskLine(root: HTMLElement, onOpen: () => void): void {
  const col = root.querySelector('.desk-sheet .desk-col-b');
  if (!col) return;
  const row = h('div', 'trow ar-deskrow');
  const btn = h('button', 'link-btn', t('screens.archive.deskLine'));
  btn.type = 'button';
  btn.dataset['desk'] = 'archiwum';
  btn.addEventListener('click', onOpen);
  row.append(h('label', '', t('screens.archive.deskNote')), btn);
  col.append(row);
}
