/**
 * Magazyn (STORY 8.1): a parcel depot. Pallet stacks as hatched boxes, shelving racks as ruled lines, a forklift outline, rolls of
 * tape, a floor scale, a conveyor with a dotted belt, a wall of parcels, a hand truck. Ink and hatching only.
 */
import type { Obstacle } from '../../world/pages';
import type { Rng } from '../../core/rng';
import { kit, parcel } from './kit';
import { registerDrawings } from './registry';

function palety(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  // the pallet: a slab on blocks
  k.shape([[-50, 28], [50, 28], [50, 36], [-50, 36]], { fill: 'paper', w: 1.6, jit: 0.4 });
  for (const x of [-34, 0, 34]) k.shape([[x - 7, 36], [x + 7, 36], [x + 7, 44], [x - 7, 44]], { fill: 'hatch', w: 1.1, jit: 0.3 });
  parcel(k, -48, -2, -2, 28);
  parcel(k, 2, -2, 48, 28, 'hatch');
  parcel(k, -30, -32, 24, -2);
  k.line(-48, 14, 48, 14, 0.8);
  k.path('M-30 -32L-24 -40L30 -40L24 -32', { fill: 'paper', w: 1.2 });
  return k.g;
}

function regal(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const shelves = [-20, 2, 24];
  for (const x of [-48, 48]) k.line(x, -36, x, 36, 2);
  k.line(0, -36, 0, 36, 1.2);
  for (const y of shelves) k.line(-48, y, 48, y, 1.6);
  for (const y of shelves) {
    let x = -44;
    while (x < 40) {
      const w = r.range(10, 20);
      const h = r.range(8, 14);
      if (x + w > 46) break;
      if (r.chance(0.78)) parcel(k, x, y - h, x + w, y, r.chance(0.3) ? 'hatch' : 'paper');
      x += w + r.range(2, 8);
    }
  }
  k.line(-48, 36, -40, 44, 1.2);
  k.line(48, 36, 40, 44, 1.2);
  k.path('M-48 -36L-24 -20M0 -36L24 -20M-24 2L0 24', { w: 0.9 });
  return k.g;
}

function wozek(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  // mast and forks
  k.line(-34, -44, -34, 30, 2);
  k.line(-26, -44, -26, 30, 2);
  k.line(-34, -44, -26, -44, 1.6);
  k.shape([[-34, 22], [-56, 22], [-56, 27], [-34, 27]], { fill: 'paper', w: 1.6, jit: 0.3 });
  k.line(-34, -6, -26, -6, 1.2);
  // chassis, counterweight, cab frame
  k.shape([[-24, 24], [-24, 0], [6, 0], [10, -12], [44, -12], [50, 24]], { fill: 'paper', w: 2 });
  k.shape([[30, -12], [50, -12], [50, 24], [34, 24]], { fill: 'hatch', w: 1.4 });
  k.path('M8 -12L8 -42L40 -42L40 -12M8 -42L4 -42M16 -42L16 -24L28 -24', { w: 1.4 });
  k.shape([[12, -22], [26, -22], [26, -12], [12, -12]], { fill: 'paper', w: 1.2 });
  k.disc(-8, 24, 11, { fill: 'paper', w: 1.9 });
  k.disc(-8, 24, 4, { w: 1.1 });
  k.disc(38, 26, 9, { fill: 'paper', w: 1.9 });
  k.disc(38, 26, 3.4, { w: 1.1 });
  k.disc(24, -46, 3, { fill: 'ink' });
  k.path('M17 -50L13 -54M24 -52L24 -57M31 -50L35 -54', { w: 1 });
  return k.g;
}

function tasma(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.disc(-14, 10, 24, { fill: 'paper', w: 2 });
  k.disc(-14, 10, 14, { w: 1.2 });
  k.disc(-14, 10, 7, { fill: 'hatch', w: 1.2 });
  k.disc(16, -2, 24, { fill: 'paper', w: 2 });
  k.disc(16, -2, 14, { w: 1.2 });
  k.disc(16, -2, 7, { fill: 'hatch', w: 1.2 });
  // the loose end, curled onto the paper
  k.path('M40 -2Q52 10 44 24Q38 36 52 40', { w: 1.6 });
  k.shape([[40, -2], [47, 0], [49, 26], [40, 24]], { fill: 'hatch', w: 1.1, jit: 0.4 });
  return k.g;
}

function waga(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-42, 4], [24, 4], [24, 20], [-42, 20]], { fill: 'hatch', w: 1.6 });
  k.shape([[24, 4], [44, -14], [44, 2], [24, 20]], { fill: 'paper', w: 1.6 });
  k.shape([[-42, 4], [-22, -14], [44, -14], [24, 4]], { fill: 'paper', w: 1.9 });
  for (let i = 0; i < 5; i++) {
    const x = -24 + i * 12;
    k.path(`M${x} 0l6 -10M${x + 5} 0l6 -10`, { w: 0.7 });
  }
  // the display post
  k.line(38, -12, 38, -44, 1.8);
  k.shape([[22, -70], [56, -70], [56, -42], [22, -42]], { fill: 'paper', w: 1.9, jit: 0.4 });
  k.shape([[27, -65], [51, -65], [51, -52], [27, -52]], { fill: 'hatch', w: 1 });
  k.mark('0.0', 39, -46, 8);
  k.dots([[30, -46, 1.2], [48, -46, 1.2]]);
  return k.g;
}

