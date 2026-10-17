import type { Bus } from '../core/events';
import { createRng } from '../core/rng';
import { t } from '../i18n';
import { el, wobblyCircle } from '../render/svg';
import { h } from './dom';

type PadId = 'skill1' | 'skill2' | 'skill3' | 'inventory';

/** Small ink drawings, one per pad (centered on 0,0 inside a 52 x 52 box). */
const DRAWINGS: Record<PadId, string> = {
  skill1: 'M0-15L0-5M-4-15Q0-18 4-15M-9-5H9V1H-9ZM-11 8H11', // rubber stamp
  skill2: 'M-8-13H3L8-8V13H-8ZM3-13V-8H8M-4-3H4M-4 2H4M-4 7H1', // sheet with a folded corner
  skill3: 'M0 13L-5-1L0-14L5-1ZM0-4V13', // pen nib
  inventory: 'M-5 11V-8A5 5 0 0 1 5-8V8A3 3 0 0 1-1 8V-4', // paper clip
};

const SLOT_CLASS: Record<PadId, string> = { skill1: 's1', skill2: 's2', skill3: 's3', inventory: 'inv' };
const EVENT: Record<PadId, 'skill:1' | 'skill:2' | 'skill:3' | 'inventory'> = {
  skill1: 'skill:1',
  skill2: 'skill:2',
  skill3: 'skill:3',
  inventory: 'inventory',
};

/** Three skill buttons and the inventory button: circled margin notes with a word label. */
export function createPads(root: HTMLElement, bus: Bus): HTMLElement {
  const wrap = h('div', 'pads');
  const rng = createRng(77);
  (Object.keys(DRAWINGS) as PadId[]).forEach((id) => {
    const word = t(`ui.pads.${id}`);
    const btn = h('button', `pad ${SLOT_CLASS[id]}`);
    btn.type = 'button';
    btn.setAttribute('aria-label', word);
    const svg = el('svg', { viewBox: '-26 -26 52 52' });
    svg.append(
      el('path', { d: wobblyCircle(rng, 0, 0, 23, 11, 0.03) }),
      el('path', { d: wobblyCircle(rng, 0.6, -0.4, 21.4, 9, 0.035), 'stroke-width': 0.9 }),
      el('path', { d: DRAWINGS[id] }),
    );
    btn.append(svg, h('span', 'word', word));
    btn.addEventListener('click', () => bus.emit(EVENT[id]));
    wrap.append(btn);
  });
  root.append(wrap);
  return wrap;
}
