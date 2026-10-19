/**
 * The figure primitive for the people of the base pages (world/npc.ts): a standing clerk in the manner of the anchor (DESIGN 3.1),
 * a long coat, a head too small for it, spectacles, a stack of forms in one arm and a rubber stamp raised in the other. Ink
 * strokes on paper, hatching, one pale wash; no fills but paper, ink and hatch. Drawn once by `render/stations.ts drawStation`
 * about the station's centre (extent x -34..34, y -76..56, the tap box in world/base.ts), so it takes the wobble and the draw-in
 * of the other stations. `look` varies the little things (hair, spectacles, tie, the thickness of the stack).
 */
import { createRng, type Rng } from '../core/rng';
import type { NpcDef } from '../world/npc';
import { dotPath, el, n2, polyline, wobblyCircle, wobblyLine } from './svg';
import { washGroup } from './wash';

type Pt = [number, number];
const poly = (pts: readonly Pt[], close = false): string => polyline(pts.map(([x, y]) => ({ x, y })), close);
const stroke = (d: string, w = 1.6): SVGPathElement => el('path', { d, 'stroke-width': w });
const sheet = (pts: readonly Pt[], w = 1.5): SVGPathElement => {
  const p = el('path', { d: poly(pts, true), 'stroke-width': w });
  p.style.fill = 'var(--paper)';
  return p;
};
const hatched = (pts: readonly Pt[], w = 1.2): SVGPathElement => el('path', { d: poly(pts, true), fill: 'url(#hatch)', 'stroke-width': w });
const solid = (node: SVGElement): SVGElement => {
  node.style.fill = 'var(--ink)';
  node.style.stroke = 'none';
  return node;
};

/** A short line of fake handwriting (a nameplate, a form). */
const scrawl = (r: Rng, x: number, y: number, len: number): string => {
  const pts = [];
  for (let px = 0; px <= len; px += 3) pts.push({ x: x + px, y: y + (px % 6 === 0 ? -0.9 : 0.9) * r.range(0.5, 1.2) });
  return polyline(pts);
};

export function drawNpc(def: NpcDef): SVGGElement {
  const r = createRng(def.look * 7919 + 31).fork('npc');
  const g = el('g', { 'data-npc': def.id });
  const wash = washGroup(createRng(def.look).fork('wash'), 'ochre', 46, { opacity: 0.26 });
  wash.setAttribute('transform', 'translate(4 -2)');
  g.append(wash);

  // legs with a knee each, shoes pointing outward
  for (const side of [-1, 1]) {
    g.append(stroke(`M${side * 7} 24L${side * 8} 38L${side * 7} 52h${side * 8}`, 1.7));
    g.append(stroke(`M${side * 8} 38l${side * -2.5} 0`, 1.1));
  }
  // the long coat: shoulders to a hem that flares, one half hatched
  const coat: Pt[] = [[-12, -26], [12, -26], [20, 26], [-20, 26]];
  g.append(sheet(coat, 1.9));
  g.append(hatched([[0, -26], [12, -26], [20, 26], [0, 26]], 1.1));
  g.append(stroke('M0 -26V26', 1), stroke('M-5 -8h2M-5 4h2M-5 16h2', 1.4));
  // the tie, solid
  const tie = el('path', { d: poly([[-1.4, -26], [1.4, -26], [2.4, -10], [0, -6], [-2.4, -10]], true) });
  g.append(solid(tie));
  // the head: small, spectacles, a flat mouth, a few hairs
  g.append(stroke('M-2.5 -33v6M2.5 -33v6', 1.3));
  const head = el('path', { d: wobblyCircle(r, 0, -43, 10.5, 11, 0.045), 'stroke-width': 1.8 });
  head.style.fill = 'var(--paper)';
  g.append(head);
  g.append(stroke(wobblyCircle(r, -4.3, -44, 3.4, 8, 0.04), 1.1), stroke(wobblyCircle(r, 4.3, -44, 3.4, 8, 0.04), 1.1), stroke('M-0.9 -44h1.8', 1));
  const eyes = el('path', { d: dotPath(-4.3, -44, 0.9) + dotPath(4.3, -44, 0.9) });
  g.append(solid(eyes));
  g.append(stroke('M-3 -37h6', 1.1));
  const hair = r.int(2, 4);
  for (let i = 0; i < hair; i++) g.append(stroke(`M${n2(-6 + i * 4)} -53q${n2(r.range(-1.5, 1.5))} -5 ${n2(r.range(-2, 2))} -8`, 1));
  // the arm that holds the stack of forms, held in front
  g.append(stroke('M-12 -22L-24 -6L-14 4', 1.7));
  const stack = r.int(2, 4);
  for (let i = 0; i < stack; i++) g.append(sheet([[-30, 4 - i * 3.4], [-12, 2 - i * 3.4], [-10, 5 - i * 3.4], [-28, 7 - i * 3.4]], 1.3));
  // the arm that raises the rubber stamp
  g.append(stroke('M12 -22L25 -30L26 -44', 1.7));
  g.append(sheet([[21, -44], [31, -44], [31, -50], [21, -50]], 1.3), stroke('M26 -50v-9a3.4 3.4 0 0 1 6.8 0v9', 1.3));
  // the nameplate on the lapel
  g.append(sheet([[3.5, -17], [11, -17], [11, -12], [3.5, -12]], 0.9), stroke(scrawl(r, 4.5, -14.5, 5), 0.6));
  // a bell-shaped shadow on the paper under the feet, drawn with the pen
  g.append(stroke(wobblyLine(r, -18, 55, 18, 55, 5, 0.8), 0.9));
  return g;
}
