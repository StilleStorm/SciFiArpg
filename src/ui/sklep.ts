import type { Player } from '../entities/types';
import { BASE_SCHEDULE, botLine, createHours, formatClock, type HoursMachine } from '../economy/hours';
import {
  FEE_RATE,
  REPORTS_TO_UPDATE,
  buy,
  feeOf,
  loadSklep,
  reportProblem,
  restock,
  saveSklep,
  totalOf,
  type Listing,
  type SklepState,
} from '../economy/sklep';
import { t } from '../i18n';
import { allItems } from '../items/inventory';
import { shopIlvl } from '../items/level';
import { h } from './dom';
import { displayName, figure, reviewText, shownStats, summary, tierWord } from './itemView';
import { createSheet } from './sheet';
import './sklep.css';

/** Seed of the base store's stock (varied by the visit, i.e. runs completed). */
export const BASE_STORE_SEED = 48213;

export interface SklepOptions {
  /** 'base' runs its own office-hours clock; 'kiosk' is opened only when the kiosk is open. */
  mode?: 'base' | 'kiosk';
  /** In-run kiosk: the stock for this run. Default: the saved base store. */
  state?: SklepState;
  /** Called with every note (the run shows it as a page footnote too). */
  say?: (text: string) => void;
  onClose?: () => void;
  /** Number for a bought item ("Ryc. N"). Default: one past the highest number the player holds. */
  nextNumber?: () => number;
  /** Planet index whose item band the stock is rolled in (items/level.ts shopIlvl). Default: planet 1. */
  planet?: number;
}

export interface SklepHandle {
  el: HTMLElement;
  unmount(): void;
}

type Purse = Pick<Player, 'gwiazdki' | 'inventory' | 'level'> & Partial<Pick<Player, 'equipment'>>;

function nextNumberFor(p: Purse): number {
  const held = allItems({ inventory: p.inventory, equipment: p.equipment ?? {} });
  return Math.max(0, ...held.map((i) => i.number)) + 1;
}

/**
 * The Sklep as a sheet laid on `container`. At the base it keeps its own hours (a consultant,
 * then a bot for a short break). Prices are shown without the service fee; the fee is added at
 * checkout. The vendor lies about 1 item in 6.
 */
