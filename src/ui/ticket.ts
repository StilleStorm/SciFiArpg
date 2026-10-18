import { t } from '../i18n';
import { stamp } from '../render/ink';
import { drawPlanet } from '../render/planet';
import { el } from '../render/svg';
import { tween } from '../render/tween';
import type { TicketInfo } from '../world/ticket';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';
import './base.css';

export interface TicketHandlers {
  /** "Akceptuję regulamin", after the stamp has landed. */
  onAccept(): void;
  /** "Zamknij": back to the base page without a ticket. */
  onClose(): void;
}

export interface TicketScreen {
  open(info: TicketInfo): void;
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
 * estimate, one button. Declining shows the same form again with a note. Accepting stamps the form and opens the exit of
 * the base page (main.ts). The form scrolls in its own area, so it fits a page 390 px high.
 */
export function createTicket(root: HTMLElement, handlers: TicketHandlers): TicketScreen {
  let sheet: Sheet | null = null;
  let busy = false;

  function render(info: TicketInfo, declined: boolean): void {
    if (!sheet) return;
    const body = h('div', 'ticket');
    const stampSvg = el('svg', { class: 'ticket-stamp', viewBox: '0 0 320 90', 'aria-hidden': 'true' });
    const stampLayer = el('g', {});
    stampSvg.append(stampLayer);
    const accept = h('button', 'start', t('screens.ticket.accept'));
    accept.type = 'button';
    accept.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      stamp(t('screens.ticket.stamp'), 160, 45, { parent: stampLayer, ttl: Infinity, rotation: -6, fontSize: 12 });
      tween(1, () => undefined, {
        delay: 700,
        done: () => {
          busy = false;
          handlers.onAccept();
        },
      });
    });
    const decline = h('button', 'link-btn', t('screens.ticket.decline'));
    decline.type = 'button';
    decline.addEventListener('click', () => {
      if (busy) return;
      render(info, true);
    });
    const art = el('svg', { class: 'ticket-art', viewBox: '-100 -65 200 130', filter: 'url(#wobble-cover)', 'aria-hidden': 'true' });
    art.append(drawPlanet(info.planet));
    const form = h('div', 'tform');
    form.append(
      row(t('screens.ticket.planet'), info.planet),
      row(t('screens.ticket.clause'), t(`laws.${info.lawId}.name`)),
      h('blockquote', 'clause', t(`laws.${info.lawId}.text`)),
      row(t('screens.ticket.family'), t(`screens.family.${info.family}`)),
      row(t('screens.ticket.pages'), t('screens.ticket.pagesValue', { count: info.pageCount })),
    );
    const actions = h('div', 'tk-actions');
    actions.append(accept, decline, stampSvg);
    const side = h('div', 'tk-side');
    side.append(art, h('p', 'eta', t('screens.ticket.eta')), declined ? h('p', 'declined', t('screens.ticket.declined')) : h('p', 'declined empty', ''));
    body.append(form, side, actions);
    sheet.scroll.replaceChildren(body);
    body.classList.add('redraw');
  }

  return {
    open(info) {
      sheet?.remove();
      busy = false;
      sheet = createSheet(root, {
        title: `${t('screens.ticket.title')} ${t('screens.ticket.number', { number: info.number })}`,
        sub: t('ui.title.agency'),
        onClose: () => {
          if (!busy) handlers.onClose();
        },
      });
      sheet.el.classList.add('ticket-sheet');
      render(info, false);
    },
    close() {
      sheet?.remove();
      sheet = null;
      busy = false;
    },
    isOpen: () => sheet !== null,
  };
}
