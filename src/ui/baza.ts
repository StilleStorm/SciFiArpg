import { t } from '../i18n';
import { isLost, pendingRewrites, rewriteIndex } from '../save/history';
import type { MetaState, TicketEntry } from '../save/save';
import { tween } from '../render/tween';
import { h } from './dom';

export interface BazaHandlers {
  onNewTicket(): void;
  onSettings(): void;
  onChangeHero(): void;
  /** Open the Sklep sheet (economy/sklep UI) over the base. */
  onShop(): void;
  /** Called with the history indices whose corrected version was just shown (the caller saves them). */
  onRewritten(indices: number[]): void;
}

export interface Baza {
  el: HTMLElement;
  show(meta: MetaState): void;
  hide(): void;
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

/** The PANEL UZYTKOWNIKA: the ticket system's main page between runs. */
export function createBaza(root: HTMLElement, handlers: BazaHandlers): Baza {
  const screen = h('div', 'screen paper hidden');
  const frame = h('div', 'frame baza');
  screen.append(frame);
  root.append(screen);

  return {
    el: screen,
    show(meta) {
      screen.classList.remove('hidden');
      frame.replaceChildren();
      const heroName = meta.heroId ? t(`screens.profile.${meta.heroId}`) : t('screens.baza.noHero');

      const change = h('button', 'link-btn', t('screens.baza.changeHero'));
      change.type = 'button';
      change.addEventListener('click', handlers.onChangeHero);
      const profile = h('div', 'trow');
      profile.append(h('label', '', t('screens.baza.hero')), h('span', 'tval', heroName), change);
      const stars = h('div', 'trow');
      stars.append(h('label', '', t('screens.baza.gwiazdki')), h('span', 'tval', String(meta.gwiazdki)));

      const open = h('button', 'link-btn', t('screens.baza.openShop'));
      open.type = 'button';
      open.addEventListener('click', handlers.onShop);
      const shop = h('div', 'trow');
      shop.append(h('label', '', t('screens.baza.shop')), h('span', 'tval', t('screens.baza.shopNote')), open);

      const pending = pendingRewrites(meta);
      const list = h('ol', 'hist-list');
      if (meta.history.length === 0) {
        list.append(h('li', 'hist-entry empty', t('screens.baza.emptyHistory')));
      } else {
        meta.history.forEach((e, i) => list.prepend(entryView(e, pending.includes(i))));
      }

      const fresh = h('button', 'start', t('screens.baza.newTicket'));
      fresh.type = 'button';
      fresh.addEventListener('click', handlers.onNewTicket);
      const settings = h('button', 'link-btn', t('screens.baza.settings'));
      settings.type = 'button';
      settings.addEventListener('click', handlers.onSettings);

      const scroll = h('div', 'scroll');
      scroll.append(profile, stars, shop, h('h3', 'group', t('screens.baza.history')), list);
      frame.append(
        h('div', 'agency', t('screens.baza.agency')),
        h('h2', 'form-title tight', t('screens.baza.title')),
        h('hr', 'rule'),
        scroll,
        fresh,
        settings,
      );
      if (pending.length) handlers.onRewritten(pending);
    },
    hide() {
      screen.classList.add('hidden');
    },
  };
}
