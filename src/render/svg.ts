import type { Rng } from '../core/rng';
import type { Vec } from '../core/vec';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export type Attrs = Record<string, string | number | undefined>;

export function attr(node: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) node.removeAttribute(k);
    else node.setAttribute(k, String(v));
  }
}

/** Create an SVG element with attributes and children (text children become text nodes). */
export function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  attr(node, attrs);
  for (const c of children) node.append(c);
  return node;
}

/** Round to 2 decimals for compact path strings. */
export const n2 = (n: number): string => String(Math.round(n * 100) / 100);

export function polyline(points: readonly Vec[], close = false): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${n2(p.x)} ${n2(p.y)}`).join('') + (close ? 'Z' : '');
}

/** Closed smooth curve through points (Catmull-Rom converted to cubic beziers). */
export function smoothClosed(points: readonly Vec[]): string {
  const n = points.length;
  if (n < 3) return polyline(points, true);
  const at = (i: number): Vec => points[((i % n) + n) % n] ?? { x: 0, y: 0 };
  let d = `M${n2(at(0).x)} ${n2(at(0).y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += `C${n2(p1.x + (p2.x - p0.x) / 6)} ${n2(p1.y + (p2.y - p0.y) / 6)} ${n2(p2.x - (p3.x - p1.x) / 6)} ${n2(p2.y - (p3.y - p1.y) / 6)} ${n2(p2.x)} ${n2(p2.y)}`;
  }
  return d + 'Z';
}

/** Irregular blob outline points around (cx, cy). */
export function blobPoints(rng: Rng, cx: number, cy: number, r: number, count = 9, jitter = 0.35): Vec[] {
  const pts: Vec[] = [];
  const phase = rng.range(0, Math.PI * 2);
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2 + rng.range(-0.18, 0.18);
    const rr = r * (1 + rng.range(-jitter, jitter * 0.8));
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

/** A circle drawn by hand: slightly uneven radius, not quite closed. */
export function wobblyCircle(rng: Rng, cx: number, cy: number, r: number, count = 12, jitter = 0.04): string {
  const pts = blobPoints(rng, cx, cy, r, count, jitter);
  return smoothClosed(pts);
}

/** A straight line drawn by hand: a few segments with small perpendicular noise. */
export function wobblyLine(rng: Rng, x1: number, y1: number, x2: number, y2: number, segs = 4, amp = 1.2): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: Vec[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const o = i === 0 || i === segs ? 0 : rng.range(-amp, amp);
    pts.push({ x: x1 + dx * t + nx * o, y: y1 + dy * t + ny * o });
  }
  return polyline(pts);
}

/** Path of a small filled dot (so dots can share one path with a blot). */
export function dotPath(cx: number, cy: number, r: number): string {
  return `M${n2(cx - r)} ${n2(cy)}a${n2(r)} ${n2(r)} 0 1 0 ${n2(2 * r)} 0a${n2(r)} ${n2(r)} 0 1 0 ${n2(-2 * r)} 0Z`;
}
