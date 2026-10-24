/**
 * Biuro (STORY 8.3): the regional office of the Komisja. Desks with a monitor, filing cabinets with numbered drawers, a water cooler,
 * a potted plant in hatching, a photocopier, partitions as ruled rectangles (a long one and a tall one), a row of waiting chairs, a
 * numbered ticket dispenser and a clock on a post with two hour hands. Ink and hatching only, no fills but paper and hatch; the only
 * lettering is digits.
 */
import { createRng, type Rng } from '../../core/rng';
import type { Obstacle } from '../../world/pages';
import { kit, type Kit } from './kit';
import { registerDrawings } from './registry';

/** A desk: the slab on a drawer pedestal and a panel leg, a monitor with a stand, a keyboard line, a paper tray with a sheet. */
function biurko(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  // monitor
  k.shape([[-30, -46], [-6, -46], [-6, -18], [-30, -18]], { fill: 'paper', w: 1.8, jit: 0.5 });
  k.shape([[-27, -43], [-9, -43], [-9, -21], [-27, -21]], { fill: 'hatch', w: 0.8, jit: 0.3 });
  k.line(-18, -18, -18, -9, 1.6);
  k.line(-26, -9, -10, -9, 1.6);
  // keyboard and paper tray
  k.shape([[-40, -6], [-8, -6], [-8, -2], [-40, -2]], { fill: 'paper', w: 1.2, jit: 0.3 });
  k.path('M-37 -4h28', { w: 0.6 }).setAttribute('stroke-dasharray', '1.5 1.5');
  k.shape([[16, -22], [38, -22], [38, -4], [16, -4]], { w: 1.3, jit: 0.4 });
  k.shape([[19, -12], [35, -14], [35, -9], [19, -8]], { fill: 'paper', w: 0.9, jit: 0.3 });
  k.path('M21 -11h11M21 -9.5h8', { w: 0.5 });
  // the slab
  k.shape([[-50, -2], [50, -2], [50, 8], [-50, 8]], { fill: 'paper', w: 2, jit: 0.5 });
  // legs: a drawer pedestal on the right, a panel on the left
  k.shape([[22, 8], [48, 8], [48, 56], [22, 56]], { fill: 'paper', w: 1.8, jit: 0.5 });
  k.path('M22 24h26M22 40h26', { w: 1.1 });
  k.path('M32 16h6M32 32h6M32 48h6', { w: 1.4 });
  k.shape([[-48, 8], [-44, 8], [-44, 56], [-48, 56]], { fill: 'hatch', w: 1.3, jit: 0.3 });
  k.path('M-44 14h50M6 14v8', { w: 0.8 });
  return k.g;
}

/** A filing cabinet: four drawers, each with a handle and a card holder carrying a number. */
function kartoteka(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-42, -104], [42, -104], [42, 104], [-42, 104]], { fill: 'paper', w: 2.4, jit: 0.9 });
  k.shape([[42, -104], [50, -96], [50, 112], [42, 104]], { fill: 'hatch', w: 1.6, jit: 0.4 });
  const digits = [String(r.int(10, 39)), String(r.int(40, 59)), String(r.int(60, 79)), String(r.int(80, 99))];
  for (let i = 0; i < 4; i++) {
    const y0 = -98 + i * 51;
    k.shape([[-37, y0], [37, y0], [37, y0 + 46], [-37, y0 + 46]], { w: 1.3, jit: 0.5 });
    k.shape([[-17, y0 + 8], [17, y0 + 8], [17, y0 + 22], [-17, y0 + 22]], { w: 0.9, jit: 0.3 });
    k.mark(digits[i] ?? '00', 0, y0 + 20, 12);
    k.path(`M-10 ${y0 + 33}Q0 ${y0 + 38} 10 ${y0 + 33}`, { w: 1.8 });
  }
  k.shape([[-38, 104], [-30, 104], [-30, 110], [-38, 110]], { fill: 'hatch', w: 1, jit: 0.2 });
  k.shape([[30, 104], [38, 104], [38, 110], [30, 110]], { fill: 'hatch', w: 1, jit: 0.2 });
  return k.g;
}

