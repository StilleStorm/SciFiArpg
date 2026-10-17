import { createRng, type Rng } from '../core/rng';
import { type Vec } from '../core/vec';
import type { Obstacle, Page } from '../world/pages';
import { blobPoints, dotPath, el, n2, polyline, smoothClosed, wobblyCircle } from './svg';

const solid = (node: SVGElement, fill: string): void => {
  node.style.fill = fill;
  node.style.stroke = 'none';
};

function drawBlot(o: Obstacle, r: Rng): SVGGElement {
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)})` });
  let d = smoothClosed(blobPoints(r, 0, 0, o.size * 0.85, 11, 0.3));
  for (let i = 0; i < r.int(2, 4); i++) {
    const a = r.range(0, 6.28);
    d += dotPath(Math.cos(a) * o.size * r.range(1.05, 1.5), Math.sin(a) * o.size * r.range(1.05, 1.5), r.range(1.2, 3));
  }
  const p = el('path', { d });
  solid(p, 'var(--ink)');
  g.append(p);
  return g;
}

function drawRing(o: Obstacle, r: Rng): SVGGElement {
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)})` });
  const outer = el('path', { d: wobblyCircle(r, 0, 0, o.size, 14, 0.035) });
  const inner = el('path', { d: wobblyCircle(r, 0, 0, o.size * 0.88, 12, 0.04) });
  inner.setAttribute('stroke-width', '1');
  g.append(outer, inner);
  const dots = el('path', { d: dotPath(o.size * 0.7, o.size * 1.1, 2.2) + dotPath(-o.size * 0.4, o.size * 1.2, 1.4) });
  solid(dots, 'var(--ink)');
  g.append(dots);
  return g;
}

function drawNote(o: Obstacle, r: Rng): SVGGElement {
  const w = o.size;
  const h = o.size * 0.68;
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)}) rotate(${n2((o.rot * 180) / Math.PI)})` });
  const sheet = el('path', { d: polyline([{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }], true) });
  sheet.style.fill = 'var(--paper)';
  // hatched "thickness" along the lower and right edges instead of a shadow
  const edge = el('path', {
    d: polyline([{ x: w / 2, y: -h / 2 + 4 }, { x: w / 2 + 6, y: -h / 2 + 8 }, { x: w / 2 + 6, y: h / 2 + 5 }, { x: -w / 2 + 6, y: h / 2 + 5 }, { x: -w / 2, y: h / 2 }, { x: w / 2, y: h / 2 }], true),
    fill: 'url(#hatch)',
  });
  g.append(edge, sheet);
  for (let i = 0; i < 3; i++) {
    const y = -h / 2 + 14 + i * 11;
    const len = w * r.range(0.55, 0.8);
    g.append(el('path', { d: scribble(r, -w / 2 + 9, y, len), 'stroke-width': 0.9 }));
  }
  // staple
  g.append(el('path', { d: `M${n2(-w / 2 + 7)} ${n2(-h / 2 + 3)}l9 -1`, 'stroke-width': 2.2 }), el('path', { d: `M${n2(-w / 2 + 7)} ${n2(-h / 2 + 3)}l0 3M${n2(-w / 2 + 16)} ${n2(-h / 2 + 2)}l0 3`, 'stroke-width': 1 }));
  return g;
}

/** A line of fake handwriting. */
function scribble(r: Rng, x: number, y: number, len: number): string {
  const pts: Vec[] = [];
  for (let px = 0; px <= len; px += 4) pts.push({ x: x + px, y: y + (px % 8 === 0 ? -1.6 : 1.6) * r.range(0.5, 1.2) });
  return polyline(pts);
}

function drawTorn(o: Obstacle, r: Rng, page: Page): SVGGElement {
  const s = o.size;
  const g = el('g', {});
  const pts: Vec[] = [{ x: page.w - s, y: 0 }];
  const steps = 9;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    pts.push({ x: page.w - s + s * t + r.range(-5, 5), y: s * t + r.range(-5, 5) });
  }
  pts.push({ x: page.w, y: s });
  // the missing corner, then the same cut offset inward and hatched like a fibrous torn edge
  const hole = el('path', { d: polyline([...pts, { x: page.w + 4, y: -4 }, { x: page.w - s, y: -4 }], true) });
  solid(hole, 'var(--paper-edge)');
  const inner = pts.map((p) => ({ x: p.x - 9 + r.range(-2, 2), y: p.y - 9 + r.range(-2, 2) }));
  const fibre = el('path', { d: polyline([...pts, ...[...inner].reverse()], true), fill: 'url(#hatch)', stroke: 'none' });
  const cut = el('path', { d: polyline(pts) });
  g.append(hole, fibre, cut);
  return g;
}

/** Fill the #page layer: the margin, the frame, the hatched edge and every obstacle. */
export function drawPage(layer: SVGGElement, page: Page): void {
  layer.replaceChildren();
  const { w, h, inset } = page;
  const pad = 600;

  // beyond the paper: a darker surface, with the page cut out of it
  const beyond = el('path', {
    d: `M${-pad} ${-pad}H${w + pad}V${h + pad}H${-pad}ZM0 0V${h}H${w}V0Z`,
    'fill-rule': 'evenodd',
  });
  solid(beyond, 'var(--paper-edge)');
  // paper grain, in world space so it moves with the page
  const grain = el('rect', { x: 0, y: 0, width: w, height: h, fill: 'url(#paper)', stroke: 'none' });
  // hatched edge strip between the paper's edge and the inner frame
  const strip = el('path', {
    d: `M0 0H${w}V${h}H0ZM${inset - 5} ${inset - 5}V${h - inset + 5}H${w - inset + 5}V${inset - 5}Z`,
    'fill-rule': 'evenodd',
    fill: 'url(#hatch-wide)',
    stroke: 'none',
  });
  const frame = el('path', {
    d: `M${inset} ${inset}H${w - inset}V${h - inset}H${inset}Z`,
    'stroke-width': 1.3,
  });
  const frame2 = el('path', {
    d: `M${inset - 5} ${inset - 5}H${w - inset + 5}V${h - inset + 5}H${inset - 5}Z`,
    'stroke-width': 0.8,
  });
  layer.append(beyond, grain, strip, frame2, frame);

  for (const o of page.obstacles) {
    const r = createRng(o.seed);
    switch (o.kind) {
      case 'blot':
        layer.append(drawBlot(o, r));
        break;
      case 'ring':
        layer.append(drawRing(o, r));
        break;
      case 'note':
        layer.append(drawNote(o, r));
        break;
      case 'torn':
        layer.append(drawTorn(o, r, page));
        break;
    }
  }
}
