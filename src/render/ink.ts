/**
 * Ink primitives. Everything on the page is drawn, struck out, blotted or stamped.
 * Call initInk(fxLayer) once; call tickTweens(dtMs) every rendered frame (render/tween.ts).
 * No gradients, glow or shadows here, and none may be added.
 */
import { createRng } from '../core/rng';
import { must } from '../core/util';
import { t } from '../i18n';
import { blobPoints, dotPath, el, n2, smoothClosed, wobblyLine } from './svg';
import { easeIn, easeOut, tween } from './tween';

let fxLayer: SVGGElement | null = null;
const fx = (): SVGGElement => must(fxLayer, 'ink layer (call initInk first)');
const pen = createRng(0x51ce); // render-only randomness, never gameplay

export function initInk(layer: SVGGElement): void {
  fxLayer = layer;
  blotPool.length = 0;
  blotNext = 0;
}

// ---------- drawIn / eraseOut ----------

const GEOM = 'path,line,circle,ellipse,rect,polyline,polygon';

interface Part {
  node: SVGGeometryElement;
  len: number;
  stroked: boolean;
}

function collect(root: Element): Part[] {
  const out: Part[] = [];
  root.querySelectorAll<SVGGeometryElement>(GEOM).forEach((node) => {
    const cs = getComputedStyle(node);
    const stroked = cs.stroke !== 'none' && cs.strokeWidth !== '0px';
    const filled = cs.fill !== 'none';
    if (!stroked && !filled) return;
    let len = 0;
    if (stroked) {
      try {
        len = node.getTotalLength();
      } catch {
        len = 100;
      }
    }
    out.push({ node, len, stroked });
  });
  return out;
}

function dashAnim(parts: Part[], ms: number, reverse: boolean, delay: number, done?: () => void): void {
  const n = parts.length;
  if (n === 0) {
    done?.();
    return;
  }
  const dur = Math.max(1, ms * 0.45);
  parts.forEach((part, i) => {
    const start = n > 1 ? (i / (n - 1)) * ms * 0.55 : 0;
    const { node, len } = part;
    const set = (p: number): void => {
      const shown = reverse ? 1 - p : p;
      if (part.stroked) node.style.strokeDashoffset = String(len * (1 - shown));
      else node.style.visibility = shown > 0.6 ? 'visible' : 'hidden';
    };
    if (part.stroked) node.style.strokeDasharray = String(len);
    set(0);
    tween(dur, set, {
      delay: delay + start,
      ease: easeOut,
      done: () => {
        if (reverse) {
          node.style.visibility = 'hidden';
          if (i === n - 1) done?.();
        } else {
          node.style.strokeDasharray = '';
          node.style.strokeDashoffset = '';
          node.style.visibility = '';
        }
      },
    });
  });
  if (reverse) return;
  done && tween(1, () => undefined, { delay: delay + ms, done });
}

/** Draw all strokes of `g` in, one after another, over `ms` (200-400 recommended). */
export function drawIn(g: Element, ms: number): void {
  dashAnim(collect(g), ms, false, 0);
}

/** Reverse of drawIn: the strokes are rubbed out. Calls `done` when finished. */
export function eraseOut(g: Element, ms: number, delay = 0, done?: () => void): void {
  dashAnim(collect(g), ms, true, delay, done);
}

// ---------- strike ----------

function worldBox(g: SVGGElement): { x0: number; y0: number; x1: number; y1: number } {
  const bb = g.getBBox();
  const list = g.transform.baseVal;
  const m = list.numberOfItems > 0 ? list.consolidate()?.matrix : undefined;
  const corners: [number, number][] = [
    [bb.x, bb.y],
    [bb.x + bb.width, bb.y],
    [bb.x, bb.y + bb.height],
    [bb.x + bb.width, bb.y + bb.height],
  ];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [x, y] of corners) {
    xs.push(m ? m.a * x + m.c * y + m.e : x);
    ys.push(m ? m.b * x + m.d * y + m.f : y);
  }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function inkLine(d: string, cls: string): SVGPathElement {
  const p = el('path', { d, class: cls });
  p.style.stroke = 'var(--accent)';
  p.style.strokeWidth = '2.2';
  p.style.fill = 'none';
  return p;
}

/**
 * The editor's pen: two quick strokes across `g`, "skreslono" written beside it, then the
 * drawing is rubbed out and the marks fade. Removes `g` at the end. `g` must be out of the view map.
 */
export function strike(g: SVGGElement): void {
  const layer = fx();
  const { x0, y0, x1, y1 } = worldBox(g);
  const w = x1 - x0;
  const h = y1 - y0;
  const a = inkLine(wobblyLine(pen, x0 - 4, y0 + h * 0.12, x1 + 4, y1 - h * 0.18, 5, 1.6), 'strike');
  const b = inkLine(wobblyLine(pen, x1 + 4, y0 + h * 0.28, x0 - 4, y1 - h * 0.04, 5, 1.6), 'strike');
  const word = el('text', { class: 't-struck', x: n2(x1 - w * 0.2), y: n2(y0 - 3), transform: `rotate(-7 ${n2(x1)} ${n2(y0)})` }, [t('ui.ink.struck')]);
  word.style.opacity = '0';
  const group = el('g', {}, [a, b, word]);
  layer.append(group);
  const la = a.getTotalLength();
  const lb = b.getTotalLength();
  a.style.strokeDasharray = String(la);
  b.style.strokeDasharray = String(lb);
  a.style.strokeDashoffset = String(la);
  b.style.strokeDashoffset = String(lb);
  tween(90, (p) => (a.style.strokeDashoffset = String(la * (1 - p))), { ease: easeOut });
  tween(90, (p) => (b.style.strokeDashoffset = String(lb * (1 - p))), { ease: easeOut, delay: 90 });
  tween(120, (p) => (word.style.opacity = String(p)), { delay: 190 });
  eraseOut(g, 380, 650, () => g.remove());
  tween(
    420,
    (p) => (group.style.opacity = String(1 - p)),
    { delay: 800, done: () => group.remove() },
  );
}

