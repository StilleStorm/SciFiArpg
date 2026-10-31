/**
 * Centrum obslugi (STORY 8.9): the customer-service and fulfilment hall behind the shop streets. Long counters as ruled bars with
 * numbered windows, a rope queue, a wall of parcel lockers three wide, a returns desk with a bin, a mountain of cardboard boxes, a
 * barcode scanner on a stand, a stand with five rating stars, a chat bubble on a pole (offline), shopping carts nested in a row. The
 * parcel conveyor of the magazyn is reused (`tasmociag`). Ink and hatching only; the only lettering is digits.
 */
import type { Rng } from '../../core/rng';
import type { Obstacle } from '../../world/pages';
import { kit, parcel, type Pt } from './kit';
import { registerDrawings } from './registry';

/** A counter: four windows behind hatched panes, each with a number plate and a slot, a bell, a seamed front panel. */
function lada(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const nums = [r.int(1, 3), r.int(4, 5), r.int(6, 7), r.int(8, 9)];
  const xs = [-37.5, -12.5, 12.5, 37.5];
  xs.forEach((cx, i) => {
    k.shape([[cx - 11, -46], [cx + 11, -46], [cx + 11, -14], [cx - 11, -14]], { fill: 'paper', w: 1.5, jit: 0.4 });
    k.shape([[cx - 8, -43], [cx + 8, -43], [cx + 8, -17], [cx - 8, -17]], { fill: 'hatch', w: 0.7, jit: 0.3 });
    k.shape([[cx - 6, -60], [cx + 6, -60], [cx + 6, -49], [cx - 6, -49]], { fill: 'paper', w: 1.3, jit: 0.3 });
    k.mark(String(nums[i]), cx, -51, 9);
    k.path(`M${cx - 7} -13Q${cx} -19 ${cx + 7} -13`, { w: 1 });
  });
  k.line(-50, -48, -50, -12, 2);
  k.line(50, -48, 50, -12, 2);
  k.line(-50, -48, 50, -48, 1.3);
  // the slab, the bell, the front panel with seams
  k.shape([[-52, -12], [52, -12], [52, -4], [-52, -4]], { fill: 'paper', w: 2, jit: 0.5 });
  k.disc(-26, -15, 3, { fill: 'hatch', w: 1.1 });
  k.line(-26, -18, -26, -20, 1);
  k.shape([[-50, -4], [50, -4], [50, 18], [-50, 18]], { fill: 'paper', w: 1.9, jit: 0.6 });
  k.path('M-25 -4v22M0 -4v22M25 -4v22', { w: 0.9 });
  k.shape([[-50, 18], [50, 18], [50, 23], [-50, 23]], { fill: 'hatch', w: 1.1, jit: 0.3 });
  return k.g;
}

/** A rope queue: five posts with ball tops on hatched feet, the rope sagging between them, a hanging number tag. */
function sznur(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const xs = [-40, -20, 0, 20, 40];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i] ?? 0;
    k.shape([[x - 6, 20], [x + 6, 20], [x + 8, 26], [x - 8, 26]], { fill: 'hatch', w: 1.3, jit: 0.2 });
    k.line(x, -18, x, 20, 2.2);
    k.disc(x, -21, 3.2, { fill: 'paper', w: 1.4 });
    const nx = xs[i + 1];
    if (nx !== undefined) k.path(`M${x} -17Q${(x + nx) / 2} ${-4 + r.range(-1, 1)} ${nx} -17`, { w: 1.6 });
  }
  k.shape([[-3, -4], [3, -4], [3, 4], [-3, 4]], { fill: 'paper', w: 0.8, jit: 0.15 });
  k.mark(String(r.int(2, 9)), 0, 2.4, 5);
  return k.g;
}

/** A wall of parcel lockers three wide: a hatched head strip, a screen with a keypad in the middle column, rows of numbered doors, one ajar. */
function paczkomaty(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -70], [50, -70], [50, 72], [-50, 72]], { fill: 'paper', w: 2.3, jit: 0.8 });
  k.shape([[-50, -70], [50, -70], [50, -58], [-50, -58]], { fill: 'hatch', w: 1.6, jit: 0.4 });
  k.shape([[50, -70], [58, -62], [58, 80], [50, 72]], { fill: 'hatch', w: 1.4, jit: 0.4 });
  const open = r.int(0, 2);
  [-33, 0, 33].forEach((cx, c) => {
    if (c > 0) k.line(cx - 16.5, -58, cx - 16.5, 72, 1);
    const top = c === 1 ? -26 : -52;
    if (c === 1) {
      k.shape([[-12, -54], [12, -54], [12, -38], [-12, -38]], { fill: 'hatch', w: 1.2, jit: 0.3 });
      const keys: [number, number, number][] = [];
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) keys.push([-5 + a * 5, -32 + b * 2.5, 0.8]);
      k.dots(keys);
    }
    const rows = c === 1 ? 4 : 5;
    const h = (72 - 4 - top) / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        const x0 = cx - 15 + col * 15;
        const y0 = top + row * h + 1;
        if (c === open && row === 1 && col === 0) {
          k.shape([[x0, y0], [x0 + 12, y0], [x0 + 12, y0 + h - 2], [x0, y0 + h - 2]], { fill: 'hatch', w: 1, jit: 0.2 });
          k.shape([[x0 + 12, y0], [x0 + 20, y0 - 2], [x0 + 20, y0 + h - 4], [x0 + 12, y0 + h - 2]], { fill: 'paper', w: 1.1, jit: 0.2 });
          continue;
        }
        k.shape([[x0, y0], [x0 + 13, y0], [x0 + 13, y0 + h - 2], [x0, y0 + h - 2]], { w: 0.9, jit: 0.25 });
        if ((row + col + c) % 2 === 0) k.mark(String(r.int(10, 99)), x0 + 6.5, y0 + 6.5, 6);
        k.dots([[x0 + 10.5, y0 + (h - 2) / 2 + 3, 0.8]]);
      }
    }
  });
  return k.g;
}

