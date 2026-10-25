/** Sketches for skills (swirl, cone, ring, line, blink) drawn in the fx layer, and the zone builder. */
import { createRng } from '../core/rng';
import type { Bus } from '../core/events';
import type { Summon, Zone } from '../entities/types';
import { heroById, HERO_IDS } from '../heroes/registry';
import { t } from '../i18n';
import { setStroke } from './attackFx';
import { drawIn, eraseOut, marginNote } from './ink';
import { blobPoints, el, n2, smoothClosed, wobblyLine } from './svg';
import type { Builder } from './view';

const pen = createRng(0x5c11);

function sketch(layer: SVGGElement, d: string, opts: { dash?: string; ms?: number; hold?: number; width?: number; red?: boolean } = {}): void {
  const g = el('g', {});
  const path = el('path', { d });
  if (opts.dash) path.setAttribute('stroke-dasharray', opts.dash);
  if (opts.width) path.setAttribute('stroke-width', String(opts.width));
  if (opts.red) path.style.stroke = 'var(--accent)'; // a strike is the editor's pen: the one red
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

function cone(x: number, y: number, x2: number, y2: number, r: number, half = (40 * Math.PI) / 180): string {
  const base = Math.atan2(y2 - y, x2 - x);
  const p1 = { x: x + Math.cos(base - half) * r, y: y + Math.sin(base - half) * r };
  const p2 = { x: x + Math.cos(base + half) * r, y: y + Math.sin(base + half) * r };
  return `M${n2(x)} ${n2(y)}L${n2(p1.x)} ${n2(p1.y)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(p2.x)} ${n2(p2.y)}Z`;
}

/** Short wet strokes: a few curved dashes at random places inside the circle (x, y, r), or inside the cone when `toward` is given. */
function wetStrokes(x: number, y: number, r: number, count: number, toward?: { x2: number; y2: number; half: number; reach: number }): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    let cx = x + pen.range(-r, r);
    let cy = y + pen.range(-r, r);
    if (toward) {
      const base = Math.atan2(toward.y2 - y, toward.x2 - x);
      const a = base + pen.range(-toward.half, toward.half) * 0.85;
      const rr = pen.range(0.3, 1) * toward.reach;
      cx = x + Math.cos(a) * rr;
      cy = y + Math.sin(a) * rr;
    }
    const len = pen.range(5, 9);
    const tilt = pen.range(-0.6, 0.6) + Math.PI / 2; // droplets run down the page
    d += `M${n2(cx)} ${n2(cy)}q${n2(Math.cos(tilt) * len * 0.5 + 2)} ${n2(Math.sin(tilt) * len * 0.5)} ${n2(Math.cos(tilt) * len)} ${n2(Math.sin(tilt) * len)}`;
  }
  return d;
}

/** Wavy strokes rising from the floor of a circle (x, y, r): the steam of Program 90. */
function steamStrokes(x: number, y: number, r: number): string {
  let d = '';
  const count = Math.max(3, Math.round(r / 22));
  for (let i = 0; i < count; i++) {
    const cx = x + pen.range(-r, r) * 0.7;
    const cy = y + pen.range(-0.1, 0.5) * r;
    const h = pen.range(14, 24);
    const w = pen.range(3, 5);
    d += `M${n2(cx)} ${n2(cy)}q${n2(w)} ${n2(-h * 0.25)} 0 ${n2(-h * 0.5)}t0 ${n2(-h * 0.5)}`;
  }
  return d;
}

/** The section sign "§" as strokes, about 14 units tall, centred on (x, y). */
function sectionSign(x: number, y: number): string {
  return `M${n2(x + 3.5)} ${n2(y - 8)}C${n2(x + 3.5)} ${n2(y - 11)} ${n2(x - 3.5)} ${n2(y - 11)} ${n2(x - 3.5)} ${n2(y - 7)}C${n2(x - 3.5)} ${n2(y - 3.5)} ${n2(x + 3.5)} ${n2(y - 3)} ${n2(x + 3.5)} ${n2(y + 0.5)}M${n2(x - 3.5)} ${n2(y - 0.5)}C${n2(x - 3.5)} ${n2(y + 3)} ${n2(x + 3.5)} ${n2(y + 3.5)} ${n2(x + 3.5)} ${n2(y + 7)}C${n2(x + 3.5)} ${n2(y + 11)} ${n2(x - 3.5)} ${n2(y + 11)} ${n2(x - 3.5)} ${n2(y + 8)}M${n2(x - 3.5)} ${n2(y - 7)}V${n2(y - 0.5)}M${n2(x + 3.5)} ${n2(y + 0.5)}V${n2(y + 7)}`;
}