/** A water cooler: a jug turned over a cabinet, two taps, a stack of cups, a few bubbles in the jug. */
function dystrybutor(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-34, -4], [34, -4], [34, 100], [-34, 100]], { fill: 'paper', w: 2.2, jit: 0.8 });
  k.shape([[34, -4], [44, 4], [44, 106], [34, 100]], { fill: 'hatch', w: 1.5, jit: 0.4 });
  k.shape([[-34, -4], [34, -4], [28, -14], [-28, -14]], { fill: 'hatch', w: 1.6, jit: 0.4 });
  k.path('M-26 -14Q-34 -34 -28 -70Q-22 -94 0 -98Q22 -94 28 -70Q34 -34 26 -14Z', { fill: 'paper', w: 2 });
  k.path('M-26 -50Q-12 -54 0 -50T26 -50', { w: 0.9 });
  k.dots([[-10, -34, 1.4], [6, -28, 1.1], [-2, -66, 1.2], [12, -74, 1.4], [-14, -78, 1]]);
  k.shape([[-14, 14], [-4, 14], [-4, 24], [-14, 24]], { fill: 'hatch', w: 1.2, jit: 0.2 });
  k.shape([[4, 14], [14, 14], [14, 24], [4, 24]], { fill: 'paper', w: 1.2, jit: 0.2 });
  k.path('M-9 24v8M9 24v8', { w: 1.6 });
  k.shape([[-12, 50], [12, 50], [10, 76], [-10, 76]], { fill: 'paper', w: 1.3, jit: 0.3 });
  k.path('M-11 58h22M-10 66h20', { w: 0.7 });
  return k.g;
}

/** A potted plant in hatching: a tapering pot with a rim, eight leaves on curved stems, a saucer. */
function roslina(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-26, 38], [26, 38], [20, 92], [-20, 92]], { fill: 'hatch', w: 2, jit: 0.8 });
  k.shape([[-31, 30], [31, 30], [31, 42], [-31, 42]], { fill: 'paper', w: 1.8, jit: 0.5 });
  k.shape([[-26, 92], [26, 92], [30, 98], [-30, 98]], { fill: 'paper', w: 1.5, jit: 0.4 });
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + ((i - 3.5) / 3.5) * 1.15 + r.range(-0.08, 0.08);
    const len = r.range(54, 78);
    const tx = Math.cos(a) * len;
    const ty = 30 + Math.sin(a) * len;
    const mx = Math.cos(a) * len * 0.55 + (tx > 0 ? 8 : -8);
    const my = 30 + Math.sin(a) * len * 0.55;
    const nx = -Math.sin(a) * 12;
    const ny = Math.cos(a) * 12;
    k.path(`M0 32Q${mx.toFixed(1)} ${my.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`, { w: 1.1 });
    k.path(`M${(tx - Math.cos(a) * 30).toFixed(1)} ${(ty - Math.sin(a) * 30).toFixed(1)}Q${(tx - Math.cos(a) * 14 + nx).toFixed(1)} ${(ty - Math.sin(a) * 14 + ny).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}Q${(tx - Math.cos(a) * 14 - nx).toFixed(1)} ${(ty - Math.sin(a) * 14 - ny).toFixed(1)} ${(tx - Math.cos(a) * 30).toFixed(1)} ${(ty - Math.sin(a) * 30).toFixed(1)}Z`, { fill: 'hatch', w: 1.4 });
  }
  return k.g;
}

