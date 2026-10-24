/**
 * Przedmieście (STORY 8.1): a suburb of smart devices. Lawns as hatched rectangles, hedges, picket fences drawn as ruled lines,
 * mailboxes with a badge number, a robot mower on a stand, a satellite dish, a garden gnome with an antenna, a doorbell plate,
 * kerbs with house numbers. Ink and hatching only; numbers are the only lettering.
 */
import type { Obstacle } from '../../world/pages';
import type { Rng } from '../../core/rng';
import { el } from '../svg';
import { kit } from './kit';
import { registerDrawings } from './registry';

const number = (o: Obstacle): string => String(10 + (o.seed % 88));

function trawnik(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const w = 50;
  const h = 28;
  k.shape([[-w, -h], [w, -h + r.range(-3, 3)], [w + 2, h], [-w - 1, h + 3]], { fill: 'hatch', w: 1.1, jit: 1.5 });
  k.shape([[-w + 7, -h + 7], [w - 7, -h + 7], [w - 7, h - 6], [-w + 7, h - 6]], { w: 0.6, jit: 1 });
  for (let i = 0; i < 6; i++) {
    const x = r.range(-w + 14, w - 14);
    const y = r.range(-h + 12, h - 10);
    k.path(`M${x.toFixed(1)} ${y.toFixed(1)}l-3 -6M${x.toFixed(1)} ${y.toFixed(1)}l0 -7M${x.toFixed(1)} ${y.toFixed(1)}l3 -6`, { w: 0.9 });
  }
  return k.g;
}

function zywoplot(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const w = 48;
  const hh = 15;
  const bumps = Math.max(4, Math.round(o.size / 22));
  const step = (2 * w) / bumps;
  let d = `M${-w} ${hh}L${-w} ${-hh * 0.2}`;
  for (let i = 0; i < bumps; i++) {
    const x0 = -w + i * step;
    d += `Q${(x0 + step / 2).toFixed(1)} ${(-hh - r.range(3, 9)).toFixed(1)} ${(x0 + step).toFixed(1)} ${(-hh * 0.2 + r.range(-2, 2)).toFixed(1)}`;
  }
  d += `L${w} ${hh}Z`;
  k.path(d, { fill: 'hatch', w: 1.7 });
  k.line(-w, hh, w, hh, 1.4);
  const leaves: [number, number, number][] = [];
  for (let i = 0; i < 7; i++) leaves.push([r.range(-w + 6, w - 6), r.range(-hh, hh - 3), r.range(0.9, 1.6)]);
  k.dots(leaves);
  return k.g;
}

function plot(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const w = 48;
  k.line(-w, -5, w, -5, 1.2);
  k.line(-w, 7, w, 7, 1.2);
  const n = Math.max(6, Math.round(o.size / 12));
  for (let i = 0; i <= n; i++) {
    const x = -w + (i / n) * 2 * w;
    k.shape([[x - 3, 13], [x - 3, -10], [x, -15], [x + 3, -10], [x + 3, 13]], { fill: 'paper', w: 1.1, jit: 0.5 });
  }
  return k.g;
}

function skrzynka(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-5, 56], [-5, 2], [5, 2], [5, 56]], { fill: 'paper', w: 1.5 });
  k.line(-18, 56, 18, 56, 1.3);
  k.path('M-38 6L-38 -22Q0 -58 38 -22L38 6Z', { fill: 'paper', w: 1.9 });
  k.path('M-38 6L-38 -22', { w: 1.9 });
  k.line(14, -37, 14, 6, 1.1);
  k.shape([[44, 8], [44, -34], [60, -34], [60, -22], [48, -22]], { fill: 'hatch', w: 1.4, jit: 0.5 });
  k.disc(-18, -8, 2.4, { w: 1.2 });
  k.mark(number(o), -4, -13, 14);
  return k.g;
}

