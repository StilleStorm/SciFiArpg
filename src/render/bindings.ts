import { createRng } from '../core/rng';
import type { Bus, Side } from '../core/events';
import { t } from '../i18n';
import { PAGE_H, PAGE_INSET, PAGE_W } from '../world/pages';
import { bindAttackFx } from './attackFx';
import { bindDamageNumbers } from './damageNumbers';
import { blot, marginNote, stamp, stampSize, strike } from './ink';
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

type Rect = { x0: number; y0: number; x1: number; y1: number };
/** A stamp closer than this (vertically, units) to the point it must stay off covers the hero's figure. */
const STAMP_CLEAR = 80;

/**
 * Where a stamp of w x h asked for at (x, y) lands: inside `view` (with a margin for the slight rotation), and when `away`
 * is given, at least STAMP_CLEAR above or below it (the other side of the hero when the edge of the view pushed it back on him). Pure.
 */
export function placeStamp(x: number, y: number, w: number, h: number, view: Rect | null, away?: { x: number; y: number }): { x: number; y: number } {
  if (!view) return { x, y };
  const fit = (v: number, lo: number, hi: number): number => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  const cx = fit(x, view.x0 + w / 2 + 10, view.x1 - w / 2 - 10);
  const cy = (v: number): number => fit(v, view.y0 + h / 2 + 12, view.y1 - h / 2 - 12);
  if (!away) return { x: cx, y: cy(y) };
  let best = cy(y);
  for (const v of [best, cy(away.y - 130), cy(away.y + 130)]) {
    if (Math.abs(v - away.y) >= STAMP_CLEAR) return { x: cx, y: v };
    if (Math.abs(v - away.y) > Math.abs(best - away.y)) best = v;
  }
  return { x: cx, y: best };
}

/** Bus events -> ink on the page. The only place gameplay events become pictures. `page` is the sheet shown now (the run's page or the base page). */
export function bindFx(bus: Bus, views: Views, page: () => PageBox | null = () => null, view: () => Rect | null = () => null, damageNumbers: () => boolean = () => false): void {
  const hitBlot = (x: number, y: number, crit: boolean): void => {
    blot(x + jitter.range(-6, 6), y + jitter.range(-6, 6), crit ? jitter.range(9, 12) : jitter.range(3.5, 6), crit);
  };
  bindAttackFx(bus, views);
  bindDamageNumbers(bus, damageNumbers, () => {
    const v = view();
    return v ? (v.x0 + v.x1) / 2 : null;
  });
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
  bus.on('stamp', (e) => {
    const { w, h } = stampSize(e.text);
    const at = placeStamp(e.x, e.y, w, h, view(), e.away);
    stamp(e.text, at.x, at.y);
  });
  bus.on('margin:note', (e) => marginNote(e.text, e.x, e.y, jitter.range(-5, 3), e.ttl));
}
