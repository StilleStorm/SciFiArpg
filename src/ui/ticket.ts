import { t } from '../i18n';
import { stamp } from '../render/ink';
import { drawPlanet } from '../render/planet';
import { el } from '../render/svg';
import { tween } from '../render/tween';
import type { TicketInfo } from '../world/ticket';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';
import { clampPriority, DEFAULT_PRIORITY, planetDef, PRIORITIES, PRIORITY_IDS, priorityUnlocked, type PriorityId } from '../world/campaign';
import { ACT_ROMAN, actOf, type CampaignView } from './ticketModel';
import './base.css';

export interface TicketHandlers {
  /** "Akceptuję regulamin", after the stamp has landed, with the priority chosen on the form. */
  onAccept(priority: PriorityId): void;
  /** Free travel after the case: a closed planet, at the character's current level. */
  onTravel?(planetIndex: number, priority: PriorityId): void;
  /** "Zgłoszenie dodatkowe" after the case: a random planet and clause. */
  onExtra?(priority: PriorityId): void;
  /** "Zamknij": back to the base page without a ticket. */
  onClose(): void;
}

/** What the form needs besides the ticket itself. */
export interface TicketContext {
  /** The character's level: the priorities unlock by it. */
  level: number;
  /** The campaign as the character stands in it, with the plan on the desk (ticketModel.campaignViewOf). */
  view: CampaignView;
}

export interface TicketScreen {
  open(info: TicketInfo, ctx: TicketContext): void;
  /** The priority on the form now. */
  priority(): PriorityId;
  close(): void;
  isOpen(): boolean;
}

function row(label: string, value: string, extra = ''): HTMLElement {
  const r = h('div', `trow ${extra}`.trim());
  const v = h('span', 'tval', value);
  r.append(h('label', '', label), v);
  return r;
}

/**
 * The ticket header as a sheet over the base page: number, planet, the regulamin clause, the dominant family, an
 * estimate, the priority, one button. The exit of the base is already open; the button stamps the form and re-accepts the plan
 * at the chosen priority (main.ts), travel and extras re-lay the base. The form scrolls in its own area, so it fits a page 390 px high.
 */
export function createTicket(root: HTMLElement, handlers: TicketHandlers): TicketScreen {
  let sheet: Sheet | null = null;
  let busy = false;
  let chosen: PriorityId = DEFAULT_PRIORITY;

  function priorityBlock(ctx: TicketContext, redraw: () => void): HTMLElement {
    const box = h('div', 'tk-priority');
    box.append(h('p', 'tk-label', t('screens.ticket.priority')));
    const rowEl = h('div', 'tk-prio-row');
    for (const id of PRIORITY_IDS) {
      const open = priorityUnlocked(id, ctx.level);
      const b = h('button', `tk-prio${id === chosen ? ' on' : ''}`, t(PRIORITIES[id].nameKey));
      b.type = 'button';
      b.dataset.priority = id;
      b.disabled = !open;
      b.setAttribute('aria-pressed', String(id === chosen));
      if (!open) b.append(h('span', 'tk-prio-need', t('screens.ticket.priorityLocked', { level: PRIORITIES[id].unlockLevel })));
      b.addEventListener('click', () => {
        if (busy || !open) return;
        chosen = id;
        redraw();
      });
      rowEl.append(b);
    }
    box.append(rowEl, h('p', 'tk-prio-note', `${t('screens.ticket.prioritySet', { name: t(PRIORITIES[chosen].nameKey) })} ${t(PRIORITIES[chosen].hintKey)}`));
    return box;
  }

  function travelBlock(ctx: TicketContext, handlers: TicketHandlers): HTMLElement | null {
    if (!ctx.view.caseClosed) return null;
    const box = h('div', 'tk-travel');
    box.append(h('h3', '', t('screens.ticket.travelTitle')), h('p', 'lead', t('screens.ticket.travelLead')));
    for (const i of ctx.view.closed) {
      const r = h('div', 'tk-travel-row');
      r.dataset.planet = String(i);
      const go = h('button', '', t('screens.ticket.travelGo'));
      go.type = 'button';
      go.addEventListener('click', () => {
        if (!busy) handlers.onTravel?.(i, chosen);
      });
      r.append(h('span', '', t(planetDef(i).nameKey)), go);
      box.append(r);
    }
    const extra = h('div', 'tk-travel-row extra');
    const eb = h('button', '', t('screens.ticket.extra'));
    eb.type = 'button';
    eb.addEventListener('click', () => {
      if (!busy) handlers.onExtra?.(chosen);
    });
    extra.append(h('span', '', t('screens.ticket.extraNote')), eb);
    box.append(extra);
    return box;
  }

  function render(info: TicketInfo, ctx: TicketContext): void {
    if (!sheet) return;
    const body = h('div', 'ticket');
    const stampSvg = el('svg', { class: 'ticket-stamp', viewBox: '0 0 320 90', 'aria-hidden': 'true' });
    const stampLayer = el('g', {});
    stampSvg.append(stampLayer);
    const accept = h('button', 'start', t('screens.base.ticketApply'));
    accept.type = 'button';
    accept.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      stamp(t('screens.ticket.stamp'), 160, 45, { parent: stampLayer, ttl: Infinity, rotation: -6, fontSize: 12 });
      tween(1, () => undefined, {
        delay: 700,
        done: () => {
          busy = false;
          handlers.onAccept(chosen);
        },
      });
    });
    const art = el('svg', { class: 'ticket-art', viewBox: '-100 -65 200 130', filter: 'url(#wobble-cover)', 'aria-hidden': 'true' });
    art.append(drawPlanet(info.planet));
    const form = h('div', 'tform');
    form.append(
      row(t('screens.ticket.planet'), info.planet),
      row(t('screens.ticket.act'), ctx.view.finale ? t('screens.ticket.finale') : t('screens.ticket.actValue', { act: ACT_ROMAN[actOf(ctx.view.planetIndex) - 1] ?? 'I' })),
      row(t('screens.ticket.clause'), t(`laws.${info.lawId}.name`)),
      h('blockquote', 'clause', t(`laws.${info.lawId}.text`)),
      row(t('screens.ticket.family'), t(`screens.family.${info.family}`)),
      row(t('screens.ticket.pages'), t('screens.ticket.pagesValue', { count: info.pageCount })),
    );
    form.append(priorityBlock(ctx, () => render(info, ctx)));
    const travel = travelBlock(ctx, handlers);
    if (travel) form.append(travel);
    const actions = h('div', 'tk-actions');
    actions.append(accept, stampSvg);
    const side = h('div', 'tk-side');
    side.append(art, h('p', 'eta', t('screens.ticket.eta')));
    body.append(form, side, actions);
    const keep = sheet.scroll.scrollTop;
    sheet.scroll.replaceChildren(body);
    sheet.scroll.scrollTop = keep;
    body.classList.add('redraw');
  }

  return {
    open(info, ctx) {
      sheet?.remove();
      busy = false;
      chosen = clampPriority(chosen, ctx.level);
      sheet = createSheet(root, {
        title: `${t('screens.ticket.title')} ${t('screens.ticket.number', { number: info.number })}`,
        sub: t('ui.title.agency'),
        onClose: () => {
          if (!busy) handlers.onClose();
        },
      });
      sheet.el.classList.add('ticket-sheet');
      render(info, ctx);
    },
    close() {
      sheet?.remove();
      sheet = null;
      busy = false;
    },
    priority: () => chosen,
    isOpen: () => sheet !== null,
  };
}
