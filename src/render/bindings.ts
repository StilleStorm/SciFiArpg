import { createRng } from '../core/rng';
import type { Bus, Side } from '../core/events';
import { t } from '../i18n';
import { PAGE_H, PAGE_INSET, PAGE_W } from '../world/pages';
import { bindAttackFx } from './attackFx';
import { bindDamageNumbers } from './damageNumbers';
import { blot, marginNote, stamp, stampSize, strike } from './ink';
import { avoidBoxes } from './keepOut';
import type { Views } from './view';

const jitter = createRng(0xb107);

/** The size of the sheet the player walks on: a run page is 1200 x 1600, the base page of a planet is smaller. */
export interface PageBox {
  w: number;
  h: number;
  inset: number;
}

const RUN_PAGE: PageBox = { w: PAGE_W, h: PAGE_H, inset: PAGE_INSET };

/** How far the "margines" note keeps from the hero touching the wall (units): above his head, or to his side. */
const MARGIN_ABOVE = 66;
const MARGIN_ASIDE = 72;

/** Where the "margines" note goes for each wall of `page`: just inside the frame, beside the player. */
export function marginSpot(side: Side, x: number, y: number, page: PageBox = RUN_PAGE): { x: number; y: number } {
  // Beside the hero, never on him: above his head at a side wall, to one side of him at the top or bottom wall.
  const aside = x + MARGIN_ASIDE <= page.w - page.inset - 40 ? x + MARGIN_ASIDE : x - MARGIN_ASIDE;
  switch (side) {
    case 'l':
      return { x: page.inset + 44, y: y - MARGIN_ABOVE };
    case 'r':
      return { x: page.w - page.inset - 44, y: y - MARGIN_ABOVE };
    case 't':
      return { x: aside, y: page.inset + 30 };
    case 'b':
      return { x: aside, y: page.h - page.inset - 20 };
  }
}
type Rect = { x0: number; y0: number; x1: number; y1: number };
/** A stamp closer than this (vertically, units) to the point it must stay off covers the hero's figure. */
const STAMP_CLEAR = 80;

/** Room kept around a stamp for its slight rotation, units. */
const STAMP_MX = 10;
const STAMP_MY = 12;

/**
 * Where a stamp of w x h asked for at (x, y) lands: inside `view` (with a margin for the slight rotation), off every one of
 * `blocks` (the pads and margin notes, world units, `keepOutBlocks`), and when `away` is given, at least STAMP_CLEAR above
 * or below it (the other side of the hero when the edge of the view pushed it back on him). Pure.
 */
export function placeStamp(
  x: number,
  y: number,
  w: number,
  h: number,
  view: Rect | null,
  away?: { x: number; y: number },
  blocks: readonly Rect[] = [],
): { x: number; y: number } {
  if (!view) return { x, y };
  const free = { x0: view.x0 + STAMP_MX, y0: view.y0 + STAMP_MY, x1: view.x1 - STAMP_MX, y1: view.y1 - STAMP_MY };
  const put = (cx: number, cy: number): { x: number; y: number } => {
    const [dx, dy] = avoidBoxes({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 }, free, blocks);
    return { x: cx + dx, y: cy + dy };
  };
  if (!away) return put(x, y);
  let best = put(x, y);
  for (const at of [best, put(x, away.y - 130), put(x, away.y + 130)]) {
    if (Math.abs(at.y - away.y) >= STAMP_CLEAR) return at;
    if (Math.abs(at.y - away.y) > Math.abs(best.y - away.y)) best = at;
  }
  return best;
}

/** Bus events -> ink on the page. The only place gameplay events become pictures. `page` is the sheet shown now (the run's page or the base page). */
export function bindFx(
  bus: Bus,
  views: Views,
  page: () => PageBox | null = () => null,
  view: () => Rect | null = () => null,
  damageNumbers: () => boolean = () => false,
  blocks: () => readonly Rect[] = () => [],
): void {
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
    if (!g) return;
    // the struck do not speak: a detached figure is no longer patched, so its bubbles (claim, Spór comment) would linger over the stamp
    for (const b of g.querySelectorAll('.bubble')) b.classList.add('bubble-off');
    strike(g);
  });
  bus.on('page:edge', (e) => {
    const m = marginSpot(e.side, e.x, e.y, page() ?? RUN_PAGE);
    marginNote(t('ui.ink.margin'), m.x, m.y, -4);
  });
  bus.on('stamp', (e) => {
    // a long text (REKLAMACJA PRZYJETA, S19) would run off a phone's width at 17: the type is cut down until the stamp fits the view
    const v = view();
    let size = 17;
    if (v) while (size > 11 && stampSize(e.text, size).w > v.x1 - v.x0 - 2 * STAMP_MX - 16) size--;
    const { w, h } = stampSize(e.text, size);
    const at = placeStamp(e.x, e.y, w, h, v, e.away, blocks());
    stamp(e.text, at.x, at.y, size < 17 ? { fontSize: size } : {});
  });
  bus.on('margin:note', (e) => marginNote(e.text, e.x, e.y, jitter.range(-5, 3), e.ttl));
}
