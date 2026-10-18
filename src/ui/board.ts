import { t } from '../i18n';
import { isLost, pendingRewrites, rewriteIndex } from '../save/history';
import type { MetaState, TicketEntry } from '../save/save';
import { tween } from '../render/tween';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';
import './base.css';

export interface BoardHandlers {
  /** Called with the history indices whose corrected version was just shown (the caller saves them). */
  onRewritten(indices: number[]): void;
  /** The sheet was closed with "Zamknij". */
  onClose(): void;
}

export interface Board {
  /** The notice board sheet over the base page: three fixed announcements, then the Historia zgłoszeń. */
  open(meta: MetaState): void;
  close(): void;
  isOpen(): boolean;
}

/** The three fixed announcements, in the register of the Asystent (`screens.base.board.notices.*`). */
export const NOTICES: readonly string[] = ['hours', 'lost', 'board'];

function outcomeText(o: TicketEntry['outcome']): string {
  switch (o) {
    case 'ukonczono':
      return t('screens.history.won');
    case 'petla':
      return t('screens.history.petla');
    case 'zawieszenie':
      return t('screens.history.zawieszenie');
    case 'zgloszenie':
      return t('screens.history.lost');
  }
}

/** Typewriter: reveal `text` letter by letter over `ms` (render clock, no timers). */
function typeIn(node: HTMLElement, text: string, ms: number, delay: number): void {
  node.textContent = '';
  tween(
    ms,
    (p) => {
      node.textContent = text.slice(0, Math.round(text.length * p));
    },
    { delay },
  );
}

/** One ticket of the Historia. `fresh` plays the rewrite: the old lines are struck, a new outcome is typed over. */
function entryView(e: TicketEntry, fresh: boolean): HTMLElement {
  const lost = isLost(e.outcome);
  const rewritten = lost && (e.rewritten === true || fresh);
  const total = e.total ?? e.pages;
  const item = h('li', 'hist-entry');
  item.append(h('div', 'e-head', t('screens.history.line', { number: e.number, planet: e.planet })));

  const meta = h('div', 'e-meta');
  meta.append(document.createTextNode(`${t('screens.history.meta', { clause: t(`laws.${e.clause}.name`), kills: e.kills })} `));
  const pagesNow = `${e.pages}/${total}`;
  if (rewritten) {
    const full = `${total}/${total}`;
    meta.append(h('s', fresh ? 'struck-out fresh' : 'struck-out', pagesNow), document.createTextNode(' '));
    const typed = h('span', 'typed', fresh ? '' : full);
    meta.append(typed);
    if (fresh) typeIn(typed, full, 400, 1500);
  } else {
    meta.append(document.createTextNode(pagesNow));
  }
  item.append(meta);

  const result = h('div', 'e-result');
  const original = t('screens.history.result', { outcome: outcomeText(e.outcome) });
  if (rewritten) {
    result.append(h('s', fresh ? 'struck-out fresh' : 'struck-out', original));
    item.append(result);
    const variants = t('screens.history.rewrites').split('|');
    const text = t('screens.history.result', { outcome: variants[rewriteIndex(e, variants.length)] ?? '' });
    const typed = h('div', 'e-result typed', fresh ? '' : text);
    if (fresh) typeIn(typed, text, 900, 1100);
    item.append(typed, h('div', 'e-note', t('screens.history.note')));
  } else {
    result.textContent = original;
    item.append(result);
  }
  return item;
}

/** The notice board of the base: the announcements, then the Historia zgłoszeń (a lost ticket is rewritten here on the first visit). */
export function createBoard(root: HTMLElement, handlers: BoardHandlers): Board {
  let sheet: Sheet | null = null;

  const render = (meta: MetaState): void => {
    if (!sheet) return;
    const scroll = sheet.scroll;
    scroll.replaceChildren();

    const notices = h('ul', 'board-notices');
    for (const id of NOTICES) {
      const item = h('li', 'board-notice');
      item.append(h('b', '', t(`screens.base.board.notices.${id}.title`)), h('p', '', t(`screens.base.board.notices.${id}.text`)));
      notices.append(item);
    }
    const left = h('div', 'board-col');
    left.append(h('h3', 'group', t('screens.base.board.announcements')), notices);

    const pending = pendingRewrites(meta);
    const list = h('ol', 'hist-list');
    if (meta.history.length === 0) {
      list.append(h('li', 'hist-entry empty', t('screens.baza.emptyHistory')));
    } else {
      meta.history.forEach((e, i) => list.prepend(entryView(e, pending.includes(i))));
    }
    const right = h('div', 'board-col');
    right.append(h('h3', 'group', t('screens.base.board.history')), list);

    const board = h('div', 'board');
    board.append(left, right);
    scroll.append(board);
    if (pending.length) handlers.onRewritten(pending);
  };

  return {
    open(meta) {
      sheet?.remove();
      sheet = createSheet(root, { title: t('screens.base.board.title'), sub: t('screens.baza.agency'), onClose: handlers.onClose });
      sheet.el.classList.add('board-sheet');
      sheet.note(t('screens.base.board.note'));
      render(meta);
    },
    close() {
      sheet?.remove();
      sheet = null;
    },
    isOpen: () => sheet !== null,
  };
}
