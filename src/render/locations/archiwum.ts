/**
 * Archiwum (STORY 8.10): the archive of recorded calls. Shelving of tape reels and cassette boxes as hatched rows (the stacks' walls),
 * filing drawers in long banks, a rolling ladder on its rail, a card catalogue, bound volumes, boxes labelled by year, a reading desk with a
 * lamp, dust sheets as hatched drapes on the floor, and the "CISZA" plate (the serwerownia's drawing, reused). Ink and hatching only; the
 * only lettering is digits (the years on the boxes, the numbers on the drawers).
 */
import type { Rng } from '../../core/rng';
import type { Obstacle } from '../../world/pages';
import { kit, type Kit } from './kit';
import { registerDrawings } from './registry';

/** A tape reel seen edge-on as a disc: a flange, a hub with three spokes, a tail of tape. */
function reel(k: Kit, cx: number, cy: number, rad: number): void {
  k.disc(cx, cy, rad, { fill: 'paper', w: 1.4 });
  k.disc(cx, cy, rad * 0.62, { w: 0.8 });
  k.disc(cx, cy, rad * 0.2, { fill: 'hatch', w: 0.9 });
  const sp: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    sp.push(`M${(cx + Math.cos(a) * rad * 0.2).toFixed(1)} ${(cy + Math.sin(a) * rad * 0.2).toFixed(1)}L${(cx + Math.cos(a) * rad * 0.62).toFixed(1)} ${(cy + Math.sin(a) * rad * 0.62).toFixed(1)}`);
  }
  k.path(sp.join(''), { w: 0.8 });
}

/** One bay of the tape stacks: a ruled shelf, then reels on edge or cassette boxes with a label slot each. */
function regal(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -150], [50, -150], [50, 150], [-50, 150]], { fill: 'hatch', w: 2, jit: 0.9 });
  k.shape([[-42, -142], [42, -142], [42, 142], [-42, 142]], { fill: 'paper', w: 1.3, jit: 0.6 });
  const bays = 6;
  const h = 284 / bays;
  for (let b = 0; b < bays; b++) {
    const y1 = -142 + (b + 1) * h;
    k.line(-42, y1, 42, y1, 1.6);
    if (b % 2 === 0) {
      reel(k, -22, y1 - 18.5, 16.5);
      reel(k, 12, y1 - 17.5, 15.5);
      k.shape([[28, y1 - 30], [38, y1 - 30], [38, y1 - 2], [28, y1 - 2]], { fill: 'hatch', w: 0.9, jit: 0.3 });
    } else {
      for (let i = 0; i < 5; i++) {
        const x0 = -38 + i * 15.4;
        const tall = r.range(30, 36);
        k.shape([[x0, y1 - tall], [x0 + 13, y1 - tall], [x0 + 13, y1 - 1], [x0, y1 - 1]], { fill: i % 2 === 0 ? 'paper' : 'hatch', w: 1.1, jit: 0.4 });
        k.path(`M${x0 + 2} ${y1 - tall + 5}H${x0 + 11}M${x0 + 2} ${y1 - tall + 9}H${x0 + 9}`, { w: 0.6 });
      }
    }
  }
  k.path('M-50 -146H50M-50 146H50', { w: 0.8 }).setAttribute('stroke-dasharray', '5 3');
  return k.g;
}

/** A bank of filing drawers seen from the front: a long cabinet, six drawers each with a label slot (a number) and a pull. */
function szuflady(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -24], [50, -24], [50, 22], [-50, 22]], { fill: 'paper', w: 2.2, jit: 0.7 });
  k.shape([[-50, 22], [50, 22], [50, 28], [-50, 28]], { fill: 'hatch', w: 1.1, jit: 0.3 });
  const w = 100 / 6;
  const open = r.int(0, 5);
  for (let i = 0; i < 6; i++) {
    const x0 = -50 + i * w;
    if (i > 0) k.line(x0, -24, x0, 22, 1);
    k.shape([[x0 + 3, -18], [x0 + w - 3, -18], [x0 + w - 3, -9], [x0 + 3, -9]], { w: 0.7, jit: 0.2 });
    k.mark(String(r.int(10, 99)), x0 + w / 2, -11, 5);
    k.path(`M${x0 + w / 2 - 3.5} 6Q${x0 + w / 2} 11 ${x0 + w / 2 + 3.5} 6`, { w: 1.2 });
    if (i === open) k.shape([[x0 + 2, -4], [x0 + w - 2, -4], [x0 + w - 2, 2], [x0 + 2, 2]], { fill: 'hatch', w: 0.8, jit: 0.2 });
  }
  return k.g;
}

