/**
 * Miasto (STORY 8.8): the city of notifications, drawn for planet 4 and reused by planet 5. Tenements as tall hatched blocks with a
 * grid of windows and a badge on the door, a tram on a ruled rail, a bus shelter, a billboard on a pole (its lines are ink bars, no
 * lettering), a closed kiosk, a fountain drawn as a coffee ring, a lamppost, a notice column papered with slips, a letterbox with a
 * badge number, a timetable struck out, and two flat marks: a zebra crossing as ruled stripes and a manhole cover. Ink and hatching
 * only; the only lettering is digits.
 */
import type { Rng } from '../../core/rng';
import type { Obstacle } from '../../world/pages';
import { kit, type Kit } from './kit';
import { registerDrawings } from './registry';

/** A notification badge: a small ink-ringed disc carrying a number. */
function badge(k: Kit, x: number, y: number, rad: number, n: number): void {
  k.disc(x, y, rad, { fill: 'paper', w: 1.4 });
  k.mark(String(n), x, y + rad * 0.38, rad * 1.15);
}

/** A tenement: one tall block (a column of the street's wall), cornice, a grid of windows some shuttered in hatching, a door with a badge. */
function kamienica(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -138], [50, -138], [50, 150], [-50, 150]], { fill: 'paper', w: 2.4, jit: 0.9 });
  k.shape([[50, -138], [58, -130], [58, 158], [50, 150]], { fill: 'hatch', w: 1.6, jit: 0.4 });
  k.shape([[-54, -150], [54, -150], [50, -138], [-50, -138]], { fill: 'hatch', w: 1.8, jit: 0.5 });
  k.path('M-50 -122H50', { w: 0.8 });
  for (let row = 0; row < 8; row++) {
    const y0 = -112 + row * 31;
    for (let col = 0; col < 3; col++) {
      const x0 = -38 + col * 27;
      const shut = r.chance(0.28);
      k.shape([[x0, y0], [x0 + 18, y0], [x0 + 18, y0 + 22], [x0, y0 + 22]], { fill: shut ? 'hatch' : 'paper', w: 1.2, jit: 0.4 });
      if (!shut) k.path(`M${x0 + 9} ${y0}v22M${x0} ${y0 + 11}h18`, { w: 0.6 });
    }
  }
  // the door at the foot and the badge that grows on it
  k.shape([[-12, 122], [12, 122], [12, 150], [-12, 150]], { fill: 'hatch', w: 1.6, jit: 0.4 });
  k.path('M-16 120H16', { w: 1.2 });
  badge(k, 16, 112, 9, r.int(2, 99));
  return k.g;
}

/** A tram on a ruled rail: the body with a row of windows and two doors, a pantograph to the wire, wheels on a double line. */
function tramwaj(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-48, -22], [46, -22], [50, -14], [50, 12], [-50, 12], [-50, -14]], { fill: 'paper', w: 2.2, jit: 0.6 });
  k.shape([[-50, 4], [50, 4], [50, 12], [-50, 12]], { fill: 'hatch', w: 1.2, jit: 0.3 });
  for (let i = 0; i < 6; i++) {
    const x0 = -42 + i * 14;
    k.shape([[x0, -17], [x0 + 10, -17], [x0 + 10, -5], [x0, -5]], { fill: i === 2 || i === 4 ? 'hatch' : 'paper', w: 1, jit: 0.3 });
  }
  k.path('M-14 -22V4M-12 -22V4M18 -22V4M20 -22V4', { w: 0.8 });
  k.path('M-4 -22L4 -34H20L28 -22', { w: 1.1 });
  k.path('M-30 -44H46', { w: 0.9 }).setAttribute('stroke-dasharray', '6 3');
  k.path('M12 -34V-44', { w: 1.1 });
  k.mark(String(r.int(1, 24)), -44, -26, 8);
  k.disc(-34, 16, 4, { fill: 'paper', w: 1.3 });
  k.disc(-18, 16, 4, { fill: 'paper', w: 1.3 });
  k.disc(18, 16, 4, { fill: 'paper', w: 1.3 });
  k.disc(34, 16, 4, { fill: 'paper', w: 1.3 });
  k.path('M-56 22H56M-56 25H56', { w: 0.8 });
  let ties = '';
  for (let x = -52; x <= 52; x += 8) ties += `M${x} 21v5`;
  k.path(ties, { w: 0.6 });
  return k.g;
}