function kosiarka(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  // the stand: a low table with a charging dock
  k.shape([[-52, 22], [52, 22], [52, 28], [-52, 28]], { fill: 'paper', w: 1.5, jit: 0.4 });
  for (const x of [-46, 46]) k.line(x, 28, x, 42, 1.5);
  k.line(-34, 42, 34, 42, 0.9);
  k.shape([[38, 22], [38, 8], [50, 8], [50, 22]], { fill: 'hatch', w: 1.2 });
  // the mower: a low dome, two wheels, a stub antenna
  k.path('M-40 20Q-40 -16 -2 -16Q36 -16 36 20Z', { fill: 'paper', w: 1.9 });
  k.path('M-34 14Q-34 -8 -2 -8Q28 -8 30 14Z', { fill: 'hatch', w: 0.9 });
  k.disc(-24, 21, 6, { fill: 'paper', w: 1.5 });
  k.disc(20, 21, 6, { fill: 'paper', w: 1.5 });
  k.line(-2, -16, -2, -30, 1.3);
  k.disc(-2, -33, 3, { fill: 'ink' });
  k.dots([[-14, 4, 1.8], [-8, 4, 1.8]]);
  return k.g;
}

function antena(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(0, 50, 0, -4, 2);
  k.line(-16, 50, 16, 50, 1.4);
  k.line(-8, 36, 8, 36, 1);
  // the dish, tipped back, its inside hatched
  const dish = el('g', { transform: 'rotate(-28 -2 -24)' });
  k.g.append(dish);
  const back = el('ellipse', { cx: -2, cy: -24, rx: 34, ry: 25, 'stroke-width': 1.9 / k.u });
  back.style.fill = 'var(--paper)';
  const inner = el('ellipse', { cx: -2, cy: -24, rx: 28, ry: 19, 'stroke-width': 0.9 / k.u });
  inner.setAttribute('fill', 'url(#hatch)');
  dish.append(back, inner);
  k.line(0, -4, -2, -22, 1.8);
  // the feed arm with its little head, and the cable down the pole
  k.line(-2, -24, 30, -52, 1.3);
  k.disc(31, -54, 4, { fill: 'paper', w: 1.4 });
  k.path('M31 -50C36 -20 -8 -16 4 8S-6 30 2 48', { w: 0.9 });
  return k.g;
}

function krasnal(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.path('M-30 50Q0 58 30 50', { w: 1.2 });
  k.shape([[-26, 50], [-20, 6], [20, 6], [26, 50]], { fill: 'paper', w: 1.8 });
  k.line(-18, 22, 18, 22, 1.2);
  k.disc(0, 26, 2, { fill: 'ink' });
  k.disc(0, 38, 2, { fill: 'ink' });
  k.disc(0, -8, 17, { fill: 'paper', w: 1.8 });
  // beard, nose, eyes
  k.path('M-16 -2Q0 40 16 -2Q0 8 -16 -2Z', { fill: 'hatch', w: 1.2 });
  k.disc(0, -10, 3.4, { fill: 'paper', w: 1.2 });
  k.dots([[-6, -16, 1.5], [6, -16, 1.5]]);
  // the cap, with an antenna and two arcs of signal
  k.shape([[-20, -16], [0, -76], [20, -16]], { fill: 'hatch', w: 1.8, jit: 0.5 });
  k.line(0, -76, 10, -100, 1.3);
  k.disc(11, -103, 3, { fill: 'ink' });
  k.path('M18 -108Q24 -103 20 -97M24 -112Q33 -104 27 -93', { w: 1 });
  return k.g;
}

function dzwonek(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-6, 62], [-6, 14], [6, 14], [6, 62]], { fill: 'paper', w: 1.6 });
  k.line(-22, 62, 22, 62, 1.4);
  k.shape([[-30, -54], [30, -54], [30, 16], [-30, 16]], { fill: 'paper', w: 2.2, jit: 0.6 });
  k.shape([[-23, -47], [23, -47], [23, 9], [-23, 9]], { w: 0.8, jit: 0.4 });
  const grille: [number, number, number][] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) grille.push([-10 + i * 10, -38 + j * 8, 1.6]);
  k.dots(grille);
  k.disc(0, -1, 8, { fill: 'paper', w: 1.8 });
  k.disc(0, -1, 3, { fill: 'ink' });
  k.path('M-16 -2Q-22 -1 -22 -8M16 -2Q22 -1 22 -8', { w: 0.9 });
  return k.g;
}