/** The capsule he arrived in, standing upright with its centre of the base at (0, 0): bullet shell, window, three fins. */
export const CAPSULE_PARTS: readonly string[] = [
  'M-9 0V-20Q-9-34 0-40Q9-34 9-20V0Z',
  'M-9-6H9M-5.5-24a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0',
  'M-9-4L-16 5H-9M9-4L16 5H9M-3 0V4M3 0V4',
];

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
      case 'drum': {
        // Otwarcie bebna: the cone (35 degrees each way) and the wet load flying out of it
        const half = (35 * Math.PI) / 180;
        sketch(layer, cone(e.x, e.y, e.x2, e.y2, e.r, half), { ms: 200 });
        sketch(layer, wetStrokes(e.x, e.y, 0, 7, { x2: e.x2, y2: e.y2, half, reach: e.r }), { ms: 160, hold: 220, width: 1.9 });
        break;
      }
      case 'wet':
        // wet laundry lands on an enemy: a few droplets around it that dry out
        sketch(layer, wetStrokes(e.x, e.y, e.r + 4, 4), { ms: 140, hold: 520, width: 1.9 });
        break;
      case 'section': {
        // Wniosek o osobowosc: a dotted ring round her with the pencil "§" on its rim
        sketch(layer, circleAround(e.x, e.y, e.r), { dash: '2 5', ms: 220, hold: 380 });
        sketch(layer, sectionSign(e.x + e.r * 0.72, e.y - e.r * 0.72), { ms: 240, hold: 360, width: 1.1 });
        break;
      }
      case 'cut': {
        // Rozlaczenie: a dotted line to the hit, cut by a short stroke, and the word "polaczenie" struck out beside it
        const dx = e.x2 - e.x;
        const dy = e.y2 - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const cutAt = Math.max(0, len - 14);
        const cx = e.x + ux * cutAt;
        const cy = e.y + uy * cutAt;
        sketch(layer, wobblyLine(pen, e.x, e.y, cx, cy, 6, 1), { dash: '3 5', ms: 140, hold: 300 });
        sketch(layer, `M${n2(cx - uy * 8 - ux * 4)} ${n2(cy + ux * 8 - uy * 4)}L${n2(cx + uy * 8 + ux * 4)} ${n2(cy - ux * 8 + uy * 4)}`, { ms: 90, hold: 400, width: 2.2 });
        const wx = e.x2 - ux * 22;
        const wy = e.y2 - 30;
        const word = t('heroes.konsultant.cut');
        marginNote(word, wx, wy, -5, 700);
        const w = word.length * 5.4;
        sketch(layer, `M${n2(wx - w / 2 - 2)} ${n2(wy - 3.5)}L${n2(wx + w / 2 + 2)} ${n2(wy - 4.5)}`, { ms: 120, hold: 600, width: 1.8, red: true });
        break;
      }
      case 'tide': {
        // Plywy: the ring runs out from the rim to its full size in 0.4 s (an animated scale; the strokes stay as wide as they are)
        const g = el('g', {});
        for (const [k, w, dash] of [[1, 3.2, ''], [0.82, 1.6, '5 6']] as const) {
          const path = el('path', { d: circleAround(e.x, e.y, e.r * k), 'stroke-width': w, 'vector-effect': 'non-scaling-stroke' });
          if (dash) path.setAttribute('stroke-dasharray', dash);
          g.append(path);
        }
        const grow = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
        grow.setAttribute('attributeName', 'transform');
        grow.setAttribute('type', 'scale');
        grow.setAttribute('from', '0.12');
        grow.setAttribute('to', '1');
        grow.setAttribute('dur', '0.4s');
        grow.setAttribute('fill', 'freeze');
        const wrap = el('g', { transform: `translate(${n2(e.x)} ${n2(e.y)})` });
        const inner = el('g', { transform: `translate(${n2(-e.x)} ${n2(-e.y)})` });
        inner.append(g);
        const scaler = el('g', {});
        scaler.append(grow, inner);
        wrap.append(scaler);
        layer.append(wrap);
        eraseOut(g, 420, 520, () => wrap.remove());
        break;
      }
      case 'steam': {
        // Program 90: a dotted ring and wavy strokes of steam rising out of the drum's floor (S19)
        sketch(layer, circleAround(e.x, e.y, e.r), { dash: '2 5', ms: 220, hold: 500 });
        sketch(layer, steamStrokes(e.x, e.y, e.r), { ms: 260, hold: 520, width: 1.3 });
        break;
      }
      case 'puddle': {
        // Odpompowanie: a hatched puddle with a wavy rim and the swirl of the drain at its centre (S19). The rim is a thin line and
        // the hatch faint: the puddle is as wide as the screen's half and must stay under the figures, not compete with them.
        const g = el('g', {});
        const rim = smoothClosed(blobPoints(pen, e.x, e.y, e.r, 14, 0.07));
        g.append(el('path', { d: rim, 'stroke-width': 1.1 }), el('path', { d: rim, fill: 'url(#hatch)', stroke: 'none', 'fill-opacity': 0.28 }), el('path', { d: spiral(e.x, e.y, e.r * 0.22), 'stroke-width': 1 }));
        layer.append(g);
        drawIn(g, 240);
        eraseOut(g, 420, 1000, () => g.remove());
        break;
      }
      case 'capsule': {
        // Odlozony start: the capsule stands where it landed, in a dotted ring of the area it struck
        const g = el('g', { transform: `translate(${n2(e.x)} ${n2(e.y + 12)}) scale(1.35)` });
        for (const d of CAPSULE_PARTS) g.append(el('path', { d }));
        layer.append(g);
        drawIn(g, 120);
        eraseOut(g, 450, 700, () => g.remove());
        sketch(layer, circleAround(e.x, e.y, e.r), { dash: '2 5', ms: 160, hold: 360 });
        break;
      }
    }
  });
}

