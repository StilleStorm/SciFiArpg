import { t } from '../i18n';
import { stamp } from '../render/ink';
import { drawPlanet } from '../render/planet';
import { el } from '../render/svg';
import { tween } from '../render/tween';
import type { TicketInfo } from '../world/ticket';
import { h } from './dom';

export interface TicketScreen {
  el: HTMLElement;
  show(info: TicketInfo): void;
  hide(): void;
}

function row(label: string, value: string, extra = ''): HTMLElement {
  const r = h('div', `trow ${extra}`.trim());
  const v = h('span', 'tval', value);
  r.append(h('label', '', label), v);
  return r;
}

/**
 * The run start: the ticket header. Number, planet, the regulamin clause, the dominant family, an
 * estimate, one button. Declining shows the same form again with a note.
 */
export function createTicket(root: HTMLElement, onAccept: () => void): TicketScreen {
  const screen = h('div', 'screen paper hidden');
  const frame = h('div', 'frame ticket');
  const stampSvg = el('svg', { class: 'ticket-stamp', viewBox: '0 0 320 90', 'aria-hidden': 'true' });
  const stampLayer = el('g', {});
  stampSvg.append(stampLayer);
  screen.append(frame);
  root.append(screen);
  let busy = false;

  function render(info: TicketInfo, declined: boolean): void {
    frame.replaceChildren();
    stampLayer.replaceChildren();
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
          onAccept();
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
    frame.append(
      h('div', 'agency', t('ui.title.agency')),
      h('h2', 'form-title tight', `${t('screens.ticket.title')} ${t('screens.ticket.number', { number: info.number })}`),
      h('hr', 'rule'),
      form,
      art,
      h('p', 'eta', t('screens.ticket.eta')),
      declined ? h('p', 'declined', t('screens.ticket.declined')) : h('p', 'declined empty', ''),
      stampSvg,
      accept,
      decline,
    );
    frame.classList.remove('redraw');
    void frame.offsetWidth;
    frame.classList.add('redraw');
  }

  return {
    el: screen,
    show(info) {
      busy = false;
      screen.classList.remove('hidden');
      render(info, false);
    },
    hide() {
      screen.classList.add('hidden');
    },
  };
}
