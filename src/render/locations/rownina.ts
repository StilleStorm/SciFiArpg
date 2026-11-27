/**
 * Rownina (STORY 8.13): the plain above the cave on planet 7, reused by planet 8. Wide and sparse: grass as hatched tufts (flat), a row
 * of fence posts that encloses nothing, a gate standing without a fence, a signpost with blank arms, a haystack, a well with a
 * windlass, a scarecrow whose gloves have seven fingers, erratic boulders, a windsock, power poles with dotted wires, a boundary
 * stone and a tree drawn with its branches meeting. Ink and hatching only; the drawings carry no words.
 */
import type { Rng } from '../../core/rng';
import type { Obstacle } from '../../world/pages';
import { kit, type Kit } from './kit';
import { rock } from './jaskinia';
import { registerDrawings } from './registry';

const dashed = (n: SVGElement, d = '3 3'): void => n.setAttribute('stroke-dasharray', d);

/** One tuft of grass: five blades fanning from a point, the outer ones shorter. */
const tuft = (k: Kit, x: number, y: number, h: number): void => {
  k.path(`M${x} ${y}l-${(h * 0.55).toFixed(1)} -${(h * 0.7).toFixed(1)}M${x} ${y}l-${(h * 0.2).toFixed(1)} -${h.toFixed(1)}M${x} ${y}l${(h * 0.05).toFixed(1)} -${(h * 0.85).toFixed(1)}M${x} ${y}l${(h * 0.3).toFixed(1)} -${(h * 0.95).toFixed(1)}M${x} ${y}l${(h * 0.6).toFixed(1)} -${(h * 0.6).toFixed(1)}`, { w: 0.8 });
};

/** Flat on the grass: sixteen tufts scattered over a patch. */
function trawa(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  for (let i = 0; i < 16; i++) tuft(k, r.range(-46, 46), r.range(-36, 40), r.range(7, 12));
  return k.g;
}

/** Five fence posts of unequal height, leaning a little, no rails between them; a rail lies in the grass at the foot, a tuft at the end. */
function slupki(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  [-40, -20, 0, 20, 40].forEach((x, i) => {
    const h = 44 + r.range(-4, 8) + (i === 2 ? 6 : 0);
    const lean = r.range(-1.6, 1.6);
    k.shape([[x - 4, 30], [x - 4 + lean, 30 - h], [x + lean, 30 - h - 5], [x + 4 + lean, 30 - h], [x + 4, 30]], { fill: 'paper', w: 1.5, jit: 0.3 });
    k.shape([[x + 1, 30], [x + 1 + lean, 30 - h + 1], [x + 4 + lean, 30 - h], [x + 4, 30]], { fill: 'hatch', w: 0.6, jit: 0.1 });
    k.path(`M${x - 1.5} ${30 - h + 10}h3M${x - 1.5} ${30 - h + 18}h3`, { w: 0.6 });
  });
  k.shape([[-34, 42], [-8, 40], [-8, 44], [-34, 46]], { fill: 'paper', w: 1.2, jit: 0.3 });
  tuft(k, 46, 34, 9);
  tuft(k, -48, 34, 8);
  return k.g;
}

/** A gate standing without a fence: two posts with caps, the leaf hung on the left one and swung half open (braced, slatted), tufts at the posts. */
function brama(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  for (const x of [-40, 40]) {
    k.shape([[x - 6, 50], [x - 6, -46], [x + 6, -46], [x + 6, 50]], { fill: 'paper', w: 2, jit: 0.4 });
    k.shape([[x + 1, 50], [x + 1, -44], [x + 6, -46], [x + 6, 50]], { fill: 'hatch', w: 0.6, jit: 0.2 });
    k.shape([[x - 8, -46], [x + 8, -46], [x + 7, -54], [x - 7, -54]], { fill: 'paper', w: 1.5, jit: 0.2 });
  }
  // the leaf, seen swung out: a skewed frame from the left post
  const j = r.range(-2, 2);
  k.shape([[-34, -30], [8 + j, -22], [8 + j, 38], [-34, 36]], { fill: 'paper', w: 1.7, jit: 0.4 });
  k.path('M-34 -6L8 -2M-34 18L8 22', { w: 1.2 });
  k.path(`M-34 36L${8 + j} -22`, { w: 1.1 });
  for (const x of [-22, -10]) k.path(`M${x} ${-28 + (x + 34) * 0.22}V${37 - (x + 34) * 0.03}`, { w: 0.7 });
  k.disc(-34, -14, 1.6, { fill: 'ink', w: 1 });
  k.disc(-34, 26, 1.6, { fill: 'ink', w: 1 });
  tuft(k, -52, 52, 9);
  tuft(k, 52, 52, 9);
  return k.g;
}

