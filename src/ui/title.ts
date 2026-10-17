import { createEnemy } from '../entities/factory';
import { t } from '../i18n';
import { drawIn, stamp } from '../render/ink';
import { buildEnemy } from '../render/figures';
import { el } from '../render/svg';
import { tween } from '../render/tween';
import { h } from './dom';

export interface Title {
  el: HTMLElement;
  show(): void;
  hide(): void;
}

/** The ticket cover: agency, ticket number, a drawn device, a stamp and a typed link. */
export function createTitle(root: HTMLElement, onStart: () => void): Title {
  const screen = h('div', 'screen paper');
  const frame = h('div', 'frame');
  const art = el('svg', { class: 'cover-art', viewBox: '-40 -46 80 66', filter: 'url(#wobble-cover)', 'aria-hidden': 'true' });
  const stampSvg = el('svg', { class: 'cover-stamp', viewBox: '0 0 320 90', 'aria-hidden': 'true' });
  const stampLayer = el('g', {});
  stampSvg.append(stampLayer);
  const start = h('button', 'start', t('ui.title.start'));
  start.type = 'button';
  start.addEventListener('click', onStart);
  frame.append(
    h('div', 'agency', t('ui.title.agency')),
    h('div', 'department', t('ui.title.department')),
    h('hr', 'rule'),
    h('h1', 'cover-title', t('ui.title.ticket')),
    h('p', 'cover-sub', t('ui.title.number')),
    h('p', 'cover-subject', t('ui.title.subject')),
    art,
    stampSvg,
    start,
    h('p', 'cover-footer', t('ui.title.footer')),
  );
  screen.append(frame);
  root.append(screen);

  let cancel: () => void = () => undefined;
  return {
    el: screen,
    show() {
      screen.classList.remove('hidden');
      cancel();
      art.replaceChildren();
      stampLayer.replaceChildren();
      const figure = buildEnemy(createEnemy(0, 0, 0, 1957));
      art.append(figure);
      drawIn(figure, 1100);
      cancel = tween(1, () => undefined, {
        delay: 1250,
        done: () => stamp(t('ui.title.stamp'), 160, 45, { parent: stampLayer, ttl: Infinity, rotation: -7, fontSize: 12 }),
      });
    },
    hide() {
      cancel();
      screen.classList.add('hidden');
    },
  };
}