// ---------- zones ----------

const HOURGLASS = 'M-6-9H6M-6 9H6M-5-9C-5-2-1-1 0 0C-1 1-5 2-5 9M5-9C5-2 1-1 0 0C1 1 5 2 5 9M-2.5 8H2.5M0 1V6';

/** Strokes of a hero-drawn thing (heroes/figureKit.ts `zoneParts`, `summonParts`): "~" in front draws a stroke dotted. */
export function appendParts(g: SVGGElement, parts: readonly string[]): void {
  for (const d of parts) {
    const dotted = d.startsWith('~');
    const path = el('path', { d: dotted ? d.slice(1) : d });
    if (dotted) path.setAttribute('stroke-dasharray', '2 4');
    g.append(path);
  }
}

export const zoneBuilder: Builder<Zone> = {
  create(z) {
    const g = el('g', { class: `zone zone-${z.variant}` });
    if (z.variant === 'hourglass') {
      g.append(el('path', { d: HOURGLASS }));
      return g;
    }
    if (z.variant === 'wniosek') {
      // Wniosek o status: a planted flag with a stamped pennant at the centre, a dotted boundary, a few ticks of the surveyed edge
      const rng = createRng(z.id * 6151);
      const edge = smoothClosed(blobPoints(rng, 0, 0, z.r, 18, 0.03));
      let ticks = '';
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        ticks += `M${n2(Math.cos(a) * (z.r - 5))} ${n2(Math.sin(a) * (z.r - 5))}L${n2(Math.cos(a) * z.r)} ${n2(Math.sin(a) * z.r)}`;
      }
      g.append(
        el('path', { d: edge, 'stroke-dasharray': '1.6 5' }),
        el('path', { d: ticks, 'stroke-width': 0.9 }),
        el('path', { d: 'M0 4V-24' }),
        el('path', { d: 'M0-24L13-20L0-16Z' }),
        el('path', { d: 'M0-23L11-20L0-17Z', fill: 'url(#hatch)', stroke: 'none' }),
        el('path', { d: 'M-5 4Q0 6.5 5 4M-3 6.5H3', 'stroke-width': 1.1 }),
      );
      return g;
    }
    const drawn = HERO_IDS.map((id) => heroById(id).figure.zoneParts?.(z) ?? null).find((x) => x !== null);
    if (drawn) {
      appendParts(g, drawn);
      // the contact form is the point of the zone: the crowd it holds stands on it, so its lines are drawn over them (S19 look)
      if (z.variant === 'formularz') {
        g.dataset['over'] = '';
        g.setAttribute('stroke-width', '2.2');
      }
      return g;
    }
    if (z.variant === 'numer') return buildCaseNumber(g, z);
    if (z.variant === 'legenda') return buildLegend(g, z);
    if (z.variant === 'start') return buildLanding(g, z);
    const rng = createRng(z.id * 7919);
    const outline = smoothClosed(blobPoints(rng, 0, 0, z.r, 16, 0.05));
    g.append(
      el('path', { d: outline, fill: 'url(#hatch-wide)', stroke: 'none' }),
      el('path', { d: outline, 'stroke-dasharray': '7 6' }),
      el('path', { d: `M-5-4Q-5-9 0-9Q5-9 5-4Q5-1 0 1V3M0 7h.01` }),
    );
    return g;
  },
  patch(z, g) {
    if (z.variant === 'start') patchLanding(z, g);
  },
  drawInMs: 300,
};

