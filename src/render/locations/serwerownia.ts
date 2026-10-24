/**
 * Serwerownia (STORY 8.2): a server hall. Racks as tall hatched rectangles with rows of dots (static, nothing blinks), a fan unit, a
 * fire extinguisher, a ladder, a plate with the one word of the hall, and on the floor, under everything: a raised-floor grid, a
 * cable tray as two dotted lines, a cold-aisle curtain as a dashed line. Ink and hatching only, no fills but paper and hatch.
 */
import { t } from '../../i18n';
import type { Rng } from '../../core/rng';
import type { Obstacle } from '../../world/pages';
import { kit } from './kit';
import { registerDrawings } from './registry';

/** A server rack: a hatched frame, a paper door with a ruled unit every few lines, LED dots on the left and a vent of dots on the right. */
function rack(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -150], [50, -150], [50, 150], [-50, 150]], { fill: 'hatch', w: 2, jit: 0.9 });
  k.shape([[-40, -140], [40, -140], [40, 140], [-40, 140]], { fill: 'paper', w: 1.3, jit: 0.6 });
  const rows: string[] = [];
  const dots: [number, number, number][] = [];
  for (let y = -124; y <= 126; y += 21) {
    rows.push(`M-34 ${y}H34`);
    for (let x = -28; x <= -16; x += 6) dots.push([x, y + 7, 1.6]);
    for (let x = 6; x <= 30; x += 6) dots.push([x, y + 7, 1.1], [x, y + 12, 1.1]);
  }
  k.path(rows.join(''), { w: 0.8 });
  k.dots(dots);
  // the handle, the hinge strokes and the feet
  k.line(34, -20, 34, 20, 2.2);
  k.path('M-40 -110h-4M-40 0h-4M-40 110h-4', { w: 1.3 });
  k.shape([[-46, 150], [-38, 150], [-38, 158], [-46, 158]], { fill: 'hatch', w: 1.1, jit: 0.2 });
  k.shape([[38, 150], [46, 150], [46, 158], [38, 158]], { fill: 'hatch', w: 1.1, jit: 0.2 });
  return k.g;
}

/** A fan unit: a square housing, a guard of rings and spokes, five blades round a hub, one cable out. */
function wentylator(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-46, -46], [46, -46], [46, 46], [-46, 46]], { fill: 'paper', w: 2, jit: 0.8 });
  for (const [x, y] of [[-37, -37], [37, -37], [-37, 37], [37, 37]] as const) k.disc(x, y, 3, { fill: 'hatch', w: 1 });
  k.disc(0, 0, 38, { fill: 'hatch', w: 1.6 });
  k.disc(0, 0, 33, { fill: 'paper', w: 1.2 });
  let blades = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r.range(-0.02, 0.02);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const pt = (rr: number, da: number): string => `${(Math.cos(a + da) * rr).toFixed(1)} ${(Math.sin(a + da) * rr).toFixed(1)}`;
    blades += `M${(c * 6).toFixed(1)} ${(s * 6).toFixed(1)}Q${pt(20, 0.5)} ${pt(30, 0.28)}Q${pt(22, -0.12)} ${(c * 6).toFixed(1)} ${(s * 6).toFixed(1)}Z`;
  }
  k.path(blades, { fill: 'hatch', w: 1.1 });
  k.disc(0, 0, 6, { fill: 'paper', w: 1.4 });
  k.dots([[0, 0, 1.6]]);
  k.disc(0, 0, 24, { w: 0.7 });
  k.path('M0 -38V38M-38 0H38M-27 -27L27 27M27 -27L-27 27', { w: 0.6 });
  k.path('M46 30Q64 34 62 54Q60 66 50 70', { w: 1.5 });
  return k.g;
}

/** A fire extinguisher: a cylinder with a collar band, a valve, a handle and a coiled hose. */
function gasnica(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.path('M-22 -14Q-22 -30 -8 -36L8 -36Q22 -30 22 -14L22 44Q22 52 14 52L-14 52Q-22 52 -22 44Z', { fill: 'paper', w: 2.4 });
  k.shape([[-22, -6], [22, -6], [22, 12], [-22, 12]], { fill: 'hatch', w: 1.5, jit: 0.4 });
  k.shape([[-12, 24], [12, 24], [12, 40], [-12, 40]], { w: 1.2, jit: 0.4 });
  k.line(-6, 29, 6, 29, 1);
  k.line(-6, 34, 6, 34, 1);
  // neck, valve, handle and lever
  k.shape([[-7, -36], [7, -36], [7, -46], [-7, -46]], { fill: 'paper', w: 1.8, jit: 0.3 });
  k.path('M-10 -46H22L28 -40M-12 -52H14', { w: 2 });
  // the hose, coiled to the nozzle
  k.path('M20 -40Q42 -30 38 -4Q34 18 26 26Q34 36 24 44', { w: 1.8 });
  return k.g;
}

