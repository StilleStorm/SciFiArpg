import { createRng } from '../core/rng';
import type { Bus, Side } from '../core/events';
import { t } from '../i18n';
import { PAGE_H, PAGE_INSET, PAGE_W } from '../world/pages';
import { bindAttackFx } from './attackFx';
import { blot, marginNote, stamp, strike } from './ink';
import type { Views } from './view';

const jitter = createRng(0xb107);

/** The size of the sheet the player walks on: a run page is 1200 x 1600, the base page of a planet is smaller. */
export interface PageBox {
  w: number;
  h: number;
  inset: number;
}

const RUN_PAGE: PageBox = { w: PAGE_W, h: PAGE_H, inset: PAGE_INSET };

/** Where the "margines" note goes for each wall of `page`: just inside the frame, beside the player. */
export function marginSpot(side: Side, x: number, y: number, page: PageBox = RUN_PAGE): { x: number; y: number } {
  switch (side) {
    case 'l':
      return { x: page.inset + 44, y: y - 30 };
    case 'r':
      return { x: page.w - page.inset - 44, y: y - 30 };
    case 't':
      return { x, y: page.inset + 48 };
    case 'b':
      return { x, y: page.h - page.inset - 38 };
  }
}

/** Bus events -> ink on the page. The only place gameplay events become pictures. `page` is the sheet shown now (the run's page or the base page). */
export function bindFx(bus: Bus, views: Views, page: () => PageBox | null = () => null): void {
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
    const m = marginSpot(e.side, e.x, e.y, page() ?? RUN_PAGE);
    marginNote(t('ui.ink.margin'), m.x, m.y, -4);
  });
  bus.on('stamp', (e) => stamp(e.text, e.x, e.y));
  bus.on('margin:note', (e) => marginNote(e.text, e.x, e.y, jitter.range(-5, 3), e.ttl));
}