export function mountSklep(container: HTMLElement, meta: { runsCompleted: number }, player: Purse, opts: SklepOptions = {}): SklepHandle {
  const mode = opts.mode ?? 'base';
  const state = opts.state ?? loadSklep();
  const level = shopIlvl(opts.planet ?? 0);
  if (mode === 'base' && state.stockFor !== meta.runsCompleted) {
    restock(state, BASE_STORE_SEED, meta.runsCompleted, level, opts.planet ?? 0);
    saveSklep(state);
  } else if (!state.stock.length) {
    restock(state, BASE_STORE_SEED, meta.runsCompleted, level, opts.planet ?? 0);
  }
  const persist = (): void => {
    if (!opts.state) saveSklep(state);
  };

  let closed = false;
  const unmount = (): void => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    sheet.remove();
  };
  const sheet = createSheet(container, {
    title: t('economy.sklep.title'),
    sub: t('economy.sklep.sub'),
    onClose: () => {
      unmount();
      opts.onClose?.();
    },
  });
  const say = (text: string): void => {
    sheet.note(text);
    opts.say?.(text);
  };

  // ----- hours -----
  const hours: HoursMachine | null = mode === 'base' ? createHours(BASE_SCHEDULE) : null;
  const t0 = performance.now();
  const clock = (): number => (performance.now() - t0) / 1000;
  let botCount = 0;
  const isOpen = (): boolean => (hours ? hours.view(clock()).mode === 'open' : true);
  const hoursLine = h('p', 'sk-hours');
  let lastShown = '';
  let raf = 0;
  let lastTick = 0;

  const renderHours = (): void => {
    if (!hours) {
      hoursLine.textContent = t('economy.hours.consultant');
      return;
    }
    const v = hours.view(clock());
    const text = v.mode === 'open' ? t('economy.hours.open', { time: formatClock(v.remaining) }) : t('economy.hours.bot', { time: formatClock(v.remaining) });
    if (text !== lastShown) {
      lastShown = text;
      hoursLine.textContent = text;
    }
  };
  const tick = (now: number): void => {
    if (closed) return;
    if (now - lastTick > 250) {
      lastTick = now;
      renderHours();
      const change = hours?.tick(clock());
      if (change) {
        say(change.mode === 'open' ? t('economy.hours.opened') : t('economy.hours.closed'));
        draw();
      }
    }
    raf = requestAnimationFrame(tick);
  };

  // ----- list -----
  let checkout: number | null = null;
  let feeNoted = false;
  const sold = new Set<number>();

  const askBot = (): void => {
    say(botLine(botCount++));
  };

  const row = (l: Listing): HTMLElement => {
    const open = isOpen();
    const isSold = l.sold || sold.has(l.id);
    const wrap = h('div');
    const r = h('div', `sk-row${isSold ? ' sold' : ''}`);
    r.append(figure(l.item, 56));
    const info = h('div', 'sk-info');
    info.append(
      h('span', 'sk-name', displayName(l.item)),
      h('span', 'sk-rev', reviewText(l.item)),
      h('span', 'sk-sum', summary(shownStats(l.item))),
      h('span', 'sk-tag', `${tierWord(l.item)} · ${t(`items.slotShort.${l.item.slot}`)}`),
    );
    const buyBox = h('div', 'sk-buy');
    if (l.kind === 'oferta' || l.kind === 'adapter') buyBox.append(h('span', 'stamp-tag sk-kind', t(`economy.sklep.kind.${l.kind}`)));
    buyBox.append(h('span', 'sk-price', t('items.ui.price', { count: l.price })));
    const b = h('button', 'ps-btn', isSold ? t('economy.sklep.got') : t('economy.sklep.get'));
    b.type = 'button';
    b.disabled = isSold;
    b.addEventListener('click', () => {
      if (!isOpen()) return askBot();
      checkout = checkout === l.id ? null : l.id;
      if (checkout !== null && !feeNoted) {
        feeNoted = true;
        say(t('economy.sklep.feeNote'));
      }
      draw();
    });
    if (!open && !isSold) b.disabled = false;
    buyBox.append(b);
    r.append(info, buyBox);
    wrap.append(r);
    if (checkout === l.id && !isSold) wrap.append(checkoutPanel(l));
    return wrap;
  };

  const checkoutPanel = (l: Listing): HTMLElement => {
    const box = h('div', 'sk-checkout');
    const table = h('table', 'ttab');
    const price = l.price;
    const rows: [string, string, string][] = [
      [t('economy.sklep.price'), String(price), ''],
      [t('economy.sklep.fee', { percent: Math.round(FEE_RATE * 100) }), String(feeOf(price)), 'fee'],
      [t('economy.sklep.total'), String(totalOf(price)), 'total'],
      [t('economy.sklep.balance'), String(player.gwiazdki), ''],
    ];
    for (const [label, value, cls] of rows) {
      const tr = h('tr', cls);
      const th = h('td', '', label);
      if (cls === 'fee') th.append(h('sup', '', '1'));
      tr.append(th, h('td', '', value));
      table.append(tr);
    }
    box.append(table);
    const actions = h('div', 'sk-actions');
    const ok = h('button', 'ps-btn', t('economy.sklep.confirm'));
    ok.type = 'button';
    ok.disabled = player.gwiazdki < totalOf(price);
    ok.addEventListener('click', () => {
      if (!isOpen()) return askBot();
      const res = buy(state, player, l.id, opts.nextNumber ? opts.nextNumber() : nextNumberFor(player));
      if (!res.ok) {
        say(res.failure === 'full' ? t('items.full') : res.failure === 'sold' ? t('economy.sklep.gone') : t('economy.sklep.refused'));
      } else {
        sold.add(l.id);
        checkout = null;
        say(t('economy.sklep.bought', { n: res.item?.number ?? 0, total: res.total }));
        if (res.note) say(res.note);
        persist();
      }
      draw();
    });
    const cancel = h('button', 'ps-btn quiet', t('economy.sklep.cancel'));
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
      checkout = null;
      draw();
    });
    actions.append(ok, cancel);
    box.append(actions);
    return box;
  };

  function draw(): void {
    if (closed) return;
    const top = sheet.scroll.scrollTop;
    sheet.sub.textContent = `${t('economy.sklep.sub')} ${t('items.ui.stars', { n: player.gwiazdki })}`;
    sheet.scroll.replaceChildren();
    renderHours();
    sheet.scroll.append(hoursLine);
    for (const l of state.stock) sheet.scroll.append(row(l));
    const foot = h('div', 'sk-foot');
    const report = h('button', 'ps-btn quiet', t('economy.sklep.report'));
    report.type = 'button';
    report.addEventListener('click', () => {
      if (!isOpen()) return askBot();
      const res = reportProblem(state, BASE_STORE_SEED, level, opts.planet ?? 0);
      if (res.updated) {
        say(t('economy.sklep.updated', { version: `1.${state.updates}` }));
        checkout = null;
        sold.clear();
        sheet.el.append(h('span', 'stamp-tag sk-stamp', t('economy.sklep.stamp')));
      } else {
        say(t('economy.sklep.reported', { count: res.reports, max: REPORTS_TO_UPDATE }));
      }
      persist();
      draw();
    });
    foot.append(report, h('span', 'count', t('economy.sklep.reports', { count: state.reports, max: REPORTS_TO_UPDATE })));
    sheet.scroll.append(foot, h('p', 'sk-version', t('economy.sklep.version', { version: `1.${state.updates}` })));
    sheet.scroll.scrollTop = top;
  }

  hours?.tick(0);
  draw();
  if (hours) raf = requestAnimationFrame(tick);
  return { el: sheet.el, unmount };
}