/** A step ladder leant against nothing: two rails that splay, rungs, rubber feet. */
function drabina(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(-20, -56, -28, 56, 2.2);
  k.line(20, -56, 28, 56, 2.2);
  for (let i = 0; i < 8; i++) {
    const t0 = (i + 0.6) / 8;
    const y = -56 + t0 * 112;
    const half = 20 + t0 * 8;
    k.line(-half, y, half, y, 1.5);
  }
  k.shape([[-33, 56], [-23, 56], [-23, 62], [-33, 62]], { fill: 'hatch', w: 1.1, jit: 0.3 });
  k.shape([[23, 56], [33, 56], [33, 62], [23, 62]], { fill: 'hatch', w: 1.1, jit: 0.3 });
  k.path('M-20 -56h-5M20 -56h5', { w: 1.5 });
  return k.g;
}

/** The plate of the hall: one word on a post. The word comes from the string table. */
function cisza(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(0, -18, 0, 36, 2.4);
  k.shape([[-20, 36], [20, 36], [24, 44], [-24, 44]], { fill: 'hatch', w: 1.6, jit: 0.4 });
  k.shape([[-46, -58], [46, -58], [46, -16], [-46, -16]], { fill: 'paper', w: 2.2, jit: 0.5 });
  k.shape([[-41, -53], [41, -53], [41, -21], [-41, -21]], { w: 0.9, jit: 0.3 });
  k.mark(t('screens.base.plate.cisza'), 0, -32, 17);
  k.dots([[-43, -55, 1.2], [43, -55, 1.2], [-43, -19, 1.2], [43, -19, 1.2]]);
  return k.g;
}

/** The raised floor seen from above: tiles in a grid, one perforated, one lifted at a corner. A flat mark under everything. */
function siatka(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const d: string[] = [];
  for (let i = 0; i <= 4; i++) d.push(`M${-50 + i * 25} -70V70`);
  for (let j = 0; j <= 6; j++) d.push(`M-50 ${-70 + j * 23.3}H50`);
  k.path(d.join(''), { w: 0.7 });
  const holes: [number, number, number][] = [];
  const px = r.int(0, 3);
  const py = r.int(0, 5);
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) holes.push([-50 + px * 25 + 5 + a * 5, -70 + py * 23.3 + 4 + b * 5, 0.9]);
  k.dots(holes);
  const lx = (px + 2) % 4;
  const ly = (py + 3) % 6;
  k.shape([[-50 + lx * 25, -70 + ly * 23.3], [-25 + lx * 25, -70 + ly * 23.3], [-22 + lx * 25, -46.7 + ly * 23.3], [-47 + lx * 25, -47 + ly * 23.3]], { fill: 'hatch', w: 1, jit: 0.4 });
  return k.g;
}

/** A cable tray along the floor: two dotted rails with rungs, running the length of a corridor. */
function koryto(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const dots: [number, number, number][] = [];
  const rungs: string[] = [];
  for (let y = -150; y <= 150; y += 5) {
    dots.push([-16, y, 1], [16, y, 1]);
    if ((y + 150) % 25 === 0) rungs.push(`M-16 ${y}H16`);
  }
  k.dots(dots);
  k.path(rungs.join(''), { w: 0.8 });
  // the cables, three wavy strokes inside the tray
  k.path('M-6 -150Q-2 -100 -6 -50T-6 50T-6 150M0 -150Q4 -90 0 -40T0 60T0 150M6 -150Q2 -110 6 -60T6 40T6 150', { w: 0.8 });
  return k.g;
}

/** A cold-aisle curtain: a dashed line across the corridor with strips hanging from it. */
function kurtyna(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const line = k.path('M-50 0H50', { w: 1.8 });
  line.setAttribute('stroke-dasharray', '9 5');
  const strips: string[] = [];
  for (let x = -46; x <= 46; x += 8) strips.push(`M${x} 2v${(r.range(10, 15)).toFixed(1)}`);
  k.path(strips.join(''), { w: 0.7 });
  k.path('M-50 -8V8M50 -8V8', { w: 2 });
  return k.g;
}

registerDrawings('serwerownia', { rack, wentylator, gasnica, drabina, cisza, siatka, koryto, kurtyna });