/** A signpost with three blank arms: a pole on a mound, boards pointing different ways, only nails on them. */
function drogowskaz(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-34, 92], [-10, 80], [10, 80], [34, 92], [20, 98], [-20, 98]], { fill: 'hatch', w: 1.5, jit: 0.5 });
  k.shape([[-5, 90], [-5, -70], [5, -70], [5, 90]], { fill: 'paper', w: 2, jit: 0.4 });
  k.path('M2 -70V88', { w: 0.7 });
  const arm = (y: number, dir: 1 | -1, len: number): void => {
    const x0 = dir * 5;
    const x1 = dir * (5 + len);
    k.shape([[x0, y - 8], [x1 - dir * 10, y - 8], [x1, y], [x1 - dir * 10, y + 8], [x0, y + 8]], { fill: 'paper', w: 1.7, jit: 0.4 });
    k.dots([[x0 + dir * 5, y, 1]]);
  };
  arm(-52, 1, 42);
  arm(-28, -1, 38 + r.range(-4, 4));
  arm(-4, 1, 34);
  return k.g;
}

/** A haystack: a bell of straw with its strokes, a pole through the top, a pitchfork leaning on it, wisps on the ground. */
function stog(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.path('M-46 58Q-52 4 -22 -36Q0 -56 22 -36Q52 4 46 58Z', { fill: 'paper', w: 2.2 });
  k.path('M-46 58Q-52 4 -22 -36Q-30 4 -20 58Z', { fill: 'wide', w: 0.5 });
  k.path('M18 -34Q44 4 46 58H24Q30 10 18 -34Z', { fill: 'hatch', w: 0.5 });
  for (let i = 0; i < 9; i++) {
    const y = -26 + i * 9;
    const half = 12 + i * 4.2;
    k.path(`M${(-half + 6).toFixed(1)} ${y}l${r.range(8, 16).toFixed(1)} ${r.range(2, 5).toFixed(1)}M${(half - 26).toFixed(1)} ${y + 3}l${r.range(8, 14).toFixed(1)} ${r.range(-3, 0).toFixed(1)}`, { w: 0.7 });
  }
  k.line(0, -56, 0, -76, 2);
  k.path('M-6 -66l6 -6l6 6', { w: 1 });
  // the pitchfork
  k.line(60, 62, 36, -8, 1.8);
  k.path('M30 -14l4 -18M36 -10l1 -20M42 -8l-2 -19', { w: 1.3 });
  k.path('M30 -14Q36 -6 42 -8', { w: 1.2 });
  tuft(k, -52, 62, 9);
  k.path('M-30 62l-6 4M-20 64l8 -2', { w: 0.8 });
  return k.g;
}

/** A well with a windlass: a stone ring with its courses, two posts and a beam, a crank, a rope with a bucket, a hatched mound round it. */
function studnia(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-40, 30], [40, 30], [40, 74], [-40, 74]], { fill: 'paper', w: 2, jit: 0.6 });
  k.path('M-40 44H40M-40 58H40', { w: 0.8 });
  for (const [y0, off] of [[30, 0], [44, 12], [58, 0]] as const) for (let x = -28 + off; x < 40; x += 24) k.path(`M${x} ${y0}v14`, { w: 0.7 });
  k.shape([[-44, 24], [44, 24], [44, 32], [-44, 32]], { fill: 'paper', w: 1.9, jit: 0.4 });
  k.shape([[-34, 24], [-30, 24], [-30, -44], [-34, -44]], { fill: 'paper', w: 1.5, jit: 0.3 });
  k.shape([[30, 24], [34, 24], [34, -44], [30, -44]], { fill: 'paper', w: 1.5, jit: 0.3 });
  k.shape([[-40, -44], [40, -44], [40, -52], [-40, -52]], { fill: 'hatch', w: 1.5, jit: 0.4 });
  // the windlass: a roller with the crank
  k.shape([[-30, -26], [30, -26], [30, -14], [-30, -14]], { fill: 'paper', w: 1.5, jit: 0.3 });
  k.path('M-30 -20H30', { w: 0.6 });
  k.path('M30 -20H48V-4', { w: 1.8 });
  k.disc(48, -2, 2.6, { fill: 'paper', w: 1.2 });
  // the rope and the bucket
  k.line(0, -14, 0, 12, 1.2);
  k.shape([[-9, 12], [9, 12], [7, 28], [-7, 28]], { fill: 'hatch', w: 1.5, jit: 0.3 });
  k.path('M-9 12Q0 6 9 12', { w: 1.2 });
  tuft(k, -52, 74, 9);
  tuft(k, 50, 76, 8);
  return k.g;
}

