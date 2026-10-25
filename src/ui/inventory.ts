import type { Bus } from '../core/events';
import type { Player } from '../entities/types';
import { t } from '../i18n';
import { adapterPrice, SET_BONUS } from '../items/compat';
import { buyOutPrice } from '../items/generate';
import {
  INVENTORY_CAP,
  buyAdapter,
  buyOut,
  canBuyAdapter,
  canBuyOut,
  dropItem,
  equipItem,
  unequipSlot,
} from '../items/inventory';
import { effectiveStats } from '../items/stats';
import { SLOTS, type Item, type Slot, type StatBlock } from '../items/types';
import { FREE_TRIAL_KILLS } from '../items/reviews';
import { claimIsHearsay, disposalRefusal } from '../items/absurd';
import { binItem, binValue, needsAsk } from '../economy/kosz';
import { reklamacjaWords } from '../economy/reklamacja';
import { drawingSvg } from '../render/itemDrawings';
import type { RunState } from '../world/run';
import { h } from './dom';
import { equipNotes, paragraphBlock, setBlock } from './itemSets';
import { wornSetCounts } from '../items/sets';
import {
  ROW_KEYS,
  caption,
  declaredHead,
  deltaSpan,
  displayName,
  figure,
  isStruck,
  itemRowText,
  reviewText,
  rowLabel,
  rowValue,
  shownStats,
  summary,
  tierWord,
} from './itemView';
import { awizoCard } from './paczkomat';
import { createSheet, type Sheet } from './sheet';
import './inventory.css';

