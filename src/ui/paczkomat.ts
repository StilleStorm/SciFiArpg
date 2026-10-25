import type { Player } from '../entities/types';
import { createRng } from '../core/rng';
import { t } from '../i18n';
import { PACZKOMAT_FEE } from '../balance/loot';
import { claimAwizo, runsLeft } from '../items/delivery';
import type { Awizo } from '../items/types';
import { el } from '../render/svg';
import { h } from './dom';
import { tierWord } from './itemView';
import { createSheet, type Sheet } from './sheet';
import './paczkomat.css';

/** A hatched barcode in ink: vertical strokes of uneven width and length from the parcel's number, a row of short hatches under them. */
function barcode(a: Pick<Awizo, 'n'>): SVGSVGElement {
  const r = createRng(a.n * 7919 + 13);
  const svg = el('svg', { viewBox: '0 0 56 56', class: 'pfig-svg', 'aria-hidden': 'true' });
  let x = 7;
  while (x < 49) {
    const w = r.pick([1, 1, 1.6, 2.4]);
    svg.append(el('line', { x1: x, y1: 9, x2: x + r.range(-0.5, 0.5), y2: r.range(33, 37), 'stroke-width': w }));
    x += w + r.range(1.8, 3.6);
  }
  for (let i = 0; i < 9; i++) svg.append(el('line', { x1: 7 + i * 5, y1: 46, x2: 11 + i * 5, y2: 41, 'stroke-width': 1 }));
  return svg;
}

/** The plate of one awizo: the barcode, the number, the paczkomat's page (or the base), what the parcel is, the sender and the days left. */
export function awizoCard(a: Awizo): HTMLElement {
  const row = h('div', 'awizo');
  const fig = h('span', 'pfig');
  fig.style.width = '56px';
  fig.style.height = '56px';
  fig.append(barcode(a));
  const cap = h('span', 'awizo-cap');
  cap.append(
    h('b', 'awizo-n', t('economy.paczkomat.awizo', { n: a.n })),
    h('span', 'awizo-where', a.page > 0 ? t('economy.paczkomat.page', { page: a.page }) : t('economy.paczkomat.base')),
    h('span', 'awizo-parcel', t('economy.paczkomat.parcel', { tier: tierWord(a.item), slot: t(`items.slotShort.${a.item.slot}`).toLocaleLowerCase('pl'), level: a.item.level })),
  );
  if (a.komisja) cap.append(h('span', 'awizo-from', t('economy.paczkomat.komisja')));
  if (a.page === 0) cap.append(h('span', 'awizo-back', t('economy.paczkomat.back', { count: runsLeft(a) })));
  row.append(fig, cap);
  return row;
}

export interface PaczkomatHost {
  player(): Player | null;
  /** A note in the sheet and on the page. */
  say(text: string): void;
  /** Called after the bag or the purse changed (the caller saves). */
  changed(): void;
  onClose(): void;
}

export interface PaczkomatSheet {
  sheet: Sheet;
  refresh(): void;
  close(): void;
}

/** The base paczkomat (ITEMS 8): the awizos at the base, each with a pickup for 15 gwiazdki. Content is rebuilt on each action. */
export function openPaczkomat(root: HTMLElement, host: PaczkomatHost): PaczkomatSheet {
  const sheet = createSheet(root, { title: t('economy.paczkomat.title'), sub: t('economy.paczkomat.sub'), onClose: host.onClose });
  sheet.el.classList.add('paczkomat-sheet');

  const claim = (a: Awizo): void => {
    const p = host.player();
    if (!p) return;
    const res = claimAwizo(p, a.n);
    if (res.result === 'ok') {
      host.say(t('economy.paczkomat.claimed', { n: a.n, fee: PACZKOMAT_FEE }));
      host.changed();
    } else if (res.result === 'poor') host.say(t('economy.paczkomat.poor', { fee: PACZKOMAT_FEE }));
    else if (res.result === 'full') host.say(t('economy.paczkomat.full'));
    else if (res.result === 'away') host.say(t('economy.paczkomat.away'));
    refresh();
  };

  function refresh(): void {
    const p = host.player();
    if (!p) return;
    const top = sheet.scroll.scrollTop;
    sheet.sub.textContent = `${t('economy.paczkomat.sub')} ${t('items.ui.stars', { n: p.gwiazdki })}`;
    sheet.scroll.replaceChildren();
    const list = p.awizos ?? [];
    if (list.length === 0) sheet.scroll.append(h('p', 'inv-empty', t('economy.paczkomat.empty')));
    for (const a of list) {
      const plate = h('div', 'awizo-plate');
      plate.append(awizoCard(a));
      const actions = h('div', 'awizo-actions');
      const away = a.page > 0;
      const price = t('items.ui.price', { count: PACZKOMAT_FEE });
      const b = h('button', 'ps-btn', `${t('economy.paczkomat.get')} · ${price}`);
      b.type = 'button';
      b.disabled = away;
      b.dataset['awizo'] = String(a.n);
      b.addEventListener('click', () => claim(a));
      actions.append(b);
      if (away) actions.append(h('p', 'awizo-away', t('economy.paczkomat.away')));
      plate.append(actions);
      sheet.scroll.append(plate);
    }
    sheet.scroll.append(h('p', 'awizo-fee', t('economy.paczkomat.fee', { fee: PACZKOMAT_FEE })));
    sheet.scroll.scrollTop = top;
  }

  refresh();
  return { sheet, refresh, close: () => sheet.remove() };
}
