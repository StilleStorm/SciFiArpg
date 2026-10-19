/** WYKAZ SPRAW: the roster. Each character is a case file with its hero, level and planet; the screen after the cover. */
import type { HeroId } from '../heroes';
import { t } from '../i18n';
import type { Character } from '../save/character';
import { buildHeroFigure } from '../render/heroFigures';
import { el } from '../render/svg';
import { h } from './dom';
import { openKarta, type KartaInput, type KartaSheet } from './karta';
import { openPopup, type Popup } from './popup';
import { caseTitle, errorText } from './rosterModel';
import type { CaseFile, RosterStore } from './rosterStore';
import './roster.css';

export interface RosterHandlers {
  /** A case file was opened ("Otwórz teczkę"): the store has made it active; the base follows. */
  onOpen(id: string): void;
  /** "Nowa sprawa": the hero pick and the case number. */
  onCreate(): void;
  /** "Wróć na okładkę". */
  onBack(): void;
  /** A file was deleted. */
  onRemoved?(id: string, wasActive: boolean): void;
}

export interface Roster {
  el: HTMLElement;
  refresh(): void;
  destroy(): void;
}

const heroName = (heroId: HeroId): string => t(`screens.profile.${heroId}`);

/** What the chart reads from a saved character. */
export const kartaInputOf = (c: Character): KartaInput => ({ progress: c, pads: c.pads, specialization: c.specialization ?? null, ...(c.ultimate ? { ultimate: c.ultimate } : {}) });

function figureOf(heroId: HeroId): SVGSVGElement {
  const svg = el('svg', { class: 'rs-fig', viewBox: '-38 -46 76 88', 'aria-hidden': 'true' });
  svg.append(buildHeroFigure(heroId));
  return svg;
}

export function mountRoster(root: HTMLElement, store: RosterStore, handlers: RosterHandlers, from: 'title' | 'baza' = 'title'): Roster {
  const screen = h('div', 'screen paper roster');
  const frame = h('div', 'frame');
  const count = h('span', '');
  const head = h('div', 'head');
  head.append(h('span', 'agency', t('screens.roster.agency')), count);
  const list = h('ul', 'rs-list');
  const scroll = h('div', 'rs-scroll');
  const note = h('p', 'rs-note', t('screens.roster.note'));
  scroll.append(note, list);
  const fresh = h('button', 'start rs-new', t('screens.roster.new'));
  fresh.type = 'button';
  fresh.dataset['roster'] = 'new';
  fresh.addEventListener('click', handlers.onCreate);
  const full = h('p', 'rs-full', t('screens.roster.full'));
  const back = h('button', 'link-btn rs-back', t(from === 'baza' ? 'screens.roster.backToBase' : 'screens.roster.back'));
  back.type = 'button';
  back.dataset['roster'] = 'back';
  back.addEventListener('click', handlers.onBack);
  const status = h('p', 'rs-status');
  status.setAttribute('role', 'status');
  const foot = h('div', 'rs-foot');
  foot.append(status, fresh, full, back);
  frame.append(head, h('hr', 'rule'), h('h2', 'rs-title', t('screens.roster.title')), h('p', 'rs-sub', t('screens.roster.sub')), scroll, foot);
  screen.append(frame);
  root.append(screen);

  let karta: KartaSheet | null = null;
  let confirm: Popup | null = null;

  const say = (text: string): void => {
    status.textContent = text;
  };

  const showKarta = (id: string): void => {
    const c = store.characterOf(id);
    if (!c || karta) return;
    screen.classList.add('hidden');
    karta = openKarta(root, kartaInputOf(c), () => {
      karta?.close();
      karta = null;
      screen.classList.remove('hidden');
    });
  };

  const askRemove = (file: CaseFile): void => {
    confirm?.close();
    confirm = openPopup(root, {
      title: t('screens.roster.removeTitle'),
      body: [t('screens.roster.removeBody', { name: caseTitle(file.name), hero: heroName(file.heroId), level: file.level })],
      buttons: [
        {
          label: t('screens.roster.removeConfirm'),
          onClick: () => {
            confirm?.close();
            const res = store.remove(file.id);
            if (!res.ok) {
              say(errorText(res.error));
              return;
            }
            refresh();
            say(t('screens.roster.removed', { name: caseTitle(file.name) }));
            handlers.onRemoved?.(file.id, file.active);
          },
        },
        { label: t('screens.roster.removeCancel'), quiet: true, onClick: () => confirm?.close() },
      ],
    });
  };

  const heroLine = (file: CaseFile): HTMLElement => {
    const p = h('p', 'rs-hero');
    p.append(h('span', '', heroName(file.heroId)), h('span', '', t('screens.roster.level', { level: file.level })));
    return p;
  };

  const caseEl = (file: CaseFile): HTMLElement => {
    const li = h('li', `rs-case${file.active ? ' active' : ''}`);
    li.dataset['case'] = file.id;
    li.dataset['hero'] = file.heroId;
    const info = h('div', 'rs-info');
    info.append(
      h('h3', 'rs-name', caseTitle(file.name)),
      heroLine(file),
      h('p', 'rs-meta', file.planet ? t('screens.roster.planet', { planet: file.planet }) : t('screens.roster.noPlanet')),
      h('p', 'rs-meta', t('screens.roster.tickets', { count: file.tickets })),
    );
    if (file.active) info.append(h('p', 'rs-current pen', t('screens.roster.current')));
    const open = h('button', 'rs-enter', t('screens.roster.open'));
    open.type = 'button';
    open.dataset['roster'] = 'open';
    open.addEventListener('click', () => {
      const res = store.select(file.id);
      if (!res.ok) {
        say(errorText(res.error));
        return;
      }
      handlers.onOpen(file.id);
    });
    const karta = h('button', 'link-btn', t('screens.roster.karta'));
    karta.type = 'button';
    karta.dataset['roster'] = 'karta';
    karta.addEventListener('click', () => showKarta(file.id));
    const remove = h('button', 'link-btn rs-remove', t('screens.roster.remove'));
    remove.type = 'button';
    remove.dataset['roster'] = 'remove';
    remove.addEventListener('click', () => askRemove(file));
    const actions = h('div', 'rs-actions');
    actions.append(open, karta, remove);
    li.append(figureOf(file.heroId), info, actions);
    return li;
  };

  function refresh(): void {
    const files = store.files();
    count.textContent = t('screens.roster.count', { count: files.length, limit: store.limit });
    list.replaceChildren(...files.map(caseEl));
    if (files.length === 0) list.append(h('li', 'rs-empty', t('screens.roster.empty')));
    const isFull = files.length >= store.limit;
    fresh.classList.toggle('hidden', isFull);
    full.classList.toggle('hidden', !isFull);
  }
  refresh();

  return {
    el: screen,
    refresh,
    destroy() {
      karta?.close();
      karta = null;
      confirm?.close();
      screen.remove();
    },
  };
}