/** A photocopier: a lid over a glass, a body with a control panel (a counter showing the copies), a tray with a sheet coming out. */
function kserokopiarka(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-48, -4], [48, -4], [48, 52], [-48, 52]], { fill: 'paper', w: 2.2, jit: 0.7 });
  k.shape([[-48, 30], [48, 30], [48, 52], [-48, 52]], { fill: 'hatch', w: 1.3, jit: 0.4 });
  k.shape([[-50, -20], [50, -20], [46, -4], [-46, -4]], { fill: 'paper', w: 2, jit: 0.5 });
  k.path('M-40 -12h80', { w: 0.7 });
  k.shape([[8, 4], [40, 4], [40, 18], [8, 18]], { w: 1.1, jit: 0.3 });
  k.mark(String(r.int(2, 9)).padStart(2, '0'), 24, 15, 11);
  k.dots([[-34, 10, 1.8], [-26, 10, 1.8], [-18, 10, 1.8]]);
  k.shape([[-34, 20], [-6, 20], [-6, 26], [-34, 26]], { fill: 'ink', w: 1 });
  // the output tray with a sheet half out of it, and the paper drawer
  k.shape([[48, 12], [66, 16], [66, 22], [48, 20]], { fill: 'paper', w: 1.4, jit: 0.3 });
  k.shape([[54, 6], [74, 8], [72, 20], [52, 18]], { fill: 'paper', w: 1, jit: 0.4 });
  k.path('M57 11h12M57 14h9', { w: 0.5 });
  k.path('M-44 42h88', { w: 0.8 });
  k.shape([[-44, 52], [-38, 52], [-38, 58], [-44, 58]], { fill: 'hatch', w: 1, jit: 0.2 });
  k.shape([[38, 52], [44, 52], [44, 58], [38, 58]], { fill: 'hatch', w: 1, jit: 0.2 });
  return k.g;
}

/** A partition as a ruled rectangle: a hatched frame, a paper panel ruled like a sheet, a pinned notice, two feet. */
function przepierzenie(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -24], [50, -24], [50, 24], [-50, 24]], { fill: 'hatch', w: 2, jit: 0.7 });
  k.shape([[-45, -19], [45, -19], [45, 19], [-45, 19]], { fill: 'paper', w: 1.2, jit: 0.4 });
  let d = '';
  for (let y = -11; y <= 15; y += 8) d += `M-45 ${y}H45`;
  k.path(d, { w: 0.6 });
  k.path('M-36 -19V19', { w: 0.9 });
  const nx = r.range(-8, 22);
  k.shape([[nx, -15], [nx + 14, -15], [nx + 14, -2], [nx, -2]], { fill: 'paper', w: 0.9, jit: 0.3 });
  k.dots([[nx + 7, -14, 1]]);
  k.shape([[-34, 24], [-26, 24], [-26, 30], [-34, 30]], { fill: 'hatch', w: 1, jit: 0.2 });
  k.shape([[26, 24], [34, 24], [34, 30], [26, 30]], { fill: 'hatch', w: 1, jit: 0.2 });
  return k.g;
}

/** The tall partition: the same panel stood upright, ruled across, with the hatched edge on the right. */
function przepierzenieBoczne(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-34, -136], [34, -136], [34, 136], [-34, 136]], { fill: 'hatch', w: 2.4, jit: 0.9 });
  k.shape([[-27, -129], [27, -129], [27, 129], [-27, 129]], { fill: 'paper', w: 1.3, jit: 0.5 });
  let d = '';
  for (let y = -112; y <= 120; y += 18) d += `M-27 ${y}H27`;
  k.path(d, { w: 0.7 });
  k.path('M-14 -129V129', { w: 1 });
  const ny = r.range(-90, 40);
  k.shape([[-6, ny], [20, ny], [20, ny + 28], [-6, ny + 28]], { fill: 'paper', w: 1.1, jit: 0.4 });
  k.path(`M-2 ${ny + 8}h14M-2 ${ny + 14}h12M-2 ${ny + 20}h9`, { w: 0.6 });
  k.dots([[7, ny + 3, 1.4]]);
  k.shape([[-30, 136], [-14, 136], [-14, 146], [-30, 146]], { fill: 'hatch', w: 1.2, jit: 0.2 });
  k.shape([[14, 136], [30, 136], [30, 146], [14, 146]], { fill: 'hatch', w: 1.2, jit: 0.2 });
  return k.g;
}

