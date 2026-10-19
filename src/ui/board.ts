import { t } from '../i18n';
import { isLost, pendingRewrites, rewriteIndex } from '../save/history';
import type { MetaState, TicketEntry } from '../save/save';
import { tween } from '../render/tween';
import { questById, type AcceptResult, type ActiveQuest, type QuestDef, type QuestState, MAX_ACTIVE, offersFor } from '../world/quests';
import { h } from './dom';
import { inkStamp } from './karta-osobowa';
import { createSheet, type Sheet } from './sheet';
import './base.css';
import './board-quests.css';

export interface BoardHandlers {
  /** Called with the history indices whose corrected version was just shown (the caller saves them). */
  onRewritten(indices: number[]): void;
  /** The sheet was closed with "Zamknij". */
  onClose(): void;
}

/** What the board needs of the side tickets (main.ts gives it the live run; the board never touches the state itself). */
export interface BoardQuests {
  /** The 0-based planet whose tickets are pinned up. */
  planet(): number;
  state(): QuestState;
  accept(id: string): AcceptResult;
  drop(id: string): void;
  /** "Zgłaszam wykonanie": false when the ticket is not ready. The caller saves the character. */
  report(id: string): boolean;
}

export interface Board {
  /** The notice board sheet over the base page: the side tickets, three fixed announcements, then the Historia zgłoszeń. */
  open(meta: MetaState, quests?: BoardQuests): void;
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

// ---------- the side tickets ----------

/** One ticket as the card prints it (pure, tested). */
export interface QuestCard {
  id: string;
  title: string;
  text: string;
  /** The reward in words, one entry per kind. */
  reward: string[];
  /** Progress line for a taken ticket; null for one still on the board. */
  progress: string | null;
  taken: boolean;
  ready: boolean;
}

export function questCard(def: QuestDef, held: ActiveQuest | undefined): QuestCard {
  const from = def.family ? t('screens.quests.fromFamily', { family: t(`screens.family.${def.family}`) }) : t('screens.quests.fromAny');
  const reward: string[] = [t('screens.quests.reward.stars', { count: def.reward.stars })];
  if (def.reward.permission) reward.push(t('screens.quests.reward.permission', { family: t(`screens.family.${def.reward.permission}`) }));
  if (def.reward.potwierdzenia) reward.push(t('screens.quests.reward.potw', { count: def.reward.potwierdzenia }));
  const ready = held !== undefined && held.progress >= def.n;
  let progress: string | null = null;
  if (held) {
    if (def.kind === 'deliver') progress = t(`screens.quests.stage${ready ? 2 : held.stage}`);
    else if (def.kind === 'reach') progress = t('screens.quests.page', { done: held.progress, n: def.n });
    else progress = t('screens.quests.progress', { done: held.progress, n: def.n });
  }
  return {
    id: def.id,
    title: t(def.titleKey),
    text: t(def.textKey, { count: def.n, from }),
    reward,
    progress,
    taken: held !== undefined,
    ready,
  };
}

function cardEl(c: QuestCard, actions: HTMLElement[], stamped = false): HTMLElement {
  const box = h('li', `bq-card${c.taken ? ' taken' : ''}${c.ready ? ' ready' : ''}${stamped ? ' done' : ''}`);
  box.dataset['quest'] = c.id;
  box.append(h('b', 'bq-title', c.title), h('p', 'bq-text', c.text));
  box.append(h('p', 'bq-reward', `${t('screens.quests.reward.label')}: ${c.reward.join(', ')}.`));
  if (c.progress) box.append(h('p', 'bq-progress', c.progress));
  if (stamped) box.append(inkStamp(t('screens.quests.stamp'), 14, -4, 'os-stamp bq-stamp'));
  if (actions.length) {
    const bar = h('div', 'bq-actions');
    bar.append(...actions);
    box.append(bar);
  }
  return box;
}

const action = (label: string, key: string, id: string, on: () => void, strong = false): HTMLButtonElement => {
  const b = h('button', `link-btn bq-btn${strong ? ' strong' : ''}`, label);
  b.type = 'button';
  b.dataset['bq'] = key;
  b.dataset['quest'] = id;
  b.addEventListener('click', on);
  return b;
};

/** The notice board of the base: the announcements, then the Historia zgłoszeń (a lost ticket is rewritten here on the first visit). */
export function createBoard(root: HTMLElement, handlers: BoardHandlers): Board {
  let sheet: Sheet | null = null;
  let quests: BoardQuests | null = null;
  /** Tickets reported while this sheet was up: they stay, stamped, until it closes. */
  let paid: QuestCard[] = [];

  const questBlock = (again: () => void): HTMLElement | null => {
    const api = quests;
    if (!api) return null;
    const state = api.state();
    const block = h('div', 'bq');
    block.append(h('h4', 'bq-head', t('screens.base.board.quests')), h('p', 'bq-note', t('screens.base.board.questsNote')));
    const list = h('ul', 'bq-list');
    for (const c of paid) list.append(cardEl(c, [], true));
    const taken = state.active.flatMap((a) => {
      const def = questById(a.id);
      return def ? [{ def, a }] : [];
    });
    for (const { def, a } of taken) {
      const c = questCard(def, a);
      const acts: HTMLElement[] = [];
      if (c.ready) {
        acts.push(
          action(t('screens.quests.report'), 'report', def.id, () => {
            paid.push({ ...c, progress: null, taken: false, ready: false });
            api.report(def.id);
            again();
          }, true),
        );
      }
      acts.push(action(t('screens.quests.drop'), 'drop', def.id, () => {
        api.drop(def.id);
        again();
      }));
      list.append(cardEl(c, acts));
    }
    const offers = offersFor(api.planet(), state);
    const full = state.active.length >= MAX_ACTIVE;
    for (const def of offers) {
      const c = questCard(def, undefined);
      const acts = full
        ? []
        : [
            action(t('screens.quests.accept'), 'accept', def.id, () => {
              api.accept(def.id);
              again();
            }, true),
          ];
      const card = cardEl(c, acts);
      if (full) card.append(h('p', 'bq-full', t('screens.quests.full', { count: MAX_ACTIVE })));
      list.append(card);
    }
    if (list.children.length === 0) list.append(h('li', 'bq-empty', t('screens.quests.none')));
    block.append(list);
    return block;
  };

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
    left.append(h('h3', 'group', t('screens.base.board.announcements')));
    const qb = questBlock(() => render(meta));
    if (qb) left.append(qb);
    left.append(notices);

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
    open(meta, api) {
      sheet?.remove();
      quests = api ?? null;
      paid = [];
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