/** A returns desk: a slab on a panel with a stack of returned parcels and a roll of tape, a sign on a pole with a U-turn arrow, a bin with a lid. */
function zwroty(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  // sign: a plate on a pole with an arrow turned back on itself
  k.line(-34, -26, -34, 8, 2);
  k.shape([[-50, -70], [-18, -70], [-18, -28], [-50, -28]], { fill: 'paper', w: 1.9, jit: 0.5 });
  k.path('M-26 -36V-56Q-26 -62 -34 -62Q-42 -62 -42 -56V-48M-46 -52L-42 -46L-38 -52', { w: 1.8 });
  // desk
  k.shape([[-50, 8], [16, 8], [16, 18], [-50, 18]], { fill: 'paper', w: 2, jit: 0.5 });
  k.shape([[-48, 18], [14, 18], [14, 58], [-48, 58]], { fill: 'paper', w: 1.7, jit: 0.6 });
  k.shape([[-40, 26], [-8, 26], [-8, 50], [-40, 50]], { fill: 'hatch', w: 0.9, jit: 0.3 });
  // returned parcels on the desk, a tape roll
  parcel(k, -2, -12, 14, 8, 'hatch');
  parcel(k, -14, -4, 0, 8);
  k.disc(-26, 3, 4.6, { fill: 'paper', w: 1.2 });
  k.disc(-26, 3, 1.6, { w: 0.8 });
  // the bin
  k.shape([[26, -8], [50, -8], [46, 58], [30, 58]], { fill: 'hatch', w: 1.9, jit: 0.5 });
  k.shape([[23, -18], [53, -18], [53, -8], [23, -8]], { fill: 'paper', w: 1.9, jit: 0.4 });
  k.path('M28 4V50M38 4V50', { w: 0.7 });
  k.path('M34 -18V-23', { w: 1.2 });
  return k.g;
}

/** A mountain of cardboard boxes: three rows narrowing upward, alternate boxes hatched, torn flaps on the top ones, one fallen to the side. */
function kartony(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const rows: { y0: number; y1: number; n: number }[] = [
    { y0: 8, y1: 40, n: 4 },
    { y0: -22, y1: 8, n: 3 },
    { y0: -50, y1: -22, n: 2 },
  ];
  rows.forEach((row, i) => {
    const w = (96 - i * 24) / row.n;
    const x0 = -48 + i * 12;
    for (let j = 0; j < row.n; j++) {
      const a = x0 + j * w + r.range(-1, 1);
      parcel(k, a, row.y0, a + w - 1, row.y1, (i + j) % 2 === 0 ? 'hatch' : 'paper');
    }
  });
  // flaps of the top row, a box fallen at the right
  k.shape([[-24, -50], [-34, -62], [-12, -58]], { fill: 'paper', w: 1.2, jit: 0.3 });
  k.shape([[0, -50], [10, -64], [20, -52]], { fill: 'paper', w: 1.2, jit: 0.3 });
  k.shape([[34, 22], [58, 28], [54, 40], [30, 36]], { fill: 'paper', w: 1.4, jit: 0.4 });
  k.path('M44 25L42 38', { w: 0.8 });
  k.path('M-52 42h106', { w: 0.7 }).setAttribute('stroke-dasharray', '3 3');
  return k.g;
}