/** One waiting chair on a pair of legs: a back, a seat, a hatched cushion. */
function chair(k: Kit, cx: number, w: number, jit = 0.4): void {
  const h = w / 2;
  k.shape([[cx - h, -20], [cx + h, -20], [cx + h, 6], [cx - h, 6]], { fill: 'paper', w: 1.5, jit });
  k.shape([[cx - h - 1, 8], [cx + h + 1, 8], [cx + h + 1, 18], [cx - h - 1, 18]], { fill: 'hatch', w: 1.5, jit });
  k.path(`M${cx - h + 2} 18v22M${cx + h - 2} 18v22`, { w: 1.6 });
}

/** A row of four waiting chairs on one rail. */
function krzesla(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  for (let i = 0; i < 4; i++) chair(k, -36 + i * 24, 20);
  k.line(-48, 22, 48, 22, 1.8);
  k.path('M-44 22v20M44 22v20', { w: 1.8 });
  return k.g;
}

/** A single waiting chair (the Portier sits down on one when the turnstile is struck; render/obstacles.ts). */
export function drawChair(x: number, y: number, seed: number): SVGGElement {
  const o: Obstacle = { kind: 'prop', x, y, size: 56, rot: 0, seed, colliders: [], variant: 'krzesla' };
  const k = kit(o, createRng(seed), 100);
  chair(k, 0, 56, 0.6);
  k.path('M-30 40h60', { w: 1.2 });
  return k.g;
}

/** A ticket dispenser on a post: a box with a slot and a display of the number now served, a strip of tickets hanging out. */
function numerek(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(0, 20, 0, 96, 2.6);
  k.shape([[-22, 96], [22, 96], [28, 106], [-28, 106]], { fill: 'hatch', w: 1.8, jit: 0.4 });
  k.shape([[-34, -60], [34, -60], [34, 22], [-34, 22]], { fill: 'paper', w: 2.2, jit: 0.7 });
  k.shape([[34, -60], [42, -52], [42, 30], [34, 22]], { fill: 'hatch', w: 1.4, jit: 0.3 });
  k.shape([[-24, -50], [24, -50], [24, -26], [-24, -26]], { fill: 'paper', w: 1.2, jit: 0.4 });
  k.mark(String(r.int(100, 899)), 0, -31, 20);
  k.shape([[-18, -14], [18, -14], [18, -8], [-18, -8]], { fill: 'ink', w: 1 });
  k.shape([[-12, -8], [12, -8], [12, 32], [-12, 32]], { fill: 'paper', w: 1.3, jit: 0.4 });
  k.path('M-12 4h24M-12 16h24M-12 28h24', { w: 0.7 });
  k.dots([[0, -2, 0.9]]);
  return k.g;
}

/** A clock on a post, in the hall. It has two hour hands and no minute hand; the hands point in different directions. */
function zegar(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(0, 20, 0, 98, 2.6);
  k.shape([[-20, 98], [20, 98], [26, 106], [-26, 106]], { fill: 'hatch', w: 1.8, jit: 0.4 });
  k.disc(0, -30, 46, { fill: 'hatch', w: 2 });
  k.disc(0, -30, 40, { fill: 'paper', w: 1.4 });
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const inner = i % 3 === 0 ? 31 : 35;
    ticks += `M${(Math.cos(a) * inner).toFixed(1)} ${(-30 + Math.sin(a) * inner).toFixed(1)}L${(Math.cos(a) * 38).toFixed(1)} ${(-30 + Math.sin(a) * 38).toFixed(1)}`;
  }
  k.path(ticks, { w: 1.2 });
  const hand = (deg: number, len: number, w: number): void => {
    const a = ((deg - 90) / 180) * Math.PI;
    k.line(0, -30, Math.cos(a) * len, -30 + Math.sin(a) * len, w);
  };
  hand(300, 22, 3);
  hand(40, 26, 2.2);
  k.disc(0, -30, 3, { fill: 'ink', w: 1 });
  return k.g;
}

registerDrawings('biuro', { biurko, kartoteka, dystrybutor, roslina, kserokopiarka, przepierzenie, 'przepierzenie-boczne': przepierzenieBoczne, krzesla, numerek, zegar });