function tasmociag(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -4], [50, -4], [50, 8], [-50, 8]], { fill: 'paper', w: 1.9, jit: 0.4 });
  // the belt: a dotted band
  const belt: [number, number, number][] = [];
  for (let x = -46; x <= 46; x += 4.6) belt.push([x, -9, 0.9]);
  k.dots(belt);
  const rollers: [number, number, number][] = [];
  for (let x = -42; x <= 42; x += 12) rollers.push([x, 2, 1.4]);
  k.dots(rollers);
  k.disc(-50, 2, 7, { fill: 'paper', w: 1.6 });
  k.disc(50, 2, 7, { fill: 'paper', w: 1.6 });
  for (const x of [-40, 0, 40]) {
    k.path(`M${x - 4} 8L${x - 6} 34M${x + 4} 8L${x + 6} 34`, { w: 1.5 });
    k.line(x - 6, 34, x + 6, 34, 1.2);
  }
  k.path('M-38 14L-6 34M38 14L6 34', { w: 0.8 });
  // parcels riding the belt
  parcel(k, -34, -24, -18, -10);
  parcel(k, 6, -28, 26, -10, 'hatch');
  return k.g;
}

function paczki(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const rows = [
    { y0: 12, y1: 34, parts: 3, off: 0 },
    { y0: -10, y1: 12, parts: 3, off: 6 },
    { y0: -32, y1: -10, parts: 2, off: -4 },
  ];
  for (const row of rows) {
    const cuts: number[] = [];
    for (let i = 1; i < row.parts; i++) cuts.push(-50 + (100 * i) / row.parts + r.range(-8, 8) + row.off);
    const edges = [-50, ...cuts, 50];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i] ?? -50;
      const b = edges[i + 1] ?? 50;
      parcel(k, a + 0.8, row.y0, b - 0.8, row.y1, r.chance(0.3) ? 'hatch' : 'paper');
    }
  }
  k.shape([[-30, -20], [-18, -20], [-18, -14], [-30, -14]], { w: 0.8 });
  return k.g;
}

function wozekReczny(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(-8, -52, -8, 34, 2);
  k.line(12, -52, 12, 34, 2);
  k.path('M-8 -52Q2 -66 12 -52', { w: 1.9 });
  k.line(-8, -22, 12, -22, 1.3);
  k.line(-8, 2, 12, 2, 1.3);
  k.shape([[-8, 34], [-42, 34], [-42, 40], [-8, 40]], { fill: 'hatch', w: 1.5, jit: 0.3 });
  parcel(k, -42, 4, -10, 34, 'paper');
  k.disc(26, 30, 14, { fill: 'paper', w: 2 });
  k.disc(26, 30, 5, { fill: 'hatch', w: 1.2 });
  k.line(12, 30, 20, 30, 1.6);
  return k.g;
}

/** A stack of parcels, pyramid-wise: three on the floor, two on them, one on top, a strap round the lot (planet 2, S13). */
function stos(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  parcel(k, -48, 4, -16, 36);
  parcel(k, -14, 4, 18, 36, 'hatch');
  parcel(k, 20, 4, 50, 36);
  parcel(k, -32, -26, 0, 4, 'hatch');
  parcel(k, 2, -26, 34, 4);
  parcel(k, -14, -52, 18, -26);
  k.path('M-48 22H50', { w: 0.8 });
  k.path('M-14 -52L-8 -58H24L18 -52', { fill: 'paper', w: 1.1 });
  return k.g;
}

/** A shelving rack with awizo slips pinned to its uprights and shelves: small sheets, a pin each, a few lines of scrawl. */
function awizo(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  for (const x of [-48, 48]) k.line(x, -40, x, 40, 2);
  for (const y of [-20, 4, 28]) k.line(-48, y, 48, y, 1.6);
  k.line(-48, 40, -40, 48, 1.2);
  k.line(48, 40, 40, 48, 1.2);
  const pins: [number, number, number][] = [];
  for (const [x, y] of [[-36, -34], [-12, -36], [14, -33], [34, -37], [-30, -10], [4, -12], [28, -8], [-20, 14], [18, 16]] as const) {
    if (!r.chance(0.85)) continue;
    const tilt = r.range(-4, 4);
    k.shape([[x - 8, y - 6 + tilt], [x + 8, y - 6 - tilt], [x + 8, y + 9], [x - 8, y + 9]], { fill: 'paper', w: 1, jit: 0.4 });
    k.path(`M${x - 5} ${y}H${x + 5}M${x - 5} ${y + 3.4}H${x + 3}M${x - 5} ${y + 6.8}H${x + 5}`, { w: 0.6 });
    pins.push([x, y - 4 + tilt * 0.3, 1.5]);
  }
  k.dots(pins);
  parcel(k, -42, 10, -26, 28, 'hatch');
  parcel(k, 30, 34, 44, 40);
  return k.g;
}

/** A queue of hand trucks: four of them one behind the other, each with a parcel, nobody pushing. */
function kolejka(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  for (let i = 0; i < 4; i++) {
    const x = -42 + i * 26;
    const h = r.range(-2, 2);
    k.line(x, -34 + h, x, 28, 1.7);
    k.line(x + 9, -34 + h, x + 9, 28, 1.7);
    k.path(`M${x} ${-34 + h}Q${x + 4.5} ${-44 + h} ${x + 9} ${-34 + h}`, { w: 1.5 });
    k.line(x, -10, x + 9, -10, 1);
    k.shape([[x, 28], [x - 12, 28], [x - 12, 32], [x, 32]], { fill: 'hatch', w: 1.1, jit: 0.2 });
    parcel(k, x - 12, 4 + h, x, 28, i % 2 === 0 ? 'paper' : 'hatch');
    k.disc(x + 14, 30, 7, { fill: 'paper', w: 1.5 });
    k.disc(x + 14, 30, 2.4, { w: 0.9 });
  }
  return k.g;
}

registerDrawings('magazyn', { palety, regal, wozek, tasma, waga, tasmociag, paczki, 'wozek-reczny': wozekReczny, stos, awizo, kolejka });