export interface InventoryUi {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

/** Everything the sheet changes goes through the Player; `say` shows a note in the sheet and on the page. */
export interface InventoryHost {
  player(): Player | null;
  say(text: string): void;
  /** Called after any change so the HUD etc. can refresh. */
  changed(): void;
}

/**
 * The "Załączniki" sheet. Plates numbered "Ryc. N.", claimed vs actual, a typed comparison with
 * the worn item, buttons. Content is rebuilt on each action (never in the game loop).
 */
export function createInventorySheet(root: HTMLElement, host: InventoryHost, onClose: () => void): { sheet: Sheet; refresh(): void; select(uid: number | null): void } {
  const sheet = createSheet(root, { title: t('items.ui.title'), sub: t('items.ui.sub'), onClose });
  let selected: number | null = null;
  let firstDraw = true;
  /** The item whose bin form is up (rzadki and up ask once). */
  let binAsk: number | null = null;

  const find = (p: Player, uid: number): Item | null => {
    for (const it of p.inventory) if (it.uid === uid) return it;
    for (const s of SLOTS) {
      const e = p.equipment[s];
      if (e && e.uid === uid) return e;
    }
    return null;
  };

  const act = (fn: (p: Player) => void): void => {
    const p = host.player();
    if (!p) return;
    fn(p);
    host.changed();
    refresh();
  };

  function wornStrip(p: Player): HTMLElement {
    const wrap = h('div', 'inv-worn');
    for (const slot of SLOTS) {
      const item = p.equipment[slot];
      const cell = h('button', 'inv-slot');
      cell.type = 'button';
      if (item && item.uid === selected) cell.classList.add('sel');
      const box = h('span', `inv-slot-box${item ? '' : ' empty'}`);
      if (item) {
        box.append(drawingSvg(item.drawing, item)); // tier and affix marks (ITEMS 9)
        box.append(h('span', isStruck(item) ? 'inv-slot-n struck' : 'inv-slot-n', String(item.number)));
        if (item.blockedBy && !item.adapter) cell.classList.add('blocked');
      }
      cell.append(box, h('span', 'inv-slot-label', t(`items.slotShort.${slot}`)));
      if (item) {
        cell.addEventListener('click', () => {
          selected = selected === item.uid ? null : item.uid;
          refresh();
        });
      }
      wrap.append(cell);
    }
    return wrap;
  }

  function statsTable(item: Item): HTMLElement {
    const table = h('table', 'ttab');
    const head = h('tr');
    head.append(h('th', '', t('items.ui.tableStat')), h('th', '', declaredHead(item)), h('th', '', t('items.ui.actual')), h('th', 'delta-cell'));
    table.append(head);
    for (const key of ROW_KEYS) {
      const c = itemRowText(item, item.claimed, key);
      const a = itemRowText(item, item.actual, key);
      if (!c && !a) continue;
      const row = h('tr');
      row.append(h('td', '', rowLabel(key)), h('td', '', c || '—'));
      const real = h('td', item.revealed ? '' : 'pending');
      if (item.revealed) real.textContent = a || '—';
      else real.append(h('span', '', t('items.ui.afterTrial')));
      const dcell = h('td', 'delta-cell');
      if (item.revealed) {
        const d = deltaSpan(rowValue(item.actual, key) - rowValue(item.claimed, key));
        if (d) dcell.append(d);
      }
      row.append(real, dcell);
      table.append(row);
    }
    if (item.damageType) {
      const extra: [string, string][] = [
        [t('items.stat.type'), t(`items.dtype.${item.damageType}`)],
        [t('items.stat.range'), String(item.range ?? 0)],
      ];
      for (const [label, value] of extra) {
        const row = h('tr');
        const v = h('td', '', value);
        v.colSpan = 2;
        row.append(h('td', '', label), v, h('td', 'delta-cell'));
        table.append(row);
      }
    }
    return table;
  }

  function compareTable(p: Player, item: Item): HTMLElement | null {
    const worn = p.equipment[item.slot];
    if (worn && worn.uid === item.uid) return null;
    const mine: StatBlock = shownStats(item);
    const cur: StatBlock | null = worn ? effectiveStats(worn) : null;
    const table = h('table', 'ttab');
    const head = h('tr');
    head.append(h('th', '', t('items.ui.tableStat')), h('th', '', t('items.ui.current')), h('th', '', t('items.ui.chosen')), h('th', 'delta-cell'));
    table.append(head);
    let rows = 0;
    for (const key of ROW_KEYS) {
      const a = cur && worn ? itemRowText(worn, cur, key) : '';
      const b = itemRowText(item, mine, key);
      if (!a && !b) continue;
      rows++;
      const row = h('tr');
      row.append(h('td', '', rowLabel(key)), h('td', '', a || '—'), h('td', '', b || '—'));
      const d = h('td', 'delta-cell');
      const diff = deltaSpan(rowValue(mine, key) - (cur ? rowValue(cur, key) : 0));
      if (diff) d.append(diff);
      row.append(d);
      table.append(row);
    }
    if (!worn) {
      const note = h('p', 'inv-line', t('items.ui.noneWorn'));
      const box = h('div');
      box.append(table, note);
      return rows ? box : null;
    }
    return rows ? table : null;
  }

  function detail(p: Player, item: Item): HTMLElement {
    const d = h('div', 'inv-detail');
    const desc = item.uniqueId ? t(`items.unique.${item.uniqueId}.desc`) : t(`items.base.${item.baseId}.desc`);
    d.append(h('p', 'inv-desc', desc));
    d.append(h('p', 'inv-meta', `${t('items.ui.tierLine', { tier: tierWord(item), level: item.level })}`));
    if (item.uniqueId) {
      const story = h('p', 'inv-story');
      story.append(h('sup', '', '¹'), document.createTextNode(t(`items.unique.${item.uniqueId}.story`)));
      d.append(story);
    } else {
      d.append(h('p', 'inv-review', `${t('items.review.label')}: ${reviewText(item)}`));
      if (item.revealed) {
        const truth = item.review?.truth ?? 'honest';
        d.append(h('p', 'inv-line', t(truth === 'bought' ? 'items.review.bought' : truth === 'niedoceniony' ? 'items.review.underrated' : 'items.review.honest')));
      } else if (item.trialTarget > 0 || claimIsHearsay(item)) { // rzekomy: "0 z 0", it never reveals
        d.append(h('p', 'inv-line', `${t('items.review.unverified')} ${t('items.review.trial', { done: Math.floor(item.trialKills), total: item.trialTarget })}`));
      }
    }
    d.append(statsTable(item));
    reklamacjaWords(item).forEach((w, i) => {
      const line = h('p', 'inv-line inv-rek');
      line.append(document.createTextNode(`${t('economy.reklamacja.lineStruck', { k: i + 1 })} `), h('s', '', w.struck), document.createTextNode(`. ${t('economy.reklamacja.lineTyped')} ${w.typed}.`));
      d.append(line);
    });
    for (const extra of [setBlock(p, item), paragraphBlock(p, item)]) if (extra) d.append(extra); // S17: the set with its bonuses, the unique's paragraph
    if (item.likes || item.dislikes) {
      const tags = h('p', 'inv-line');
      const parts: string[] = [];
      if (item.likes) parts.push(t('items.compat.likes', { tag: t(`items.tag.${item.likes}`) }));
      if (item.dislikes) parts.push(t('items.compat.dislikes', { tag: t(`items.tag.${item.dislikes}`) }));
      tags.textContent = parts.join(' · ');
      d.append(tags);
    }
    if (item.freeVersion) {
      const line = item.bought
        ? t('items.free.boughtNote')
        : item.revealed
          ? t('items.free.active')
          : t('items.free.note', { n: FREE_TRIAL_KILLS });
      d.append(h('p', 'inv-line', line));
    }
    const worn = p.equipment[item.slot] === item;
    if (item.blockedBy && !item.adapter) {
      const box = h('div', 'inv-blocked');
      box.append(h('span', 'stamp-tag', t('items.ui.blocked')));
      box.append(h('p', 'inv-line', t('items.compat.blocked')));
      box.append(h('p', 'inv-line', t('items.compat.clash', { a: item.number, b: item.blockedBy.number, tag: t(`items.tag.${item.blockedBy.tag}`) })));
      d.append(box);
    }
    const cmp = worn ? null : compareTable(p, item);
    if (cmp) d.append(cmp);

    const buttons = h('div', 'inv-actions');
    const mk = (label: string, fn: () => void, disabled = false): HTMLButtonElement => {
      const b = h('button', 'ps-btn', label);
      b.type = 'button';
      b.disabled = disabled;
      b.addEventListener('click', fn);
      return b;
    };
    if (worn) {
      buttons.append(mk(t('items.ui.unequip'), () => act((pl) => {
        const res = unequipSlot(pl, item.slot);
        host.say(res === 'full' ? t('items.ui.full') : t('items.ui.taken', { n: item.number }));
      })));
    } else {
      buttons.append(mk(t('items.ui.equip'), () => act((pl) => {
        const before = wornSetCounts(pl.equipment);
        const res = equipItem(pl, item);
        if (res.outcome !== 'ok') return;
        host.say(t('items.ui.worn2', { n: item.number }));
        for (const line of equipNotes(pl, item, before)) host.say(line);
        if (res.clash) host.say(t('items.compat.clash', { a: item.number, b: res.clash.number, tag: t(`items.tag.${res.clash.tag}`) }));
        for (const set of res.newSets) {
          host.say(t('items.compat.set', { a: set.a.number, b: set.b.number, tag: t(`items.tag.${set.tag}`), bonus: SET_BONUS.pewnosc ?? 0 }));
        }
      })));
    }
    if (canBuyAdapter(item)) {
      const price = adapterPrice(item);
      const b = mk(`${t('items.ui.buyAdapter')} · ${t('items.ui.price', { count: price })}`, () => act((pl) => {
        const res = buyAdapter(pl, item);
        host.say(res === 'ok' ? t('items.compat.adapterBought', { n: item.number }) : t('items.compat.adapterPoor', { price: t('items.ui.price', { count: price }) }));
      }));
      buttons.append(b);
    }
    if (canBuyOut(item)) {
      const price = buyOutPrice(item);
      buttons.append(mk(`${t('items.ui.buyOut')} · ${t('items.ui.price', { count: price })}`, () => act((pl) => {
        const res = buyOut(pl, item);
        host.say(res === 'ok' ? t('items.free.bought', { n: item.number }) : t('items.free.poor', { price: t('items.ui.price', { count: price }) }));
      })));
    }
    buttons.append(mk(t('items.ui.drop'), () => act((pl) => {
      if (dropItem(pl, item)) host.say(t('items.ui.dropped', { n: item.number }));
      if (selected === item.uid) selected = null;
    })));
    const doBin = (): void => {
      binAsk = null;
      act((pl) => {
        const res = binItem(pl, item);
        if (!res.ok) return host.say(res.message);
        for (const note of res.notes) host.say(note);
        if (selected === item.uid) selected = null;
      });
    };
    buttons.append(mk(t('economy.kosz.refund', { price: binValue(item) }), () => {
      const refusal = disposalRefusal(item, 'bin'); // a withdrawn item can only be dropped
      if (refusal) return host.say(refusal);
      if (!needsAsk(item)) return doBin();
      binAsk = item.uid;
      refresh();
    }));
    if (binAsk === item.uid) {
      // rzadki and up ask once, on a one-line form
      const form = h('div', 'inv-ask');
      form.append(h('p', 'inv-line', t('economy.kosz.ask', { n: item.number, price: binValue(item) })));
      const row = h('div', 'inv-actions');
      row.append(
        mk(t('economy.kosz.yes'), doBin),
        mk(t('economy.kosz.no'), () => {
          binAsk = null;
          refresh();
        }),
      );
      form.append(row);
      d.append(form);
      return d;
    }
    d.append(buttons);
    return d;
  }

  function plate(p: Player, item: Item): HTMLElement {
    const open = item.uid === selected;
    const li = h('div', `inv-plate${open ? ' open' : ''}`);
    const row = h('button', 'inv-row');
    row.type = 'button';
    row.append(figure(item, 56));
    const cap = h('span', 'inv-cap');
    const title = h('span', 'inv-title');
    title.append(h('b', isStruck(item) ? 'struck' : '', caption(item)), document.createTextNode(` ${displayName(item)}`));
    cap.append(title);
    cap.append(h('span', 'inv-rev', item.review ? reviewText(item) : t('items.review.none')));
    const flags: string[] = [tierWord(item)];
    if (item.blockedBy && !item.adapter) flags.push(t('items.ui.blocked'));
    cap.append(h('span', 'inv-sum', `${summary(shownStats(item))}`), h('span', 'inv-flags', flags.join(' · ')));
    row.append(cap);
    row.addEventListener('click', () => {
      selected = open ? null : item.uid;
      refresh();
    });
    li.append(row);
    if (open) li.append(detail(p, item));
    return li;
  }

  function refresh(): void {
    const p = host.player();
    if (!p) return;
    const top = sheet.scroll.scrollTop;
    if (selected !== null && !find(p, selected)) selected = null;
    if (firstDraw) {
      firstDraw = false;
      if (selected === null) selected = p.inventory[0]?.uid ?? null;
    }
    sheet.sub.textContent = `${t('items.ui.count', { n: p.inventory.length, max: INVENTORY_CAP })} ${t('items.ui.stars', { n: p.gwiazdki })}`;
    sheet.scroll.replaceChildren();
    sheet.scroll.append(h('h3', 'inv-h', t('items.ui.worn')), wornStrip(p));
    const wornSel = SLOTS.map((s: Slot) => p.equipment[s]).find((i) => i && i.uid === selected);
    if (wornSel) sheet.scroll.append(detail(p, wornSel));
    sheet.scroll.append(h('h3', 'inv-h', t('items.ui.bag')));
    if (!p.inventory.length) sheet.scroll.append(h('p', 'inv-empty', t('items.ui.empty')));
    for (const item of p.inventory) sheet.scroll.append(plate(p, item));
    if (p.awizos && p.awizos.length > 0) {
      sheet.scroll.append(h('h3', 'inv-h', t('economy.paczkomat.head')));
      for (const a of p.awizos) {
        const card = h('div', 'inv-awizo');
        card.append(awizoCard(a));
        sheet.scroll.append(card);
      }
    }
    sheet.scroll.scrollTop = top;
  }

  return {
    sheet,
    refresh,
    select(uid) {
      selected = uid;
      firstDraw = false;
    },
  };
}

/**
 * Wire the sheet to the game: opens on the `inventory` event, pauses the simulation while open
 * (status 'paused'), closes on screen changes and new runs.
 */
export function mountInventory(root: HTMLElement, bus: Bus, getState: () => RunState | null): InventoryUi {
  let ui: ReturnType<typeof createInventorySheet> | null = null;
  let pausedByUs = false;

  const host: InventoryHost = {
    player: () => getState()?.player ?? null,
    say(text) {
      ui?.sheet.note(text);
      bus.emit('footnote', { text });
    },
    changed() {
      /* HUD reads the player each frame */
    },
  };

  function close(): void {
    if (!ui) return;
    ui.sheet.remove();
    ui = null;
    const s = getState();
    if (pausedByUs && s && s.status === 'paused') s.status = 'running';
    pausedByUs = false;
  }

  function open(): void {
    const s = getState();
    if (!s || ui) return;
    if (s.status !== 'running' || s.modal || s.turning) return;
    s.status = 'paused';
    pausedByUs = true;
    ui = createInventorySheet(root, host, close);
    ui.refresh();
  }

  bus.on('inventory', () => (ui ? close() : open()));
  bus.on('screen:changed', () => close());
  bus.on('run:started', () => close());
  bus.on('player:died', () => close());
  return { open, close, isOpen: () => ui !== null };
}