/** A library ladder on a rail: two rails that splay a little, rungs, and a wheel at the head running on a rod. */
function drabinaPrzesuwna(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(-50, -56, 50, -56, 2.6);
  k.disc(-18, -56, 4, { fill: 'paper', w: 1.4 });
  k.disc(18, -56, 4, { fill: 'paper', w: 1.4 });
  k.line(-18, -52, -30, 56, 2.2);
  k.line(18, -52, 30, 56, 2.2);
  for (let i = 0; i < 9; i++) {
    const t0 = (i + 0.7) / 9.4;
    const half = 18 + t0 * 12;
    k.line(-half, -52 + t0 * 108, half, -52 + t0 * 108, 1.4);
  }
  k.shape([[-34, 56], [-24, 56], [-24, 62], [-34, 62]], { fill: 'hatch', w: 1, jit: 0.2 });
  k.shape([[24, 56], [34, 56], [34, 62], [24, 62]], { fill: 'hatch', w: 1, jit: 0.2 });
  return k.g;
}

/** A card catalogue: a cabinet of small drawers in a grid, each with a brass pull and a card in a holder, a number cast on the head. */
function katalog(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-46, -46], [46, -46], [46, 46], [-46, 46]], { fill: 'paper', w: 2.2, jit: 0.8 });
  k.shape([[-46, -46], [46, -46], [46, -36], [-46, -36]], { fill: 'hatch', w: 1.2, jit: 0.4 });
  k.mark(String(r.int(1, 9)), 0, -38.5, 8);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const x0 = -42 + col * 28;
      const y0 = -32 + row * 20;
      k.shape([[x0, y0], [x0 + 26, y0], [x0 + 26, y0 + 18], [x0, y0 + 18]], { w: 1, jit: 0.3 });
      k.shape([[x0 + 7, y0 + 2.5], [x0 + 19, y0 + 2.5], [x0 + 19, y0 + 7], [x0 + 7, y0 + 7]], { w: 0.6, jit: 0.2 });
      k.disc(x0 + 13, y0 + 12.5, 1.9, { fill: 'hatch', w: 0.9 });
    }
  }
  k.shape([[-40, 46], [-30, 46], [-30, 52], [-40, 52]], { fill: 'hatch', w: 1, jit: 0.2 });
  k.shape([[30, 46], [40, 46], [40, 52], [30, 52]], { fill: 'hatch', w: 1, jit: 0.2 });
  return k.g;
}

/** Bound volumes: a row of spines of different heights with bands, two leaning, one lying across the top. */
function tomy(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  let x = -46;
  let i = 0;
  while (x < 40) {
    const w = r.range(8, 13);
    const hgt = r.range(34, 52);
    k.shape([[x, 22 - hgt], [x + w, 22 - hgt], [x + w, 22], [x, 22]], { fill: i % 3 === 1 ? 'hatch' : 'paper', w: 1.4, jit: 0.4 });
    k.path(`M${x} ${22 - hgt + 6}H${x + w}M${x} ${22 - 6}H${x + w}`, { w: 0.8 });
    if (i % 2 === 0) k.line(x + w / 2, 22 - hgt + 11, x + w / 2, 22 - hgt + 22, 0.8);
    x += w + 1;
    i++;
  }
  k.shape([[-44, 22], [46, 22], [46, 28], [-44, 28]], { fill: 'hatch', w: 1.2, jit: 0.3 });
  k.shape([[-30, -34], [14, -30], [14, -22], [-30, -26]], { fill: 'paper', w: 1.4, jit: 0.4 });
  k.path('M-30 -30L14 -26', { w: 0.6 });
  return k.g;
}