/** A bus shelter: two posts, a flat roof, a hatched back panel, a bench, a timetable plate with a number. */
function wiata(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-48, -34], [48, -34], [52, -26], [-44, -26]], { fill: 'hatch', w: 1.8, jit: 0.4 });
  k.path('M-44 -26V44M44 -26V44', { w: 2 });
  k.shape([[-42, -24], [42, -24], [42, 20], [-42, 20]], { fill: 'wide', w: 1, jit: 0.4 });
  k.path('M-30 -20L-18 -8M-12 -20L6 0', { w: 0.5 });
  k.shape([[-36, 20], [36, 20], [36, 26], [-36, 26]], { fill: 'paper', w: 1.6, jit: 0.3 });
  k.path('M-30 26v18M30 26v18', { w: 1.6 });
  k.shape([[22, -18], [38, -18], [38, 6], [22, 6]], { fill: 'paper', w: 1.2, jit: 0.3 });
  k.path('M25 -12h10M25 -8h10M25 -4h10M25 0h7', { w: 0.5 });
  k.mark(String(r.int(1, 24)), 30, -20, 6);
  return k.g;
}

/** A billboard on a pole: a framed panel with two ink bars for the offer (no lettering), a digit for the discount, a pole and a foot. */
function billboard(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -52], [50, -52], [50, 8], [-50, 8]], { fill: 'paper', w: 2.2, jit: 0.7 });
  k.shape([[-45, -47], [45, -47], [45, 3], [-45, 3]], { fill: 'hatch', w: 0.9, jit: 0.4 });
  k.shape([[-38, -40], [38, -40], [38, -22], [-38, -22]], { fill: 'paper', w: 1, jit: 0.4 });
  const bars = [[-34, -36, 22], [-8, -36, 10], [6, -36, 24], [-34, -28, 18], [-12, -28, 16], [8, -28, 22]];
  for (const [x, y, w] of bars) k.shape([[x ?? 0, y ?? 0], [(x ?? 0) + (w ?? 0), y ?? 0], [(x ?? 0) + (w ?? 0), (y ?? 0) + 4], [x ?? 0, (y ?? 0) + 4]], { fill: 'ink', w: 0.5, jit: 0.2 });
  k.shape([[-38, -17], [38, -17], [38, -1], [-38, -1]], { fill: 'paper', w: 1, jit: 0.3 });
  k.mark(`-${r.int(3, 9)}0`, 0, -5, 13);
  k.path('M-30 8L-34 20M30 8L34 20M-34 20H34', { w: 1.4 });
  k.shape([[-5, 20], [5, 20], [5, 92], [-5, 92]], { fill: 'hatch', w: 1.7, jit: 0.4 });
  k.shape([[-18, 92], [18, 92], [22, 100], [-22, 100]], { fill: 'paper', w: 1.8, jit: 0.4 });
  return k.g;
}

/** A kiosk, closed: a roof with a lip, the shutter down (hatched), a counter ledge, a number over the hatch. */
function budka(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-46, -8], [46, -8], [46, 70], [-46, 70]], { fill: 'paper', w: 2.2, jit: 0.8 });
  k.shape([[46, -8], [54, 0], [54, 78], [46, 70]], { fill: 'hatch', w: 1.5, jit: 0.4 });
  k.shape([[-54, -26], [54, -26], [46, -8], [-46, -8]], { fill: 'hatch', w: 1.9, jit: 0.5 });
  k.shape([[-36, 6], [36, 6], [36, 50], [-36, 50]], { fill: 'wide', w: 1.5, jit: 0.5 });
  let slats = '';
  for (let y = 12; y < 50; y += 6) slats += `M-36 ${y}H36`;
  k.path(slats, { w: 0.6 });
  k.shape([[-42, 50], [42, 50], [42, 56], [-42, 56]], { fill: 'paper', w: 1.5, jit: 0.3 });
  k.shape([[-12, -2], [12, -2], [12, 4], [-12, 4]], { fill: 'paper', w: 0.9, jit: 0.2 });
  k.mark(String(r.int(1, 9)), 0, 3.5, 6);
  k.dots([[-30, 62, 1.6], [30, 62, 1.6]]);
  return k.g;
}

