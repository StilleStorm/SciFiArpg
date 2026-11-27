/**
 * Floor marks of a location page (S28c): quiet strokes under the props, so a wide stretch of the page that holds no prop does not
 * read as unprinted paper. Render only: the marks come from the page's own index and location, never from the run's rng, so a
 * seed lays out the same page as before. The centrum has the hall's tile corners and two painted queue guides; the wyżyna has
 * wind dashes and a scatter of pebbles.
 */
import { createRng, type Rng } from '../../core/rng';
import type { Page } from '../../world/pages';
import { dotPath, el, n2, wobblyLine } from '../svg';

/** Tile corners: a small cross at every crossing of a grid, jittered a hair so the print is not ruled. */
function tileCorners(r: Rng, w: number, h: number, inset: number, step: number): string {
  let d = '';
  for (let y = inset + step; y < h - inset; y += step) {
    for (let x = inset + step; x < w - inset; x += step) {
      const jx = x + r.range(-1.5, 1.5);
      const jy = y + r.range(-1.5, 1.5);
      d += `M${n2(jx - 4)} ${n2(jy)}H${n2(jx + 4)}M${n2(jx)} ${n2(jy - 4)}V${n2(jy + 4)}`;
    }
  }
  return d;
}

/** A painted queue guide: a dashed run with an arrowhead at its end, along x or y. */
function guide(r: Rng, x0: number, y0: number, x1: number, y1: number): string {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  let d = '';
  for (let t = 0; t + 26 < len - 30; t += 44) d += wobblyLine(r, x0 + ux * t, y0 + uy * t, x0 + ux * (t + 26), y0 + uy * (t + 26), 2, 0.6);
  const hx = x1 - ux * 8;
  const hy = y1 - uy * 8;
  d += `M${n2(hx - uy * 9)} ${n2(hy + ux * 9)}L${n2(x1)} ${n2(y1)}L${n2(hx + uy * 9)} ${n2(hy - ux * 9)}`;
  return d;
}

function centrum(page: Page, r: Rng): string {
  const { w, h, inset } = page;
  let d = tileCorners(r, w, h, inset, 150);
  const gx = r.range(w * 0.3, w * 0.7);
  d += guide(r, gx, h - inset - 60, gx, h * 0.5);
  const gy = r.range(h * 0.3, h * 0.6);
  d += guide(r, inset + 60, gy, w * 0.45, gy);
  return d;
}

function wyzyna(page: Page, r: Rng): string {
  const { w, h, inset } = page;
  let d = '';
  for (let i = 0; i < 26; i++) {
    const x = r.range(inset + 40, w - inset - 90);
    const y = r.range(inset + 40, h - inset - 40);
    const len = r.range(26, 58);
    d += wobblyLine(r, x, y, x + len, y + r.range(-2, 2), 3, 0.7);
  }
  for (let i = 0; i < 50; i++) d += dotPath(r.range(inset + 30, w - inset - 30), r.range(inset + 30, h - inset - 30), r.range(0.8, 1.6));
  return d;
}

/** The floor of `page`'s location as one faint ink group, or null when its type has none. */
export function drawFloor(page: Page): SVGGElement | null {
  const make = page.location === 'centrum' ? centrum : page.location === 'wyzyna' ? wyzyna : null;
  if (!make) return null;
  const r = createRng(0xf100 + page.index * 131 + (page.location === 'centrum' ? 7 : 13)).fork('floor');
  const g = el('g', { class: 'floor-marks' });
  const path = el('path', { d: make(page, r), 'stroke-width': 0.8 });
  path.style.opacity = '0.5';
  g.append(path);
  return g;
}