// ---------- the fourth and fifth skills' zones and the moon ----------

/**
 * Numer sprawy: a slammed rubber stamp above the figure (red, it is a stamp): the number in Michroma at 13 px, a heavy double frame,
 * a few degrees crooked. The zone sits at the enemy's rim (heroes/system.ts), so the stamp is raised another 26 units, clear of the wash.
 */
function buildCaseNumber(g: SVGGElement, z: Zone): SVGGElement {
  const label = String(z.number ?? z.follow ?? z.id);
  const size = 13;
  const w = label.length * (size * 1.06 + 1.5) + 16;
  const h = size + 14;
  const stamp = el('g', { transform: `translate(0 -26) rotate(${-3 - (z.id % 4)})` });
  for (const [inset, sw] of [[0, 2.6], [3.4, 1.1]] as const) {
    const r = el('rect', { x: n2(-w / 2 + inset), y: n2(-h / 2 + inset), width: n2(w - inset * 2), height: n2(h - inset * 2) });
    r.style.stroke = 'var(--accent)';
    r.style.strokeWidth = String(sw);
    r.style.fill = 'none';
    stamp.append(r);
  }
  const text = el('text', { class: 't-stamp', x: 0, y: n2(size * 0.36), 'font-size': size, 'letter-spacing': 1.5 }, [label]);
  text.style.stroke = 'var(--accent)';
  text.style.strokeWidth = '0.5';
  stamp.append(text);
  g.append(stamp);
  return g;
}

/** Legenda: the dotted edge of the area and a ruled legend box at its centre: a heading and three rows of swatch and rule. */
function buildLegend(g: SVGGElement, z: Zone): SVGGElement {
  const rng = createRng(z.id * 4421);
  g.append(el('path', { d: smoothClosed(blobPoints(rng, 0, 0, z.r, 18, 0.03)), 'stroke-dasharray': '2 7', 'stroke-width': 1.1 }));
  const w = 124;
  const h = 78;
  g.append(
    el('path', { d: `M${-w / 2} ${-h / 2}L${w / 2 - 1} ${-h / 2 + 1}L${w / 2} ${h / 2}L${-w / 2 + 1} ${h / 2 - 1}Z`, 'stroke-width': 1.7 }),
    el('path', { d: `M${-w / 2 + 3} ${-h / 2 + 3}H${w / 2 - 3}V${h / 2 - 3}H${-w / 2 + 3}Z`, 'stroke-width': 0.8 }),
    el('path', { d: `M${-w / 2} ${-h / 2 + 19}H${w / 2}`, 'stroke-width': 1 }),
  );
  g.append(el('text', { class: 't-note', x: -w / 2 + 9, y: -h / 2 + 14, 'font-size': 13 }, [t('heroes.kartograf.legendaTitle')]));
  for (let i = 0; i < 3; i++) {
    const y = -h / 2 + 28 + i * 16;
    g.append(
      el('path', { d: `M${-w / 2 + 10} ${y - 5}h14v8h-14Z`, 'stroke-width': 1.1 }),
      el('path', { d: `M${-w / 2 + 10} ${y - 5}h14v8h-14Z`, fill: i === 1 ? 'url(#hatch)' : i === 2 ? 'url(#hatch-wide)' : 'none', stroke: 'none' }),
      el('path', { d: `M${-w / 2 + 32} ${y}H${w / 2 - 12 - i * 14}`, 'stroke-width': 0.9, 'stroke-dasharray': i === 1 ? '3 3' : undefined }),
    );
  }
  return g;
}