/** Archive boxes stacked two high, each with a label holding a year (digits). */
function pudla(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const box = (x0: number, y0: number, x1: number, y1: number, lidHatch: boolean): void => {
    k.shape([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { fill: 'paper', w: 1.7, jit: 0.5 });
    k.shape([[x0 - 2, y0 - 6], [x1 + 2, y0 - 6], [x1 + 2, y0], [x0 - 2, y0]], { fill: lidHatch ? 'hatch' : 'paper', w: 1.3, jit: 0.3 });
    k.shape([[(x0 + x1) / 2 - 11, y0 + 6], [(x0 + x1) / 2 + 11, y0 + 6], [(x0 + x1) / 2 + 11, y0 + 17], [(x0 + x1) / 2 - 11, y0 + 17]], { w: 0.8, jit: 0.2 });
    k.mark(String(r.int(1971, 2012)), (x0 + x1) / 2, y0 + 14.5, 7.5);
    k.shape([[(x0 + x1) / 2 - 7, y1 - 9], [(x0 + x1) / 2 + 7, y1 - 9], [(x0 + x1) / 2 + 7, y1 - 6], [(x0 + x1) / 2 - 7, y1 - 6]], { w: 0.7, jit: 0.15 });
  };
  box(-44, 4, -4, 40, true);
  box(2, 4, 44, 40, false);
  box(-30, -40, 14, -6, false);
  return k.g;
}

/** A reading desk with a lamp: a sloped top, an open volume, a banker's lamp with a shade (hatched), a pull chain, two legs. */
function czytelnia(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-46, -4], [46, -4], [50, 8], [-50, 8]], { fill: 'paper', w: 2, jit: 0.6 });
  k.line(-40, 8, -40, 50, 2);
  k.line(40, 8, 40, 50, 2);
  k.line(-40, 30, 40, 30, 1.2);
  // the open volume
  k.shape([[-34, -4], [-4, -10], [-4, -22], [-34, -16]], { fill: 'paper', w: 1.2, jit: 0.3 });
  k.shape([[-2, -10], [28, -4], [28, -16], [-2, -22]], { fill: 'paper', w: 1.2, jit: 0.3 });
  k.path('M-28 -12L-10 -16M-28 -8L-10 -12M6 -17L22 -12M6 -13L22 -8', { w: 0.6 });
  // the lamp
  k.line(38, -4, 38, -34, 1.8);
  k.shape([[28, -34], [48, -34], [44, -48], [32, -48]], { fill: 'hatch', w: 1.4, jit: 0.3 });
  k.shape([[34, -4], [42, -4], [42, 0], [34, 0]], { fill: 'hatch', w: 1.1, jit: 0.2 });
  k.path('M31 -33Q26 -26 28 -20', { w: 0.8 });
  return k.g;
}

/** A dust sheet thrown over something: a hatched drape on the paper with fold lines and a hem, no body. A flat mark under everything. */
function plachta(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.path('M-44 -60Q-30 -70 -6 -64Q22 -72 42 -58Q52 -20 44 30Q50 56 30 64Q4 70 -18 62Q-42 66 -50 44Q-40 4 -44 -60Z', { fill: 'wide', w: 1.5 });
  k.path('M-20 -50Q-14 -10 -24 40M4 -56Q10 -6 0 54M26 -46Q30 0 24 46', { w: 0.8 });
  k.path('M-40 38Q-22 46 -4 40M-2 44Q18 52 36 44', { w: 0.9 });
  return k.g;
}

registerDrawings('archiwum', { regal, szuflady, 'drabina-przesuwna': drabinaPrzesuwna, katalog, tomy, pudla, czytelnia, plachta });
