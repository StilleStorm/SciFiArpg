/** Sketches for skills (swirl, cone, ring, line, blink) drawn in the fx layer, and the zone builder. */
import { createRng } from '../core/rng';
import type { Bus } from '../core/events';
import type { Zone } from '../entities/types';
import { drawIn, eraseOut } from './ink';
import { blobPoints, el, n2, smoothClosed, wobblyLine } from './svg';
import type { Builder } from './view';

const pen = createRng(0x5c11);

function sketch(layer: SVGGElement, d: string, opts: { dash?: string; ms?: number; hold?: number } = {}): void {
  const g = el('g', {});
  const path = el('path', { d });
  if (opts.dash) path.setAttribute('stroke-dasharray', opts.dash);
  g.append(path);
  layer.append(g);
  drawIn(g, opts.ms ?? 180);
  eraseOut(g, 420, (opts.ms ?? 180) + (opts.hold ?? 260), () => g.remove());
}

function spiral(x: number, y: number, r: number): string {
  let d = '';
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 4;
    const rr = r * (0.15 + 0.85 * (i / steps));
    d += `${i === 0 ? 'M' : 'L'}${n2(x + Math.cos(a) * rr)} ${n2(y + Math.sin(a) * rr)}`;
  }
  return d;
}

function circleAround(x: number, y: number, r: number): string {
  return smoothClosed(blobPoints(pen, x, y, r, 14, 0.04));
}

function cone(x: number, y: number, x2: number, y2: number, r: number): string {
  const base = Math.atan2(y2 - y, x2 - x);
  const half = (40 * Math.PI) / 180;
  const p1 = { x: x + Math.cos(base - half) * r, y: y + Math.sin(base - half) * r };
  const p2 = { x: x + Math.cos(base + half) * r, y: y + Math.sin(base + half) * r };
  return `M${n2(x)} ${n2(y)}L${n2(p1.x)} ${n2(p1.y)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(p2.x)} ${n2(p2.y)}Z`;
}

/** Listen for skill:fx and draw. */
export function bindHeroFx(bus: Bus, layer: SVGGElement): void {
  bus.on('skill:fx', (e) => {
    switch (e.kind) {
      case 'swirl':
        sketch(layer, spiral(e.x, e.y, e.r), { ms: 200 });
        sketch(layer, circleAround(e.x, e.y, e.r), { dash: '4 5', ms: 220 });
        break;
      case 'foam': {
        let d = '';
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const rr = pen.range(2.5, 5);
          const cx = e.x + Math.cos(a) * e.r;
          const cy = e.y - 4 + Math.sin(a) * e.r;
          d += `M${n2(cx - rr)} ${n2(cy)}a${n2(rr)} ${n2(rr)} 0 1 0 ${n2(2 * rr)} 0a${n2(rr)} ${n2(rr)} 0 1 0 ${n2(-2 * rr)} 0`;
        }
        sketch(layer, d, { ms: 220, hold: 160 });
        break;
      }
      case 'cone':
        sketch(layer, cone(e.x, e.y, e.x2, e.y2, e.r), { ms: 200 });
        break;
      case 'ring':
        sketch(layer, circleAround(e.x, e.y, e.r), { dash: '5 4', ms: 220 });
        break;
      case 'line':
        sketch(layer, wobblyLine(pen, e.x, e.y, e.x2, e.y2, 8, 1.2), { dash: '10 5', ms: 140, hold: 160 });
        break;
      case 'blink':
        sketch(layer, `${wobblyLine(pen, e.x, e.y, e.x2, e.y2, 6, 1)}M${n2(e.x - 4)} ${n2(e.y - 4)}l8 8M${n2(e.x + 4)} ${n2(e.y - 4)}l-8 8`, { dash: '2 4', ms: 160 });
        break;
      case 'dash':
        sketch(layer, wobblyLine(pen, e.x, e.y, e.x2, e.y2, 6, 1.4), { ms: 120, hold: 120 });
        break;
    }
  });
}

// ---------- zones ----------

const HOURGLASS = 'M-6-9H6M-6 9H6M-5-9C-5-2-1-1 0 0C-1 1-5 2-5 9M5-9C5-2 1-1 0 0C1 1 5 2 5 9M-2.5 8H2.5M0 1V6';

export const zoneBuilder: Builder<Zone> = {
  create(z) {
    const g = el('g', { class: `zone zone-${z.variant}` });
    if (z.variant === 'hourglass') {
      g.append(el('path', { d: HOURGLASS }));
      return g;
    }
    const rng = createRng(z.id * 7919);
    const outline = smoothClosed(blobPoints(rng, 0, 0, z.r, 16, 0.05));
    g.append(
      el('path', { d: outline, fill: 'url(#hatch-wide)', stroke: 'none' }),
      el('path', { d: outline, 'stroke-dasharray': '7 6' }),
      el('path', { d: `M-5-4Q-5-9 0-9Q5-9 5-4Q5-1 0 1V3M0 7h.01` }),
    );
    return g;
  },
  drawInMs: 300,
};