const LANDING_FALL = 240;

/** Odlozony start: a dotted circle with eight ticks and a ring of ink that closes as the time runs out; the capsule is drawn in falling. */
function buildLanding(g: SVGGElement, z: Zone): SVGGElement {
  const rng = createRng(z.id * 3187);
  g.dataset['total'] = String(z.ttl);
  g.append(el('path', { d: smoothClosed(blobPoints(rng, 0, 0, z.r, 16, 0.03)), 'stroke-dasharray': '2 6' }));
  let ticks = '';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ticks += `M${n2(Math.cos(a) * (z.r - 6))} ${n2(Math.sin(a) * (z.r - 6))}L${n2(Math.cos(a) * z.r)} ${n2(Math.sin(a) * z.r)}`;
  }
  g.append(el('path', { d: ticks, 'stroke-width': 1 }));
  const r2 = z.r - 12;
  g.append(el('path', { class: 'count', d: `M0 ${-r2}A${r2} ${r2} 0 1 1 -0.01 ${-r2}`, pathLength: 1, 'stroke-width': 1.8, 'stroke-dasharray': '0.0005 3' }));
  const cap = el('g', { class: 'cap', transform: `translate(0 ${-LANDING_FALL})` });
  for (const d of CAPSULE_PARTS) cap.append(el('path', { d, pathLength: 1, 'stroke-dasharray': '0.0005 3' }));
  const scale = el('g', { transform: 'translate(0 10) scale(1.35)' }, [cap]);
  g.append(scale);
  return g;
}

function patchLanding(z: Zone, g: SVGGElement): void {
  const total = Number(g.dataset['total']) || 0.8;
  const k = Math.max(0, Math.min(1, 1 - z.ttl / total));
  const count = g.querySelector('.count');
  if (count) setStroke(count, k, 0);
  const cap = g.querySelector('.cap');
  if (!cap) return;
  const p = Math.max(0, Math.min(1, (k - 0.3) / 0.7));
  cap.setAttribute('transform', `translate(0 ${n2(-LANDING_FALL * (1 - p * p))})`);
  for (const path of cap.querySelectorAll('path')) setStroke(path, Math.min(1, p * 4), 0);
}

/** Ksiezyc: a small pebble with two craters on its own dotted circle round the pancake (the circle is centred on the player, not on the pebble). */
export function buildMoon(e: Summon): SVGGElement {
  const g = el('g', { class: 'summon-moon' });
  const rng = createRng(e.id * 2713);
  const ring = e.orbit?.ring ?? 90;
  g.append(el('path', { class: 'moon-ring', d: `M${-ring} 0a${ring} ${ring} 0 1 0 ${2 * ring} 0a${ring} ${ring} 0 1 0 ${-2 * ring} 0`, 'stroke-dasharray': '1.4 6', 'stroke-width': 1.1 }));
  g.append(
    el('path', { d: smoothClosed(blobPoints(rng, 0, 0, 7, 9, 0.12)), 'stroke-width': 1.8 }),
    el('path', { d: 'M-3.5-1.5q1.5-2 3.5-.6M1.5 2.5q1.8 1 3.2-.6', 'stroke-width': 1 }),
  );
  return g;
}

export function patchMoon(e: Summon, g: SVGGElement): void {
  const o = e.orbit;
  const ring = g.querySelector('.moon-ring');
  if (!o || !ring) return;
  ring.setAttribute('transform', `translate(${n2(-Math.cos(o.angle) * o.r)} ${n2(-Math.sin(o.angle) * o.r)})`);
}
