import { createRng } from '../core/rng';
import { dotPath, el, n2, polyline, wobblyCircle, wobblyLine } from './svg';

/** Stable small hash of a string (planet names seed their drawings). */
export function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The planet of a ticket, drawn in ink: latitude bands, a hatched night side, craters and, now and then,
 * a ring. Fits a 200 x 130 box centered on 0,0. Same name, same planet.
 */
export function drawPlanet(name: string): SVGGElement {
  const r = createRng(hashText(name));
  const R = 38;
  const g = el('g', {});
  const tilt = r.range(-22, 12);
  const hasRing = r.chance(0.55);
  const ring = (front: boolean): SVGPathElement => {
    const rx = R * 1.75;
    const ry = R * 0.3;
    // the back half is the upper arc, the front half the lower arc
    const d = front ? `M${n2(-rx)} 0A${n2(rx)} ${n2(ry)} 0 0 0 ${n2(rx)} 0` : `M${n2(-rx)} 0A${n2(rx)} ${n2(ry)} 0 0 1 ${n2(rx)} 0`;
    return el('path', { d, transform: `rotate(${n2(tilt)})`, 'stroke-width': 1.6 });
  };
  if (hasRing) g.append(ring(false));
  const body = el('path', { d: wobblyCircle(r, 0, 0, R, 12, 0.02), 'stroke-width': 2 });
  body.style.fill = 'var(--paper)';
  g.append(body);
  // latitude bands, clipped by construction: each runs chord to chord
  const bands = r.int(2, 4);
  for (let i = 0; i < bands; i++) {
    const y = r.range(-R * 0.7, R * 0.7);
    const x = Math.sqrt(R * R - y * y) - 1.5;
    g.append(el('path', { d: wobblyLine(r, -x, y, x, y + r.range(-3, 3), 6, 1.4), 'stroke-width': 1 }));
  }
  // night side: a hatched crescent on the right
  const k = r.range(0.55, 0.8);
  const shade = el('path', {
    d: `M${n2(R * 0.35)} ${n2(-R * 0.94)}A${n2(R)} ${n2(R)} 0 0 1 ${n2(R * 0.35)} ${n2(R * 0.94)}A${n2(R * k)} ${n2(R)} 0 0 0 ${n2(R * 0.35)} ${n2(-R * 0.94)}Z`,
    fill: 'url(#hatch)',
    'stroke-width': 1,
  });
  g.append(shade);
  for (let i = 0; i < r.int(2, 4); i++) {
    const a = r.range(0, 6.28);
    const d = R * r.range(0.1, 0.62);
    g.append(el('path', { d: wobblyCircle(r, Math.cos(a) * d - 6, Math.sin(a) * d, r.range(2.5, 5.5), 7, 0.08), 'stroke-width': 1 }));
  }
  if (hasRing) g.append(ring(true));
  // a moon and a few stars
  const mx = r.range(60, 82) * (r.chance(0.5) ? 1 : -1);
  const my = r.range(-46, -26);
  g.append(el('path', { d: wobblyCircle(r, mx, my, r.range(5, 8), 8, 0.06), 'stroke-width': 1.3 }));
  for (let i = 0; i < 5; i++) {
    const sx = r.range(-95, 95);
    const sy = r.range(-58, 58);
    if (Math.hypot(sx, sy) < R * 1.9) continue;
    g.append(el('path', { d: `${polyline([{ x: sx - 2.5, y: sy }, { x: sx + 2.5, y: sy }])}${polyline([{ x: sx, y: sy - 2.5 }, { x: sx, y: sy + 2.5 }])}`, 'stroke-width': 0.9 }));
  }
  const dot = el('path', { d: dotPath(r.range(-90, 90), 56, 1.2) });
  dot.style.fill = 'var(--ink)';
  g.append(dot);
  return g;
}