/** A fountain drawn as a coffee ring: a stained ring (broken inner and outer outline), a pedestal in the middle with three jets. */
function fontanna(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const ring = (rad: number, from: number): string => {
    let d = '';
    for (let a = from; a < from + Math.PI * 2 - 0.2; a += 0.18) {
      const rr = rad + r.range(-1.6, 1.6);
      d += `${d ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr * 0.9).toFixed(1)}`;
    }
    return d;
  };
  k.path(ring(48, 0.2), { w: 2.4 });
  k.path(ring(40, 1.1), { w: 1.2 });
  k.path(ring(34, 2.4), { w: 0.7 });
  k.disc(0, 0, 40, { fill: 'wide', w: 0 }).setAttribute('stroke', 'none');
  k.disc(0, 4, 13, { fill: 'paper', w: 1.8 });
  k.path('M-13 4Q0 12 13 4', { w: 0.8 });
  k.path('M0 -8V-34M-4 -8Q-12 -26 -22 -22M4 -8Q12 -26 22 -22', { w: 1.2 });
  k.dots([[-24, -18, 1.4], [24, -18, 1.4], [0, -38, 1.6], [-8, -30, 1], [8, -30, 1]]);
  return k.g;
}

/** A lamppost: a base, a fluted pole, a curved arm with a head, two short strokes of light, a number plate. */
function latarnia(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-14, 44], [14, 44], [10, 30], [-10, 30]], { fill: 'hatch', w: 1.6, jit: 0.4 });
  k.shape([[-3, -52], [3, -52], [3, 30], [-3, 30]], { fill: 'paper', w: 1.8, jit: 0.4 });
  k.path('M0 -52Q0 -66 14 -66H24', { w: 1.8 });
  k.shape([[20, -69], [38, -69], [34, -60], [24, -60]], { fill: 'hatch', w: 1.6, jit: 0.3 });
  k.path('M24 -56l-3 6M29 -56v7M34 -56l3 6', { w: 0.7 });
  k.shape([[-9, 0], [9, 0], [9, 10], [-9, 10]], { fill: 'paper', w: 1, jit: 0.2 });
  k.mark(String(r.int(10, 99)), 0, 8, 7);
  return k.g;
}

/** A notice column: a drum with a cap, papered with slips (awizo) laid over each other at small angles, a torn one hanging. */
function slup(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.path('M-36 -52Q0 -64 36 -52L30 -44H-30Z', { fill: 'hatch', w: 1.9 });
  k.shape([[-32, -44], [32, -44], [32, 56], [-32, 56]], { fill: 'paper', w: 2, jit: 0.6 });
  k.shape([[-38, 56], [38, 56], [38, 66], [-38, 66]], { fill: 'hatch', w: 1.6, jit: 0.4 });
  for (let i = 0; i < 9; i++) {
    const x0 = -28 + (i % 3) * 19 + r.range(-3, 3);
    const y0 = -38 + Math.floor(i / 3) * 31 + r.range(-3, 3);
    const w = r.range(15, 21);
    const h = r.range(20, 27);
    k.shape([[x0, y0], [x0 + w, y0 + r.range(-2, 2)], [x0 + w, y0 + h], [x0, y0 + h]], { fill: i % 4 === 1 ? 'hatch' : 'paper', w: 0.9, jit: 0.8 });
    k.path(`M${(x0 + 2).toFixed(1)} ${(y0 + 6).toFixed(1)}h${(w - 5).toFixed(1)}M${(x0 + 2).toFixed(1)} ${(y0 + 10).toFixed(1)}h${(w - 8).toFixed(1)}`, { w: 0.4 });
  }
  return k.g;
}

/** A letterbox on a short post: a box with a slot, a flap, and a notification badge with a number stuck to its corner. */
function skrzynkaPocztowa(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.path('M0 22V62', { w: 2.2 });
  k.shape([[-12, 62], [12, 62], [8, 56], [-8, 56]], { fill: 'hatch', w: 1.3, jit: 0.3 });
  k.shape([[-34, -38], [34, -38], [34, 22], [-34, 22]], { fill: 'paper', w: 2.2, jit: 0.6 });
  k.shape([[34, -38], [40, -32], [40, 28], [34, 22]], { fill: 'hatch', w: 1.3, jit: 0.3 });
  k.shape([[-34, -38], [34, -38], [30, -48], [-30, -48]], { fill: 'hatch', w: 1.6, jit: 0.4 });
  k.shape([[-20, -22], [20, -22], [20, -16], [-20, -16]], { fill: 'ink', w: 0.6 });
  k.path('M-24 -2H24', { w: 0.8 });
  k.shape([[-12, 4], [12, 4], [12, 14], [-12, 14]], { fill: 'paper', w: 0.9, jit: 0.2 });
  badge(k, 30, -42, 13, r.int(2, 99));
  return k.g;
}