/** A hand in a glove with seven fingers: a cuff, a palm, seven fingers fanned out with stitched knuckles. */
function glove(k: Kit, x: number, y: number, up: number): void {
  k.shape([[x - 6, y + 4], [x + 6, y + 4], [x + 6, y + 14], [x - 6, y + 14]], { fill: 'hatch', w: 1, jit: 0.2 });
  k.disc(x, y, 7, { fill: 'paper', w: 1.4 });
  for (let f = 0; f < 7; f++) {
    const a = -Math.PI / 2 - 1.2 + (f * 2.4) / 6;
    const len = 12 - Math.abs(f - 3) * 1.2;
    const sx = x + Math.cos(a) * 6;
    const sy = y + Math.sin(a) * 6 * up;
    k.path(`M${sx.toFixed(1)} ${sy.toFixed(1)}L${(x + Math.cos(a) * (6 + len)).toFixed(1)} ${(y + Math.sin(a) * (6 + len) * up).toFixed(1)}`, { w: 1.5 });
  }
}

/** A scarecrow on a pole: a ragged shirt on a cross arm, a sack head with a brimmed hat, straw at the cuffs and hem, seven-fingered gloves. */
function strach(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(0, -30, 0, 96, 2.6);
  k.shape([[-12, 96], [12, 96], [18, 104], [-18, 104]], { fill: 'hatch', w: 1.4, jit: 0.3 });
  k.line(-36, -8, 36, -8, 2.2);
  k.shape([[-24, -14], [24, -14], [28, 34], [14, 28], [4, 38], [-8, 30], [-20, 36], [-28, 34]], { fill: 'paper', w: 1.8, jit: 0.5 });
  k.shape([[8, -14], [24, -14], [28, 34], [14, 28]], { fill: 'hatch', w: 0.7, jit: 0.3 });
  k.path('M-14 4h10M-12 16h8M12 10l-8 3', { w: 0.7 });
  k.disc(-4, 2, 1.4, { fill: 'ink', w: 1 });
  k.shape([[-12, -44], [12, -44], [13, -22], [-13, -22]], { fill: 'paper', w: 1.6, jit: 0.4 });
  k.dots([[-5, -34, 1.3], [5, -34, 1.3]]);
  k.path('M-5 -27Q0 -24 5 -27M-3 -27v-3M0 -26v-3M3 -27v-3', { w: 0.8 });
  k.shape([[-22, -44], [22, -44], [12, -48], [8, -62], [-8, -62], [-12, -48]], { fill: 'hatch', w: 1.5, jit: 0.4 });
  // straw
  k.path('M-24 34l-3 7M-14 36l1 8M-6 32l-2 8M6 36l2 7M16 32l4 6M24 34l3 6', { w: 0.9 });
  k.path('M-36 -8l-6 -2M-36 -8l-6 4M36 -8l6 -2M36 -8l6 4', { w: 0.9 });
  glove(k, -46, -10, 1);
  glove(k, 46, -10, 1);
  return k.g;
}

/** Two erratic boulders, one large and one beside it, with lichen dots and a split between them; small stones strewn about. */
function glazNarzutowy(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  rock(k, r, -18, 8, 34, 28, 2.1);
  rock(k, r, 30, 24, 20, 14, 1.8);
  k.path('M-30 -6Q-16 2 -24 20M4 -10Q10 -2 6 8', { w: 0.9 });
  k.dots([[-26, -12, 1.2], [-20, -16, 0.9], [-10, -14, 1], [26, 16, 1], [34, 12, 0.8]]);
  rock(k, r, -52, 38, 7, 5, 1.2);
  rock(k, r, 54, 40, 5, 4, 1.1);
  rock(k, r, 6, 46, 6, 4, 1.1);
  return k.g;
}

/** A windsock on a pole: a ring at the top, a sock of alternating hatched and paper bands streaming to the right, a hatched foot. */
function rekaw(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-20, 96], [20, 96], [28, 106], [-28, 106]], { fill: 'hatch', w: 1.6, jit: 0.3 });
  k.line(-14, 96, -14, -52, 3);
  k.path('M-14 -52Q-14 -66 4 -66', { w: 1.8 });
  const droop = r.range(2, 8);
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const x0 = -4 + i * 16;
    const x1 = x0 + 16;
    const h0 = 17 - i * 2.6;
    const h1 = 17 - (i + 1) * 2.6;
    const y0 = -66 + (i * droop) / 2;
    const y1 = -66 + ((i + 1) * droop) / 2;
    k.shape([[x0, y0 - h0 / 2], [x1, y1 - h1 / 2], [x1, y1 + h1 / 2], [x0, y0 + h0 / 2]], { fill: i % 2 ? 'paper' : 'hatch', w: 1.3, jit: 0.15 });
  }
  return k.g;
}

