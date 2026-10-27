/**
 * The przystanek na żądanie (DESIGN 4.1 Przystanki, S21a): a timetable post in ink on the paper. A pole, a plate with the
 * two words, a timetable hung under it with its columns of times and two pen strokes through them (the timetable is
 * always struck out; the stop is not). Drawn in like any other spawn. A registered post carries a red pen ring round
 * its plate (red is the pen's: DESIGN 3.2). The stop board of the base (`drawStopBoard`) is the same post with three
 * arrow plates on it. No fills but paper and hatching, no gradient, no shadow.
 */
import type { Bus } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import { t } from '../i18n';
import type { Page, PageStop } from '../world/pages';
import type { RunState } from '../world/run';
import { drawIn } from './ink';
import { dotPath, el, n2, polyline, wobblyLine } from './svg';
import { washGroup } from './wash';

type Pt = [number, number];
const poly = (pts: readonly Pt[], close = false): string => polyline(pts.map(([x, y]) => ({ x, y })), close);
const paper = (node: SVGElement): void => {
  node.style.fill = 'var(--paper)';
};
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const stroke = (d: string, w = 1.6): SVGPathElement => el('path', { d, 'stroke-width': w });
const sheet = (pts: readonly Pt[], w = 1.7): SVGPathElement => {
  const p = el('path', { d: poly(pts, true), 'stroke-width': w });
  paper(p);
  return p;
};
const red = (node: SVGElement): SVGElement => {
  node.style.stroke = 'var(--accent)';
  return node;
};

/** The foot: a hatched ellipse of ground and two stones. */
function foot(r: Rng): SVGGElement {
  const g = el('g', {});
  const ground = el('path', { d: 'M-22 0A22 5 0 0 0 22 0A22 5 0 0 0 -22 0Z', 'stroke-width': 1.4, fill: 'url(#hatch)' });
  g.append(ground, stroke(wobblyLine(r, -9, -2, 9, -2, 3, 0.6), 1.2));
  return g;
}

/** A timetable of `rows` lines of times in two columns, struck through with two pen strokes. */
function timetable(r: Rng, x0: number, y0: number, w: number, h: number, rows: number): SVGGElement {
  const g = el('g', {});
  g.append(sheet(rect(x0, y0, x0 + w, y0 + h), 1.6), stroke(poly(rect(x0 + 2.5, y0 + 2.5, x0 + w - 2.5, y0 + h - 2.5), true), 0.7));
  const top = y0 + 8;
  const step = (h - 14) / Math.max(1, rows - 1);
  for (let i = 0; i < rows; i++) {
    const y = top + i * step;
    g.append(stroke(wobblyLine(r, x0 + 6, y, x0 + w * 0.42, y, 2, 0.5), 0.8), stroke(wobblyLine(r, x0 + w * 0.56, y, x0 + w - 6, y, 2, 0.5), 0.8));
  }
  g.append(stroke(wobblyLine(r, x0 - 3, y0 + h * 0.12, x0 + w + 3, y0 + h * 0.9, 4, 1.2), 1.8), stroke(wobblyLine(r, x0 + w + 3, y0 + h * 0.18, x0 - 3, y0 + h * 0.84, 4, 1.2), 1.8));
  return g;
}

/** The plate: two printed lines, "PRZYSTANEK" over "NA ŻĄDANIE". */
function plate(cx: number, cy: number): SVGGElement {
  const g = el('g', { transform: `translate(${n2(cx)} ${n2(cy)})` });
  g.append(sheet(rect(-30, -11, 30, 11), 1.9), stroke('M-27 -8H27', 0.6));
  g.append(el('text', { class: 't-plate', x: 0, y: -1.5, 'font-size': 7.4 }, [t('ui.stop.plate1')]), el('text', { class: 't-plate', x: 0, y: 7, 'font-size': 6.2 }, [t('ui.stop.plate2')]));
  return g;
}

/** A post standing on a run page: the foot at (0, 0), 96 units high. */
function postBody(r: Rng, registered: boolean): SVGGElement {
  const g = el('g', {});
  g.append(foot(r));
  g.append(stroke('M-2.6 0V-72M2.6 0V-72', 1.8), stroke('M-5 0h10', 1.2));
  g.append(timetable(r, -17, -66, 34, 40, 4));
  g.append(stroke('M-2.6 -72V-76M2.6 -72V-76', 1.6));
  g.append(plate(0, -87));
  if (registered) {
    // a pen ring round the plate, not quite closed: the end overshoots the start
    g.append(red(el('path', { d: `M${n2(-39 + r.range(-1, 1))} -84A41 18 -3 1 1 ${n2(-32 + r.range(-1, 1))} -78`, 'stroke-width': 1.7 })));
  }
  return g;
}

/** The stop of a page as a `<g data-stop>` (position and registered state from the page; nothing else). */
export function drawStopPost(stop: PageStop): SVGGElement {
  const r = createRng(stop.seed);
  const g = el('g', { transform: `translate(${n2(stop.x)} ${n2(stop.y)})`, 'data-stop': stop.registered ? 'registered' : 'open' });
  g.append(postBody(r, stop.registered));
  return g;
}

/** Make the stop of `page` again after it was registered (a drawn-in new strokes), or draw it if it is new. */
export function redrawStop(page: Page): void {
  if (typeof document === 'undefined' || !page.stop) return;
  const fresh = drawStopPost(page.stop);
  const old = document.querySelector('#page [data-stop]');
  if (old) old.replaceWith(fresh);
  else document.querySelector('#page [data-page-ink]')?.append(fresh);
  drawIn(fresh, 420);
}

/** Redraw the post of the page when it is registered (the red ring is drawn in). Returns the unbind function. */
export function bindStopFx(bus: Bus, getState: () => RunState | null): () => void {
  return bus.on('stop:registered', () => {
    const s = getState();
    if (s) redrawStop(s.page);
  });
}

/** The stop board of the base: a taller post, three arrow plates pointing three ways, the struck timetable under them, the plate above. */
export function drawStopBoard(r: Rng, seed: number): SVGGElement {
  const g = el('g', {});
  const w = washGroup(createRng(seed).fork('wash'), 'indigo', 46, { opacity: 0.24 });
  w.setAttribute('transform', 'translate(8 -34)');
  g.append(w);
  g.append(foot(r));
  g.append(stroke('M-2.8 0V-80M2.8 0V-80', 1.9), stroke('M-6 0h12', 1.3));
  // three arrow plates, alternately left and right, with a line of writing each
  const arrows: { y: number; dir: 1 | -1; len: number }[] = [
    { y: -66, dir: 1, len: 34 },
    { y: -50, dir: -1, len: 30 },
    { y: -34, dir: 1, len: 32 },
  ];
  for (const a of arrows) {
    const x0 = a.dir === 1 ? 3 : -3;
    const x1 = x0 + a.dir * a.len;
    const tip = x1 + a.dir * 7;
    g.append(sheet([[x0, a.y - 6], [x1, a.y - 6], [tip, a.y], [x1, a.y + 6], [x0, a.y + 6]], 1.5));
    g.append(stroke(wobblyLine(r, Math.min(x0, x1) + a.dir * 0 + 3, a.y, Math.max(x0, x1) - 3, a.y, 2, 0.5), 0.8));
  }
  g.append(timetable(r, -17, -26, 34, 30, 3));
  g.append(plate(0, -86));
  const bolt = el('path', { d: dotPath(0, -77, 1.3) });
  bolt.style.fill = 'var(--ink)';
  g.append(bolt);
  return g;
}