/** A timetable post with a plate of struck-out columns: digits in two columns, a long diagonal stroke across each. */
function rozklad(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.path('M0 14V74', { w: 2.2 });
  k.shape([[-12, 74], [12, 74], [8, 68], [-8, 68]], { fill: 'hatch', w: 1.3, jit: 0.3 });
  k.shape([[-34, -62], [34, -62], [34, 14], [-34, 14]], { fill: 'paper', w: 2, jit: 0.6 });
  k.shape([[-34, -62], [34, -62], [34, -48], [-34, -48]], { fill: 'hatch', w: 1.3, jit: 0.3 });
  k.mark(String(r.int(1, 24)), 0, -51, 9);
  for (let i = 0; i < 6; i++) {
    k.mark(`${r.int(4, 22)}.${r.int(10, 59)}`, -15, -38 + i * 8.5, 6.5);
    k.mark(`${r.int(4, 22)}.${r.int(10, 59)}`, 14, -38 + i * 8.5, 6.5);
  }
  k.line(-32, -46, 32, 10, 1.6);
  k.line(32, -46, -32, 10, 1.6);
  return k.g;
}

/** A zebra crossing: a flat mark of ruled stripes across the street, edges drawn by hand, the stripes hatched. */
function pasy(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  for (let i = 0; i < 9; i++) {
    const x0 = -46 + i * 10.4;
    k.shape([[x0, -140], [x0 + 6, -140], [x0 + 6, 140], [x0, 140]], { fill: 'hatch', w: 0.9, jit: 0.9 });
  }
  k.path('M-50 -146H50M-50 146H50', { w: 0.8 }).setAttribute('stroke-dasharray', '5 3');
  return k.g;
}

/** A manhole cover: a flat disc with a ring, a grid of dots and a cross of two ruled lines, a number cast in. */
function wlaz(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.disc(0, 0, 46, { fill: 'paper', w: 1.8 });
  k.disc(0, 0, 38, { w: 0.9 });
  let rules = '';
  for (let y = -26; y <= 26; y += 13) rules += `M${-Math.sqrt(38 * 38 - y * y) + 4} ${y}H${Math.sqrt(38 * 38 - y * y) - 4}`;
  k.path(rules, { w: 0.7 });
  k.dots([[-16, -6, 1.6], [0, -6, 1.6], [16, -6, 1.6], [-16, 7, 1.6], [0, 7, 1.6], [16, 7, 1.6]]);
  k.mark(String(r.int(10, 99)), 0, -30, 9);
  return k.g;
}

/** A shop window: a frame with a hatched display (two shapes on a plinth), a price tag with the price and, struck through, the old price. */
function vitryna(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -44], [50, -44], [50, 30], [-50, 30]], { fill: 'paper', w: 2.3, jit: 0.7 });
  k.shape([[-45, -39], [45, -39], [45, 25], [-45, 25]], { fill: 'hatch', w: 1, jit: 0.4 });
  k.shape([[-36, -4], [-10, -4], [-10, 25], [-36, 25]], { fill: 'paper', w: 1.2, jit: 0.4 });
  k.disc(14, 8, 12, { fill: 'paper', w: 1.2 });
  k.shape([[-6, 25], [34, 25], [34, 30], [-6, 30]], { fill: 'paper', w: 1, jit: 0.2 });
  // the price tag with the old price struck through and the new one under it
  k.shape([[16, -36], [42, -36], [42, -12], [16, -12]], { fill: 'paper', w: 1.3, jit: 0.3 });
  k.mark(String(r.int(40, 99)), 29, -26, 7);
  k.line(19, -29, 39, -24, 1.1);
  k.mark(String(r.int(10, 39)), 29, -16, 8);
  k.path('M-50 30L-56 38H56L50 30', { w: 1.4 });
  return k.g;
}

