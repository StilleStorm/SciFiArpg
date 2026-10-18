import { t } from '../i18n';
import { isLost, pendingRewrites, rewriteIndex } from '../save/history';
import type { Bookmark } from '../save/bookmark';
import type { MetaState, TicketEntry } from '../save/save';
import { tween } from '../render/tween';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';
import './base.css';

export interface BazaHandlers {
  /** "Nowe zgłoszenie": the ticket form opens as a sheet over the base. */
  onNewTicket(): void;
  onChangeHero(): void;
  /** Take up the ticket that was left unfinished (Zakończ, or the app was closed during a run): the exit of the base leads back into it. */
  onResume(bookmark: Bookmark): void;
  /** Called with the history indices whose corrected version was just shown (the caller saves them). */
  onRewritten(indices: number[]): void;
  /** "Wróć do zgłoszenia": back through the service tunnel into the held run (only offered while a run is held). */
  onReturn?(): void;
  /** The sheet was closed with "Zamknij". */
  onClose(): void;
}

/** The ticket that waits on its page while the player is in the base (world/tunnel.ts, main.ts). */
export interface TunnelWait {
  number: number;
  /** 1-based page number. */
  page: number;
}

export interface Baza {
  /** The desk sheet over the base page: history, profile, resume, "Nowe zgłoszenie" (the old base form, now a sheet). */
  open(meta: MetaState): void;
  close(): void;
  isOpen(): boolean;
  /** While a run is held the desk offers the return line and does not offer the bookmark (it is the same ticket); null clears it. */
  setTunnel(wait: TunnelWait | null): void;
}

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

/** The desk of the Asystent: the base form of the ticket system as a sheet that scrolls in its own area (portrait and landscape). */
export function createBaza(root: HTMLElement, handlers: BazaHandlers): Baza {
  let sheet: Sheet | null = null;
  let waiting: TunnelWait | null = null;

  const render = (meta: MetaState): void => {
    if (!sheet) return;
    const scroll = sheet.scroll;
    scroll.replaceChildren();
    const heroName = meta.heroId ? t(`screens.profile.${meta.heroId}`) : t('screens.baza.noHero');

    const change = h('button', 'link-btn', t('screens.baza.changeHero'));
    change.type = 'button';
    change.addEventListener('click', handlers.onChangeHero);
    const profile = h('div', 'trow');
    profile.append(h('label', '', t('screens.baza.hero')), h('span', 'tval', heroName), change);
    const stars = h('div', 'trow');
    stars.append(h('label', '', t('screens.baza.gwiazdki')), h('span', 'tval', String(meta.character?.gwiazdki ?? 0)));

    const pending = pendingRewrites(meta);
    const list = h('ol', 'hist-list');
    if (meta.history.length === 0) {
      list.append(h('li', 'hist-entry empty', t('screens.baza.emptyHistory')));
    } else {
      meta.history.forEach((e, i) => list.prepend(entryView(e, pending.includes(i))));
    }

    const left = h('div', 'desk-col desk-col-a');
    const right = h('div', 'desk-col desk-col-b');
    if (waiting) {
      const back = h('button', 'resume-btn tunnel-return', t('screens.baza.tunnelReturn'));
      back.type = 'button';
      back.addEventListener('click', () => handlers.onReturn?.());
      const block = h('div', 'resume-line tunnel-line');
      block.append(h('p', 'tunnel-wait', t('screens.baza.tunnelWaiting', { number: waiting.number, page: waiting.page })), back, h('p', 'resume-note', t('screens.baza.tunnelNote')));
      left.append(block);
    }
    const mark = waiting ? undefined : meta.bookmark;
    if (mark) {
      const resume = h('button', 'resume-btn', t('screens.baza.resume', { number: mark.ticketNumber }));
      resume.type = 'button';
      resume.addEventListener('click', () => handlers.onResume(mark));
      const block = h('div', 'resume-line');
      block.append(resume, h('p', 'resume-note', t('screens.baza.resumeNote', { planet: mark.planetName, page: mark.pageIndex + 1 })));
      left.append(block);
    }
    left.append(profile, stars);
    right.append(h('h3', 'group', t('screens.baza.history')), list);
    const desk = h('div', 'desk');
    desk.append(left, right);
    scroll.append(desk);

    // the action is pinned under the scrolling area, so a long history never pushes it off the page
    sheet.el.querySelector('.desk-actions')?.remove();
    const actions = h('div', 'desk-actions');
    const fresh = h('button', 'start', t('screens.baza.newTicket'));
    fresh.type = 'button';
    fresh.addEventListener('click', handlers.onNewTicket);
    actions.append(fresh);
    scroll.after(actions);
    if (pending.length) handlers.onRewritten(pending);
  };

  return {
    open(meta) {
      sheet?.remove();
      sheet = createSheet(root, { title: t('screens.base.deskTitle'), sub: t('screens.baza.agency'), onClose: handlers.onClose });
      sheet.el.classList.add('desk-sheet');
      sheet.note(t('screens.base.deskNote'));
      render(meta);
    },
    close() {
      sheet?.remove();
      sheet = null;
    },
    isOpen: () => sheet !== null,
    setTunnel(wait) {
      waiting = wait;
    },
  };
}