// ---------- blot ----------

const BLOT_MAX = 20;
interface BlotSlot {
  node: SVGPathElement;
  cancel: () => void;
}
const blotPool: BlotSlot[] = [];
let blotNext = 0;

/** An ink blob at (x, y), `size` = radius in units. It darkens over 300 ms and stays. Pooled: max 20. */
export function blot(x: number, y: number, size: number, crit = false): void {
  let slot = blotPool[blotNext];
  if (!slot) {
    const node = el('path', {});
    node.style.stroke = 'none';
    slot = { node, cancel: () => undefined };
    blotPool.push(slot);
    fx().append(node);
  }
  blotNext = (blotNext + 1) % BLOT_MAX;
  slot.cancel();
  const { node } = slot;
  fx().append(node); // newest blot on top
  let d = smoothClosed(blobPoints(pen, 0, 0, size, 9, 0.32));
  if (crit) {
    const dots = pen.int(3, 5);
    for (let i = 0; i < dots; i++) {
      const a = pen.range(0, Math.PI * 2);
      const dist = size * pen.range(1.5, 2.4);
      d += dotPath(Math.cos(a) * dist, Math.sin(a) * dist, size * pen.range(0.12, 0.26));
    }
  }
  node.setAttribute('d', d);
  node.setAttribute('transform', `translate(${n2(x)} ${n2(y)})`);
  const paint = (p: number): void => {
    node.style.fill = `color-mix(in srgb, var(--ink) ${Math.round(45 + 55 * p)}%, var(--paper))`;
  };
  paint(0);
  slot.cancel = tween(300, paint);
}

// ---------- stamp ----------

export interface StampOptions {
  /** Where to put it; default is the fx layer. */
  parent?: SVGElement;
  /** ms before it fades away; Infinity keeps it. Default 2400. */
  ttl?: number;
  rotation?: number;
  fontSize?: number;
}

/** A red rubber stamp slammed onto (x, y): scale 1.4 -> 1 in 120 ms, rough coverage via a mask. */
export function stamp(text: string, x: number, y: number, opts: StampOptions = {}): SVGGElement {
  const parent = opts.parent ?? fx();
  const size = opts.fontSize ?? 17;
  const label = text.toLocaleUpperCase('pl');
  const w = label.length * (size * 1.06 + 2) + 30;
  const h = size + 24;
  const rot = opts.rotation ?? pen.range(-7, 7);
  const grain = pen.range(0, 360);
  const place = el('g', {});
  const masked = el('g', { transform: `rotate(${n2(grain)})` });
  const content = el('g', { transform: `rotate(${n2(-grain)})` });
  const frame = el('g', { class: 'stamp-frame' });
  for (const [inset, sw] of [[0, 2.6], [5, 1.1]] as const) {
    const r = el('rect', { x: n2(-w / 2 + inset), y: n2(-h / 2 + inset), width: n2(w - inset * 2), height: n2(h - inset * 2) });
    r.style.stroke = 'var(--accent)';
    r.style.strokeWidth = String(sw);
    r.style.fill = 'none';
    frame.append(r);
  }
  const label_ = el('text', { class: 't-stamp', x: 0, y: n2(size * 0.34), 'font-size': size, 'letter-spacing': 2 }, [label]);
  content.append(frame, label_);
  masked.append(content);
  masked.setAttribute('mask', 'url(#stamp-mask)');
  place.append(masked);
  parent.append(place);
  const set = (s: number): void => place.setAttribute('transform', `translate(${n2(x)} ${n2(y)}) rotate(${n2(rot)}) scale(${n2(s)})`);
  set(1.4);
  tween(120, (p) => set(1.4 - 0.4 * p), { ease: easeIn });
  const ttl = opts.ttl ?? 2400;
  if (Number.isFinite(ttl)) {
    tween(400, (p) => (place.style.opacity = String(1 - p)), { delay: 120 + ttl, done: () => place.remove() });
  }
  return place;
}

// ---------- small marks ----------

/** A short marginal note (italic) that fades. Used for "margines". */
export function marginNote(text: string, x: number, y: number, rotation = 0, ttl = 1600): void {
  const note = el('text', { class: 't-note', x: n2(x), y: n2(y), transform: `rotate(${n2(rotation)} ${n2(x)} ${n2(y)})`, 'text-anchor': 'middle' }, [text]);
  note.style.opacity = '0';
  fx().append(note);
  tween(180, (p) => (note.style.opacity = String(p)));
  tween(500, (p) => (note.style.opacity = String(1 - p)), { delay: 180 + ttl, done: () => note.remove() });
}

/** The small ink "x" left where the finger tapped. Drawn in, then rubbed out. */
export function tapMark(x: number, y: number): void {
  const g = el('g', { transform: `translate(${n2(x)} ${n2(y)}) rotate(${n2(pen.range(-12, 12))})` });
  g.append(el('path', { d: 'M-5.5-5.5L5.5 5.5' }), el('path', { d: 'M5.5-5.5L-5.5 5.5' }));
  fx().append(g);
  drawIn(g, 140);
  eraseOut(g, 380, 450, () => g.remove());
}