function kraweznik(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-48, -4], [-34, -16], [58, -16], [46, -4]], { fill: 'paper', w: 1.6 });
  k.shape([[-48, -4], [46, -4], [46, 20], [-48, 20]], { fill: 'paper', w: 1.9 });
  k.shape([[46, -4], [58, -16], [58, 8], [46, 20]], { fill: 'hatch', w: 1.6 });
  k.mark(number(o), -1, 14, 17);
  k.path(`M${r.range(-20, 10).toFixed(1)} -16l4 6l-3 5`, { w: 0.8 });
  k.line(-48, 26, 46, 26, 0.8);
  return k.g;
}

/** A smart fridge on a porch: two boards and a step under a tall two-door body, a screen on the door, a handle, a cord to nowhere. */
function lodowka(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-48, 78], [48, 78], [54, 94], [-54, 94]], { fill: 'hatch', w: 1.7, jit: 0.6 });
  k.path('M-30 78v16M0 78v16M30 78v16', { w: 0.7 });
  k.shape([[-34, -92], [34, -92], [34, 78], [-34, 78]], { fill: 'paper', w: 2.2, jit: 0.7 });
  k.shape([[34, -92], [42, -84], [42, 86], [34, 78]], { fill: 'hatch', w: 1.4, jit: 0.3 });
  k.path('M-34 -16H34', { w: 1.5 });
  k.shape([[-20, -78], [20, -78], [20, -50], [-20, -50]], { w: 1.2, jit: 0.4 });
  k.dots([[-12, -68, 1.3], [-4, -68, 1.3], [4, -68, 1.3], [12, -68, 1.3], [-12, -58, 1.3], [0, -58, 1.3]]);
  k.line(24, -40, 24, -26, 2.4);
  k.line(24, 4, 24, 28, 2.4);
  k.path('M-34 70Q-48 72 -46 60T-60 52', { w: 1 });
  return k.g;
}

/** A door drawn twice: shut in solid ink, and the same door ajar in dots. The house has not decided which. */
function drzwi(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  // frame and the shut door
  k.shape([[-46, -80], [-4, -80], [-4, 80], [-46, 80]], { w: 1.6, jit: 0.5 });
  k.shape([[-42, -76], [-8, -76], [-8, 80], [-42, 80]], { fill: 'paper', w: 2, jit: 0.5 });
  k.path('M-38 -66H-12V-20H-38ZM-38 -10H-12V40H-38Z', { w: 0.9 });
  k.disc(-14, 8, 2.4, { fill: 'ink', w: 1 });
  // the same door, open, dotted
  k.shape([[4, -80], [46, -80], [46, 80], [4, 80]], { w: 1.6, jit: 0.5 });
  const open = k.path('M6 -76L34 -68V90L6 80Z', { w: 1.6 });
  open.setAttribute('stroke-dasharray', '1.5 4');
  open.setAttribute('stroke-linecap', 'round');
  const panels = k.path('M12 -58L28 -54V-24L12 -28ZM12 -14L28 -10V30L12 26Z', { w: 0.9 });
  panels.setAttribute('stroke-dasharray', '1.2 3.5');
  panels.setAttribute('stroke-linecap', 'round');
  k.line(-52, 84, 50, 84, 1.3);
  return k.g;
}

/** A progress ruler lying on a lawn: a hatched patch, a ruler with ticks, the bar filled to the last hair and not to the end. */
function linijka(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -22], [50, -24], [52, 24], [-49, 22]], { fill: 'hatch', w: 1.1, jit: 1.2 });
  k.shape([[-44, -9], [44, -9], [44, 9], [-44, 9]], { fill: 'paper', w: 1.9, jit: 0.4 });
  let ticks = '';
  for (let i = 0; i <= 20; i++) {
    const x = -44 + i * 4.4;
    ticks += `M${x.toFixed(1)} 9v${i % 5 === 0 ? -7 : -3.5}`;
  }
  k.path(ticks, { w: 0.7 });
  k.shape([[-44, -9], [37, -9], [37, -3], [-44, -3]], { fill: 'hatch', w: 0.8, jit: 0.2 });
  k.line(37.5, -14, 37.5, 14, 1.6);
  k.path('M34 -14h7', { w: 1.2 });
  k.mark('99', 36, -17, 9);
  return k.g;
}

registerDrawings('przedmiescie', { trawnik, zywoplot, plot, skrzynka, kosiarka, antena, krasnal, dzwonek, kraweznik, lodowka, drzwi, linijka });
