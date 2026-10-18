/**
 * The service tunnel on the page (DESIGN 4.1, 3.2): a hole cut in the paper, and the strip of tape that closes it.
 *
 * The hole is a ragged closed ink path (scissors, not a circle) with a flat darker paper shade inside, a few hatch
 * strokes, a thin inner edge for the thickness of the sheet and the handwritten note "c.d. na stronie __" beside it.
 * It lives in #page, so a page turn sweeps it away with the sheet. On `tunnel:closed` it is repaired: an opaque strip
 * of tape (two parallel ink lines, hatching between them, a slight turn) is drawn over the hole and the note is
 * struck through in red. Tape is not transparent. Nothing here owns game state: it only draws what the events report, and
 * remembers where it put tape on the page that is shown, so `restore` can draw it again when that page is rebuilt (the
 * return from the base draws the held run's page anew).
 */
import type { Bus, TunnelCloseReason } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import { t } from '../i18n';
import { repairedWithTape } from '../world/tunnel';
import { drawIn, eraseOut } from './ink';
import { el, n2, polyline } from './svg';
import { easeOut, tween } from './tween';

/** Half axes of the hole in world units (the player is drawn about 40 high; he walks in at ENTER_R = 28). */
export const HOLE_RX = 28;
export const HOLE_RY = 16;
const TAPE_W = 106;
const TAPE_H = 38;
const TAPE_TURN = -11;

interface Pt {
  x: number;
  y: number;
}

/** The ragged outline: straight cuts between 13 points around an ellipse, each pushed in or out a little. */
export function holeOutline(rng: Rng, scale = 1): Pt[] {
  const n = 13;
  const phase = rng.range(0, Math.PI * 2);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const k = rng.range(0.84, 1.12) * scale;
    pts.push({ x: Math.cos(a) * HOLE_RX * k, y: Math.sin(a) * HOLE_RY * k });
  }
  // keep the loop simple: sort by angle so the cuts never cross
  return pts.sort((p, q) => Math.atan2(p.y / HOLE_RY, p.x / HOLE_RX) - Math.atan2(q.y / HOLE_RY, q.x / HOLE_RX));
}

/** Parallel hatch strokes, clipped to an ellipse of half axes (a, b): a path of "M x y L x y" segments. */
export function hatchInside(a: number, b: number, gap: number, slope: number, keep: (x: number, y: number) => boolean = () => true): string {
  let d = '';
  for (let c = -b * 1.2; c <= b * 1.2; c += gap) {
    // the line y = slope * x + c, sampled where it is inside the ellipse
    let start: Pt | null = null;
    let end: Pt | null = null;
    for (let x = -a; x <= a; x += 0.5) {
      const y = slope * x + c;
      if ((x * x) / (a * a) + (y * y) / (b * b) < 1 && keep(x, y)) {
        start ??= { x, y };
        end = { x, y };
      }
    }
    if (start && end && Math.hypot(end.x - start.x, end.y - start.y) > 5) d += `M${n2(start.x)} ${n2(start.y)}L${n2(end.x)} ${n2(end.y)}`;
  }
  return d;
}

/** The strip of tape in its own space (centred on 0, 0): ragged ends, two parallel long edges. */
export function tapeOutline(rng: Rng): Pt[] {
  const pts: Pt[] = [];
  const w = TAPE_W / 2;
  const h = TAPE_H / 2;
  for (let x = -w + 4; x <= w - 4; x += 15) pts.push({ x, y: -h + rng.range(-0.7, 0.7) });
  for (let i = 0; i <= 4; i++) pts.push({ x: w + (i % 2 === 0 ? 0 : -4) + rng.range(-0.8, 0.8), y: -h + (i * TAPE_H) / 4 });
  for (let x = w - 4; x >= -w + 4; x -= 15) pts.push({ x, y: h + rng.range(-0.7, 0.7) });
  for (let i = 4; i >= 0; i--) pts.push({ x: -w + (i % 2 === 0 ? 0 : 4) + rng.range(-0.8, 0.8), y: -h + (i * TAPE_H) / 4 });
  return pts;
}