/** A barcode scanner on a stand: a weighted foot, a post, a cradle with a hand scanner and its dashed beam, a box with a barcode label. */
function skaner(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-36, 90], [36, 90], [44, 104], [-44, 104]], { fill: 'hatch', w: 1.8, jit: 0.4 });
  k.line(0, 6, 0, 90, 3);
  // cradle and the scanner in it
  k.shape([[-20, -4], [20, -4], [14, 12], [-14, 12]], { fill: 'paper', w: 1.8, jit: 0.4 });
  k.shape([[-26, -40], [18, -40], [24, -20], [24, -10], [6, -10], [2, -20], [-26, -20]], { fill: 'paper', w: 2, jit: 0.5 });
  k.shape([[-22, -36], [10, -36], [10, -26], [-22, -26]], { fill: 'hatch', w: 0.8, jit: 0.2 });
  k.shape([[6, -10], [14, -10], [12, 4], [4, 4]], { fill: 'paper', w: 1.5, jit: 0.3 });
  const beam = k.path('M-26 -30L-48 -44M-26 -30L-52 -30M-26 -30L-48 -16', { w: 1.1 });
  beam.setAttribute('stroke-dasharray', '3 3');
  // a label with bars on the side
  k.shape([[-44, 44], [-12, 44], [-12, 72], [-44, 72]], { fill: 'paper', w: 1.3, jit: 0.4 });
  let bars = '';
  for (let x = -40; x < -16; x += 3 + r.int(0, 2)) bars += `M${x} 50V66`;
  k.path(bars, { w: 1.1 });
  return k.g;
}

const star = (cx: number, cy: number, big: number, small: number): Pt[] =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? big : small;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad] as Pt;
  });

/** A rating stand: a board on a pole with five stars in a row, the first ones hatched, the last ones empty; a hatched head strip. */
function gwiazdki(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(0, 30, 0, 96, 3);
  k.shape([[-28, 96], [28, 96], [34, 106], [-34, 106]], { fill: 'hatch', w: 1.8, jit: 0.4 });
  k.shape([[-50, -40], [50, -40], [50, 30], [-50, 30]], { fill: 'paper', w: 2.2, jit: 0.7 });
  k.shape([[-50, -40], [50, -40], [50, -26], [-50, -26]], { fill: 'hatch', w: 1.4, jit: 0.4 });
  const lit = r.int(2, 4);
  for (let i = 0; i < 5; i++) {
    const cx = -36 + i * 18;
    k.shape(star(cx, 0, 9, 4), { fill: i < lit ? 'hatch' : 'none', w: 1.3, jit: 0.3 });
  }
  k.path('M-40 20h80', { w: 0.7 }).setAttribute('stroke-dasharray', '2 3');
  return k.g;
}

/** A chat bubble on a pole, offline: a dashed bubble with three empty dots, its plug lying unplugged on the floor. */
function czat(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(0, 22, 0, 94, 2.6);
  k.shape([[-20, 94], [20, 94], [26, 104], [-26, 104]], { fill: 'hatch', w: 1.7, jit: 0.4 });
  const bubble = k.path('M-42 -58Q-42 -80 -20 -80H20Q42 -80 42 -58Q42 -36 20 -36H6L-4 -18L-8 -36H-20Q-42 -36 -42 -58Z', { fill: 'paper', w: 2 });
  bubble.setAttribute('stroke-dasharray', '6 3');
  for (const x of [-16, 0, 16]) k.disc(x, -58, 4.5, { w: 1.2 });
  // the cable ends short of its socket
  k.path('M0 94Q-26 100 -34 88', { w: 1.3 });
  k.shape([[-42, 84], [-34, 84], [-34, 92], [-42, 92]], { fill: 'paper', w: 1.1, jit: 0.2 });
  return k.g;
}

/** Shopping carts nested in a row, seen from the side: wire baskets as wide hatching, a handle bar, wheels; each stands a step ahead of the last. */
function wozki(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const cart = (dx: number, front: boolean): void => {
    const s = 0.78;
    const P = (x: number, y: number): Pt => [dx + x * s, y * s];
    k.shape([P(-24, -22), P(20, -22), P(11, 8), P(-18, 8)], { fill: front ? 'wide' : 'paper', w: 1.5, jit: 0.3 });
    k.shape([P(-22, -14), P(18, -14), P(11, -14)], { w: 0.7, closed: false, jit: 0.1 });
    k.path(`M${dx + -24 * s} ${-22 * s}L${dx + -38 * s} ${-34 * s}H${dx + -46 * s}`, { w: 1.8 });
    k.path(`M${dx + -18 * s} ${8 * s}L${dx + -14 * s} ${18 * s}M${dx + 11 * s} ${8 * s}L${dx + 8 * s} ${18 * s}M${dx + -14 * s} ${18 * s}H${dx + 8 * s}`, { w: 1.2 });
    k.disc(dx - 14 * s, 22 * s, 3.4, { fill: 'paper', w: 1.2 });
    k.disc(dx + 8 * s, 22 * s, 3.4, { fill: 'paper', w: 1.2 });
  };
  for (let i = 0; i < 5; i++) cart(-30 + i * 17, i === 4);
  // the coin token slot on the front handle
  k.disc(34, -26, 2.2, { fill: 'ink', w: 1 });
  return k.g;
}

registerDrawings('centrum', { lada, sznur, paczkomaty, zwroty, kartony, skaner, gwiazdki, czat, wozki });