/** A sale banner strung across the street between two posts: a hatched strip with the percentage in hatched digits, the strings sagging. */
function baner(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  for (const x of [-46, 46]) {
    k.shape([[x - 3, -40], [x + 3, -40], [x + 3, 36], [x - 3, 36]], { fill: 'hatch', w: 1.5, jit: 0.4 });
    k.shape([[x - 8, 36], [x + 8, 36], [x + 10, 42], [x - 10, 42]], { fill: 'paper', w: 1.3, jit: 0.3 });
  }
  k.path('M-43 -34Q0 -26 43 -34M-43 -4Q0 4 43 -4', { w: 1 });
  k.shape([[-40, -30], [40, -30], [40, -8], [-40, -8]], { fill: 'paper', w: 1.8, jit: 0.6 });
  k.shape([[-36, -27], [36, -27], [36, -11], [-36, -11]], { fill: 'hatch', w: 0.8, jit: 0.3 });
  k.shape([[-26, -25], [26, -25], [26, -13], [-26, -13]], { fill: 'paper', w: 0.9, jit: 0.3 });
  k.mark('-70%', 0, -15, 13);
  return k.g;
}

/** A delivery van at the kerb, side on: a box body with a hatched stripe, a cab with a window, two wheels, a roller door, a kerb line. */
function furgon(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -34], [14, -34], [14, 22], [-50, 22]], { fill: 'paper', w: 2.2, jit: 0.6 });
  k.shape([[-50, 4], [14, 4], [14, 12], [-50, 12]], { fill: 'hatch', w: 0.9, jit: 0.3 });
  k.path('M-36 -34V4M-22 -34V4M-8 -34V4', { w: 0.6 });
  k.shape([[14, -18], [34, -18], [48, -2], [50, 22], [14, 22]], { fill: 'paper', w: 2.2, jit: 0.6 });
  k.shape([[20, -13], [32, -13], [42, -2], [20, -2]], { fill: 'hatch', w: 1, jit: 0.3 });
  k.disc(-30, 24, 8, { fill: 'paper', w: 1.8 });
  k.disc(30, 24, 8, { fill: 'paper', w: 1.8 });
  k.disc(-30, 24, 2.4, { fill: 'hatch', w: 0.9 });
  k.disc(30, 24, 2.4, { fill: 'hatch', w: 0.9 });
  k.mark(String(r.int(10, 99)), -18, -16, 12);
  k.path('M-56 33H56', { w: 1.2 });
  return k.g;
}

/** A stack of flattened boxes: sheets of cardboard lying on each other, corrugation as ruled lines, a strap, the top one lifting at a corner. */
function kartonyPlaskie(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  for (let i = 0; i < 4; i++) {
    const y = 20 - i * 9;
    const j = r.range(-3, 3);
    k.shape([[-42 + j, y], [44 + j, y - 2], [46 + j, y + 8], [-44 + j, y + 9]], { fill: i % 2 === 0 ? 'paper' : 'hatch', w: 1.5, jit: 0.4 });
  }
  k.path('M-30 -4L-30 -14M0 -2L0 -14M30 -4L30 -14', { w: 0.7 });
  k.shape([[-30, -16], [34, -18], [40, -34], [-22, -30]], { fill: 'paper', w: 1.6, jit: 0.4 });
  k.path('M-24 -26L34 -28M-20 -22L30 -24', { w: 0.6 });
  k.path('M-16 -2V24M16 -4V24', { w: 1.1 });
  return k.g;
}

/** A shop mannequin: a faceless head, a torso with a sash, a stand on a round foot; a badge with a number pinned to the chest. */
function manekin(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.disc(0, -44, 10, { fill: 'paper', w: 1.8 });
  k.line(0, -34, 0, -28, 2);
  k.path('M-22 -26Q-26 -4 -16 22L16 22Q26 -4 22 -26Q0 -34 -22 -26Z', { fill: 'paper', w: 2 });
  k.path('M-22 -22L22 -6', { w: 1.4 });
  k.path('M-16 10Q0 16 16 10', { w: 0.8 });
  k.line(0, 22, 0, 52, 2);
  k.shape([[-20, 52], [20, 52], [24, 58], [-24, 58]], { fill: 'hatch', w: 1.5, jit: 0.3 });
  badge(k, 8, -14, 8, r.int(1, 24));
  return k.g;
}

registerDrawings('miasto', { vitryna, baner, furgon, 'kartony-plaskie': kartonyPlaskie, manekin, kamienica, tramwaj, wiata, billboard, budka, fontanna, latarnia, slup, 'skrzynka-pocztowa': skrzynkaPocztowa, rozklad, pasy, wlaz });