interface Drawn {
  x: number;
  y: number;
  /** The run page the hole is cut in (-1: the base page). */
  page: number;
  group: SVGGElement;
  note: SVGTextElement;
}

/** A repaired hole: where the tape lies, on which run page. */
export interface TapeMark {
  x: number;
  y: number;
  page: number;
}

/** The tapes that stay on page `index` once the run turns to it: only those of that page (a turned page is never seen again). */
export const tapesOnPage = (tapes: readonly TapeMark[], index: number): TapeMark[] => tapes.filter((m) => m.page === index);

export interface TunnelFxDeps {
  /** #page: the sheet the hole is cut in. */
  page: SVGGElement;
  /** Page width in world units, so the note is written on the side with room (the page of the run). */
  pageWidth(): number;
}

/**
 * The unbind function, plus `show`: draw the hole of a tunnel that is already open (the base end, the return into a held run)
 * without a cut, and `restore`: draw again, at once, the tape of every hole repaired earlier on run page `page` (call it after
 * the page is rebuilt). `tapes()` lists what is remembered.
 */
export type TunnelFxHandle = (() => void) & {
  show(x: number, y: number, animate?: boolean, page?: number): void;
  restore(page: number): void;
  tapes(): readonly TapeMark[];
};

/** Draw the hole on `tunnel:opened`, repair or rub it out on `tunnel:closed`. Returns the unbind function. */
export function bindTunnelFx(bus: Bus, deps: TunnelFxDeps): TunnelFxHandle {
  let open: Drawn | null = null;
  let tapes: TapeMark[] = [];

  const cutHole = (x: number, y: number, animate = true, page = -1): Drawn => {
    const seed = Math.floor(x * 31 + y * 17) >>> 0;
    const group = el('g', { class: 'tn-hole', transform: `translate(${n2(x)} ${n2(y)})` });
    const outline = holeOutline(createRng(seed));
    const shade = el('path', { d: polyline(outline, true), 'stroke-width': 1.9 });
    shade.style.fill = 'var(--hole)';
    // the thickness of the sheet at the near rim: the same cut again, three units lower, paper inside, under the shade
    const lip = el('path', { d: polyline(outline.map((p) => ({ x: p.x + 0.6, y: p.y + 3.2 })), true), 'stroke-width': 1.2 });
    lip.style.fill = 'var(--paper)';
    // the thickness of the sheet: the same cut again, a little smaller, along the upper left only
    const inner = holeOutline(createRng(seed), 0.86).filter((p) => p.x + p.y * 1.4 < 4);
    const edge = el('path', { d: polyline(inner), 'stroke-width': 0.9 });
    // hatching is the ink's way of shading: a loose set over the whole inside, a close one along the upper left rim
    const hatch = el('path', {
      d: hatchInside(HOLE_RX * 0.8, HOLE_RY * 0.78, 5.4, -0.55) + hatchInside(HOLE_RX * 0.84, HOLE_RY * 0.82, 2.8, -0.55, (px, py) => px * 0.5 + py < -2),
      'stroke-width': 0.8,
    });
    // where the scissors went in: three short ticks outside the edge
    let ticks = '';
    for (const a of [0.35, 2.4, 4.1]) {
      const r0 = 1.08;
      const r1 = 1.34;
      ticks += `M${n2(Math.cos(a) * HOLE_RX * r0)} ${n2(Math.sin(a) * HOLE_RY * r0)}L${n2(Math.cos(a) * HOLE_RX * r1)} ${n2(Math.sin(a) * HOLE_RY * r1)}`;
    }
    const cuts = el('path', { d: ticks, 'stroke-width': 1 });
    const right = x < deps.pageWidth() - 190;
    const note = el(
      'text',
      {
        class: 't-note',
        x: n2(right ? HOLE_RX + 6 : -HOLE_RX - 6),
        y: n2(-HOLE_RY - 6),
        'text-anchor': right ? 'start' : 'end',
        transform: `rotate(${right ? -7 : 7} ${n2(right ? HOLE_RX : -HOLE_RX)} ${n2(-HOLE_RY)})`,
      },
      [t('ui.tunnel.note')],
    );
    note.style.opacity = '0';
    note.style.fontSize = '13px';
    group.append(lip, shade, edge, hatch, cuts, note);
    deps.page.append(group);
    if (animate) {
      drawIn(group, 380);
      tween(260, (p) => (note.style.opacity = String(p)), { delay: 300 });
    } else {
      note.style.opacity = '1';
    }
    return { x, y, page, group, note };
  };

  /** A strip of tape across the hole and a red line through the note; `animate` false draws it as it lies (a rebuilt page). */
  const repair = (d: Drawn, animate = true): void => {
    const rng = createRng(Math.floor(d.x * 5 + d.y * 11) >>> 0);
    const tape = el('g', { class: 'tn-tape', transform: `translate(${n2(d.x + rng.range(-2, 2))} ${n2(d.y + rng.range(-1, 1))}) rotate(${n2(TAPE_TURN + rng.range(-3, 3))})` });
    const d0 = polyline(tapeOutline(rng), true);
    const body = el('path', { d: d0, 'stroke-width': 1.6 });
    body.style.fill = 'var(--paper)'; // tape is not transparent
    const hatching = el('path', { d: d0, fill: 'url(#hatch-wide)', stroke: 'none' });
    tape.append(body, hatching);
    deps.page.append(tape);
    if (animate) {
      tape.style.opacity = '0';
      tween(160, (p) => (tape.style.opacity = String(p)));
      drawIn(tape, 320);
    }

    // the note is struck through by the same hand: one red stroke across the text
    let w = 96;
    let h = 12;
    try {
      const bb = d.note.getBBox();
      w = bb.width;
      h = bb.height;
    } catch {
      /* not rendered: use the estimate */
    }
    const sx = Number(d.note.getAttribute('x')) || 0;
    const sy = Number(d.note.getAttribute('y')) || 0;
    const anchorEnd = d.note.getAttribute('text-anchor') === 'end';
    const x0 = anchorEnd ? sx - w - 2 : sx - 2;
    const line = el('path', { d: `M${n2(x0)} ${n2(sy - h * 0.28)}L${n2(x0 + w + 4)} ${n2(sy - h * 0.38)}`, 'stroke-width': 2 });
    line.style.stroke = 'var(--accent)';
    line.setAttribute('transform', d.note.getAttribute('transform') ?? '');
    d.group.append(line);
    if (!animate) return;
    const len = line.getTotalLength();
    line.style.strokeDasharray = String(len);
    line.style.strokeDashoffset = String(len);
    tween(160, (p) => (line.style.strokeDashoffset = String(len * (1 - p))), { ease: easeOut, delay: 220 });
  };

  const close = (reason: TunnelCloseReason): void => {
    const d = open;
    open = null;
    if (!d) return;
    if (repairedWithTape(reason)) {
      repair(d);
      if (d.page >= 0) tapes.push({ x: d.x, y: d.y, page: d.page });
    } else if (reason === 'page') d.group.remove(); // the sheet is being swept away with it
    else eraseOut(d.group, 300, 0, () => d.group.remove());
  };

  const offs = [
    bus.on('tunnel:opened', (e) => void (open = cutHole(e.x, e.y, true, e.pageIndex))),
    bus.on('tunnel:closed', (e) => close(e.reason)),
    // a new run draws a fresh page; whatever was cut in the old one is gone with it
    bus.on('run:started', () => {
      open = null;
      tapes = [];
    }),
    bus.on('page:entered', (e) => {
      tapes = tapesOnPage(tapes, e.index);
    }),
  ];
  const unbind = (): void => {
    for (const off of offs) off();
  };
  return Object.assign(unbind, {
    show(x: number, y: number, animate = false, page = -1): void {
      open = cutHole(x, y, animate, page);
    },
    restore(page: number): void {
      for (const m of tapesOnPage(tapes, page)) repair(cutHole(m.x, m.y, false, m.page), false);
    },
    tapes: () => tapes,
  });
}
