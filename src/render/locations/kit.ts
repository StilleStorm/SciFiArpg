/**
 * Small drawing kit for the location props (DESIGN 3.2): ink outlines with a hand's wobble, paper fill to hide what is behind,
 * hatching for shade. Every prop is designed on a 100-unit-wide sheet centred on its footprint and scaled to the obstacle's width;
 * stroke widths are given in world units and converted, so a small prop keeps a pen-width line.
 */
import type { Rng } from '../../core/rng';
import type { Obstacle } from '../../world/pages';
import { dotPath, el, n2, polyline, wobblyLine } from '../svg';

export type Fill = 'none' | 'paper' | 'hatch' | 'wide' | 'ink';
export type Pt = readonly [number, number];

export interface Kit {
  g: SVGGElement;
  /** World units per design unit. */
  u: number;
  /** A closed or open outline through the points, jittered by `jit` design units. */
  shape(pts: readonly Pt[], o?: { fill?: Fill; w?: number; closed?: boolean; jit?: number }): SVGPathElement;
  /** A straight stroke drawn by hand. */
  line(x1: number, y1: number, x2: number, y2: number, w?: number): SVGPathElement;
  /** Raw path data in design units. */
  path(d: string, o?: { fill?: Fill; w?: number }): SVGPathElement;
  disc(cx: number, cy: number, rad: number, o?: { fill?: Fill; w?: number }): SVGCircleElement;
  /** Solid ink dots [x, y, r]. */
  dots(list: readonly (readonly [number, number, number])[]): SVGPathElement;
  /** Digits or marks printed on the prop (never words). */
  mark(text: string, x: number, y: number, size: number): SVGTextElement;
}

const paint = (node: SVGElement, fill: Fill): void => {
  if (fill === 'paper') node.style.fill = 'var(--paper)';
  else if (fill === 'hatch') node.setAttribute('fill', 'url(#hatch)');
  else if (fill === 'wide') node.setAttribute('fill', 'url(#hatch-wide)');
  else if (fill === 'ink') {
    node.style.fill = 'var(--ink)';
    node.style.stroke = 'none';
  }
};

export function kit(o: Obstacle, r: Rng, base = 100): Kit {
  const u = o.size / base;
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)}) scale(${u.toFixed(4)})` });
  const sw = (w: number): number => Math.round((w / u) * 100) / 100;
  const api: Kit = {
    g,
    u,
    shape(pts, opts = {}) {
      const j = opts.jit ?? 0.8;
      const jittered = pts.map(([x, y]) => ({ x: x + r.range(-j, j), y: y + r.range(-j, j) }));
      const node = el('path', { d: polyline(jittered, opts.closed ?? true), 'stroke-width': sw(opts.w ?? 1.5) });
      paint(node, opts.fill ?? 'none');
      g.append(node);
      return node;
    },
    line(x1, y1, x2, y2, w = 1.5) {
      const node = el('path', { d: wobblyLine(r, x1, y1, x2, y2, Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 14)), 0.7), 'stroke-width': sw(w) });
      g.append(node);
      return node;
    },
    path(d, opts = {}) {
      const node = el('path', { d, 'stroke-width': sw(opts.w ?? 1.5) });
      paint(node, opts.fill ?? 'none');
      g.append(node);
      return node;
    },
    disc(cx, cy, rad, opts = {}) {
      const node = el('circle', { cx: n2(cx), cy: n2(cy), r: n2(rad), 'stroke-width': sw(opts.w ?? 1.5) });
      paint(node, opts.fill ?? 'none');
      g.append(node);
      return node;
    },
    dots(list) {
      const node = el('path', { d: list.map(([x, y, rad]) => dotPath(x, y, rad)).join('') });
      paint(node, 'ink');
      g.append(node);
      return node;
    },
    mark(text, x, y, size) {
      const node = el('text', { class: 't-plate', x: n2(x), y: n2(y), 'font-size': n2(size), 'text-anchor': 'middle' }, [text]);
      g.append(node);
      return node;
    },
  };
  return api;
}

/** A box seen from the front with a strip of tape down the middle (a parcel). */
export function parcel(k: Kit, x0: number, y0: number, x1: number, y1: number, fill: Fill = 'paper'): void {
  k.shape([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { fill, w: 1.3, jit: 0.5 });
  const mx = (x0 + x1) / 2;
  k.line(mx, y0, mx, y1, 0.9);
  k.line(x0, y0 + (y1 - y0) * 0.3, x1, y0 + (y1 - y0) * 0.3, 0.7);
}