/** Two power poles with cross-arms and insulators, dotted wires between them and running off to either side, a brace at each foot. */
function slupy(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const xs = [-40, 40];
  xs.forEach((x) => {
    k.line(x, 74, x, -72, 3);
    k.line(x - 20, -58, x + 20, -58, 2.2);
    k.line(x - 14, -42, x + 14, -42, 1.8);
    k.path(`M${x - 4} 74l-10 8M${x + 4} 74l10 8`, { w: 1.3 });
    for (const dx of [-16, 0, 16]) k.disc(x + dx, -61, 1.6, { fill: 'paper', w: 1 });
    for (const dx of [-10, 10]) k.disc(x + dx, -45, 1.4, { fill: 'paper', w: 1 });
  });
  for (const [dx, y] of [[-16, -61], [0, -61], [16, -61]] as const) {
    const sag = r.range(14, 22);
    dashed(k.path(`M${-40 + dx} ${y}Q0 ${y + sag} ${40 + dx} ${y}`, { w: 0.9 }), '1 3');
    dashed(k.path(`M${-40 + dx} ${y}Q-64 ${y + 14} -86 ${y + 4}`, { w: 0.8 }), '1 3');
    dashed(k.path(`M${40 + dx} ${y}Q64 ${y + 14} 86 ${y + 4}`, { w: 0.8 }), '1 3');
  }
  tuft(k, -52, 76, 8);
  return k.g;
}

/** A boundary stone: a squat block with a rounded top, an X cut on its face and a dot, the right side hatched, grass at its foot. */
function kamienGraniczny(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-34, 70], [-38, -10], [-24, -44], [0, -54], [26, -44], [38, -10], [34, 70]], { fill: 'paper', w: 2.4, jit: 0.8 });
  k.shape([[26, -44], [38, -10], [34, 70], [14, 70], [18, -6]], { fill: 'hatch', w: 0.8, jit: 0.4 });
  k.path('M-16 -14l22 24M6 -14l-22 24', { w: 1.8 });
  k.dots([[-4, 28, 2]]);
  k.path('M-36 50h14M-28 56h10', { w: 0.7 });
  tuft(k, -46, 74, 12);
  tuft(k, 42, 74, 10);
  return k.g;
}

/** A tree whose branches meet: a trunk forking into two limbs that curve out and come back together over it in a closed loop, twigs and leaf dots on the outside. */
function drzewo(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-12, 90], [-8, 30], [-6, 6], [6, 6], [8, 30], [14, 90], [24, 96], [-24, 96]], { fill: 'paper', w: 2.2, jit: 0.6 });
  k.shape([[2, 8], [8, 30], [14, 90], [24, 96], [0, 96], [4, 40]], { fill: 'hatch', w: 0.8, jit: 0.3 });
  k.path('M-4 40q4 4 0 8M-6 66q5 4 1 9', { w: 0.8 });
  // the two limbs: out, up and back in to meet above the trunk
  k.path('M-6 8Q-56 -4 -48 -52Q-40 -92 0 -92', { w: 2.4 });
  k.path('M6 8Q56 -4 48 -52Q40 -92 0 -92', { w: 2.4 });
  k.path('M-26 -4Q-30 -40 -4 -60Q8 -64 22 -50', { w: 1.5 });
  k.path('M0 -92Q-8 -104 -2 -112M0 -92Q8 -104 6 -110', { w: 1.5 });
  k.path('M-48 -52Q-62 -56 -66 -66M48 -52Q62 -54 68 -62M-44 -22Q-58 -20 -62 -10', { w: 1.3 });
  k.shape([[-20, -64], [0, -80], [22, -64], [14, -30], [-14, -30]], { fill: 'hatch', w: 0.6, jit: 1 });
  k.dots([[-62, -66, 1.8], [-48, -76, 1.5], [60, -62, 1.8], [50, -78, 1.5], [-58, -10, 1.6], [0, -114, 1.6], [-4, -108, 1.2]]);
  tuft(k, -34, 96, 9);
  tuft(k, 36, 96, 9);
  return k.g;
}

registerDrawings('rownina', {
  trawa,
  slupki,
  brama,
  drogowskaz,
  stog,
  studnia,
  strach,
  'glaz-narzutowy': glazNarzutowy,
  rekaw,
  slupy,
  'kamien-graniczny': kamienGraniczny,
  drzewo,
});
