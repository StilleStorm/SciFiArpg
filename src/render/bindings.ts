import { createRng } from '../core/rng';
import type { Bus, Side } from '../core/events';
import { t } from '../i18n';
import { PAGE_H, PAGE_INSET, PAGE_W } from '../world/pages';
import { bindAttackFx } from './attackFx';
import { blot, marginNote, stamp, strike } from './ink';
import type { Views } from './view';

const jitter = createRng(0xb107);

/** Where the "margines" note goes for each wall: just inside the frame, beside the player. */
function marginSpot(side: Side, x: number, y: number): { x: number; y: number } {
  switch (side) {
    case 'l':
      return { x: PAGE_INSET + 44, y: y - 30 };
    case 'r':
      return { x: PAGE_W - PAGE_INSET - 44, y: y - 30 };
    case 't':
      return { x, y: PAGE_INSET + 48 };
    case 'b':
      return { x, y: PAGE_H - PAGE_INSET - 38 };
  }
}

/** Bus events -> ink on the page. The only place gameplay events become pictures. */
export function bindFx(bus: Bus, views: Views): void {
  const hitBlot = (x: number, y: number, crit: boolean): void => {
    blot(x + jitter.range(-6, 6), y + jitter.range(-6, 6), crit ? jitter.range(9, 12) : jitter.range(3.5, 6), crit);
  };
  bindAttackFx(bus, views);
  bus.on('enemy:hit', (e) => hitBlot(e.x, e.y, e.crit));
  bus.on('player:hit', (e) => hitBlot(e.x, e.y, e.crit));
  bus.on('enemy:died', (e) => {
    const g = views.detach(e.id);
    if (g) strike(g);
  });
  bus.on('page:edge', (e) => {
    const m = marginSpot(e.side, e.x, e.y);
    marginNote(t('ui.ink.margin'), m.x, m.y, -4);
  });
  bus.on('stamp', (e) => stamp(e.text, e.x, e.y));
  bus.on('margin:note', (e) => marginNote(e.text, e.x, e.y, jitter.range(-5, 3), e.ttl));
}
