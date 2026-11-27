/**
 * Jaskinia (STORY 8.13): the cave of planet 7, reused by planet 8. Rock faces as the walls of the chambers (a long horizontal one and
 * a tall one, both hatched, cut by doorways), clusters of stalagmites, a ledge hung with stalactites, a boulder, a column where the
 * two have met, a wall slab with a cave painting in dotted line (a bison with six legs, a hand with seven fingers), a rope on pitons
 * with survey flags, a carbide lamp on a tripod, a ladder against a ledge, a puddle drawn as a coffee ring (flat), a heap of bones
 * assembled wrongly (a ribcage with a handle) and a crystal cluster. The serwerownia's `cisza` plate is reused. Ink and hatching
 * only; the drawings carry no words.
 */
import type { Rng } from '../../core/rng';
import type { Obstacle } from '../../world/pages';
import type { Vec } from '../../core/vec';
import { smoothClosed } from '../svg';
import { kit, type Kit, type Pt } from './kit';
import { registerDrawings } from './registry';

/** An uneven closed outline around (cx, cy): `n` points on an ellipse, each pushed in or out by up to `rough` of its radius. */
export function rockPoints(r: Rng, cx: number, cy: number, rx: number, ry: number, n = 9, rough = 0.18): Pt[] {
  const a0 = r.range(0, Math.PI * 2);
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (i * Math.PI * 2) / n;
    const k = 1 + r.range(-rough, rough);
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as Pt;
  });
}

/** A rock: paper outline, hatched on the lower right, a crack. */
export function rock(k: Kit, r: Rng, cx: number, cy: number, rx: number, ry: number, w = 1.8): void {
  const pts = rockPoints(r, cx, cy, rx, ry, 9, 0.16);
  k.shape(pts, { fill: 'paper', w, jit: 0.4 });
  k.shape([[cx + rx * 0.2, cy + ry * 0.9], [cx + rx * 0.85, cy + ry * 0.4], [cx + rx * 0.8, cy - ry * 0.1], [cx + rx * 0.1, cy + ry * 0.35]], { fill: 'hatch', w: 0.8, jit: 0.3 });
  k.path(`M${(cx - rx * 0.4).toFixed(1)} ${(cy - ry * 0.5).toFixed(1)}l${(rx * 0.25).toFixed(1)} ${(ry * 0.35).toFixed(1)}l${(-rx * 0.1).toFixed(1)} ${(ry * 0.3).toFixed(1)}`, { w: 0.7 });
}

/**
 * A cone from a base at `y0` to an apex at `y0 + h` (h negative: a stalagmite standing up, positive: a stalactite hanging down): paper
 * with the right flank hatched and a few strata marks.
 */
export function cone(k: Kit, r: Rng, cx: number, y0: number, w: number, h: number, lean = 0): void {
  const apex: Pt = [cx + lean, y0 + h];
  const mid = (f: number, side: number): Pt => [cx + lean * f + side * w * (0.5 - 0.22 * f), y0 + h * f * 0.55];
  k.shape([[cx - w / 2, y0], mid(0.6, -1), apex, mid(0.6, 1), [cx + w / 2, y0]], { fill: 'paper', w: 1.4, jit: 0.35 });
  k.shape([apex, mid(0.6, 1), [cx + w / 2, y0], [cx + w * 0.06, y0]], { fill: 'hatch', w: 0.7, jit: 0.25 });
  const y1 = y0 + h * 0.3;
  k.path(`M${(cx - w * 0.3).toFixed(1)} ${y1.toFixed(1)}q${(w * 0.3).toFixed(1)} ${(r.range(1, 3) * Math.sign(h)).toFixed(1)} ${(w * 0.55).toFixed(1)} 0`, { w: 0.6 });
}

/** A jagged outline down the long sides of a rock face: `n` teeth along the edge from (x0, y) to (x1, y), alternating by `amp`. */
const edge = (r: Rng, x0: number, x1: number, y: number, amp: number, n: number): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y + r.range(-amp, amp)] as Pt);

/** The long rock face (a segment of the chambers' horizontal wall): a hatched mass with a jagged crown, a paper face with strata and cracks, rubble at the foot. */
function urwisko(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const top = edge(r, -50, 50, -22, 4, 8);
  const bottom = edge(r, 50, -50, 22, 3, 8);
  k.shape([...top, ...bottom], { fill: 'hatch', w: 2, jit: 0.4 });
  k.shape([[-44, -14], [-20, -17], [4, -13], [30, -17], [44, -12], [44, 12], [16, 15], [-14, 12], [-44, 15]], { fill: 'paper', w: 1.1, jit: 0.5 });
  for (const y of [-6, 2, 9]) {
    const d = `M-42 ${y}Q-24 ${y + r.range(-3, 3)} -6 ${y}T${r.range(14, 22).toFixed(1)} ${y + 1}T42 ${y}`;
    k.path(d, { w: 0.55 });
  }
  const cx = r.range(-26, 20);
  k.path(`M${cx.toFixed(1)} -16l4 7l-3 6l5 8`, { w: 0.9 });
  k.dots([[r.range(-34, -20), 6, 0.9], [r.range(24, 38), -6, 1], [r.range(-6, 8), 10, 0.8]]);
  rock(k, r, -34, 28, 8, 5, 1.2);
  rock(k, r, 30, 28, 6, 4, 1.1);
  return k.g;
}

/** The tall rock face: the same mass stood upright, a paper face ruled with strata, hatched edge on the right, a fallen block at the foot. */
function urwiskoBoczne(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const left = Array.from({ length: 9 }, (_, i) => [-34 + r.range(-4, 3), -136 + (272 * i) / 8] as Pt);
  const right = Array.from({ length: 9 }, (_, i) => [34 + r.range(-3, 4), 136 - (272 * i) / 8] as Pt);
  k.shape([...left, ...right], { fill: 'hatch', w: 2.4, jit: 0.5 });
  k.shape([[-24, -126], [8, -122], [26, -126], [24, 126], [-6, 122], [-26, 126]], { fill: 'paper', w: 1.2, jit: 0.8 });
  for (let y = -108; y <= 116; y += 19) k.path(`M-24 ${y}Q-6 ${y + r.range(-4, 4)} 24 ${y + r.range(-2, 2)}`, { w: 0.6 });
  const cy = r.range(-70, 30);
  k.path(`M-8 ${cy.toFixed(1)}l6 10l-5 9l7 12l-3 9`, { w: 1 });
  k.dots([[-14, r.range(-100, -60), 1], [12, r.range(40, 90), 1.1]]);
  rock(k, r, -18, 142, 12, 7, 1.3);
  rock(k, r, 20, 144, 8, 5, 1.1);
  return k.g;
}

/** A cluster of three stalagmites on a skirt of rubble, taller in the middle; the row of them is what the chambers' rows are made of. */
function stalagmity(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-48, 38], [-30, 30], [0, 34], [30, 30], [48, 38], [30, 46], [-30, 46]], { fill: 'paper', w: 1.3, jit: 0.8 });
  cone(k, r, -28, 38, 30, -62, r.range(-3, 3));
  cone(k, r, 4, 40, 40, -96, r.range(-4, 4));
  cone(k, r, 34, 38, 24, -46, r.range(-3, 3));
  k.path('M-48 40H48', { w: 0.6 }).setAttribute('stroke-dasharray', '3 3');
  k.dots([[r.range(-44, -34), 44, 1], [r.range(38, 46), 43, 0.9]]);
  return k.g;
}

/** A ledge hung with stalactites: a hatched slab of ceiling rock across the top, five cones of different lengths, a drip in the air, a ring where it landed. */
function stalaktyt(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([...edge(r, -50, 50, -62, 3, 7), [50, -44], [-50, -44]], { fill: 'hatch', w: 1.9, jit: 0.4 });
  k.path('M-50 -44q20 6 40 0t40 2t20 -2', { w: 1.2 });
  const xs = [-38, -18, 2, 22, 40];
  xs.forEach((x, i) => cone(k, r, x, -44, 14 + (i % 2) * 5, [34, 60, 82, 48, 28][i] ?? 40, r.range(-1.5, 1.5)));
  k.dots([[2, 48, 1.5]]);
  const ring = k.path('M-12 74q14 -7 28 0q-14 7 -28 0Z', { w: 0.9 });
  ring.setAttribute('stroke-dasharray', '3 2');
  k.path('M-22 74q24 -12 48 0', { w: 0.6 }).setAttribute('stroke-dasharray', '1.5 3');
  return k.g;
}

/** A boulder with a smaller one beside it: paper outline, hatched shaded side, a crack, scree. */
function glazJaskiniowy(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  rock(k, r, -6, 4, 42, 38, 2.2);
  rock(k, r, 38, 34, 14, 11, 1.5);
  k.path('M-26 -10Q-8 -2 -14 18', { w: 0.9 });
  k.dots([[-40, 46, 1.1], [-30, 52, 0.8], [18, 54, 1], [52, 52, 0.9]]);
  k.path('M-44 50h6M-36 55h8', { w: 0.7 });
  return k.g;
}

/** A column where a stalactite and a stalagmite have met: an hourglass of rock, strata as arcs across it, the right flank hatched. */
function kolumna(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const j = r.range(-3, 3);
  const L: Pt[] = [[-34, -112], [-22, -70], [-12, -30], [-9 + j, 0], [-14, 34], [-24, 74], [-38, 112]];
  const R: Pt[] = [[38, 112], [26, 74], [17, 34], [10 + j, 0], [13, -30], [22, -70], [34, -112]];
  k.shape([...L, ...R], { fill: 'paper', w: 2.2, jit: 0.9 });
  k.shape([[34, -112], [22, -70], [13, -30], [10 + j, 0], [17, 34], [26, 74], [38, 112], [18, 112], [4, 40], [0, 0], [4, -40], [14, -112]], { fill: 'hatch', w: 1, jit: 0.3 });
  for (let y = -96; y <= 100; y += 24) {
    const half = Math.max(10, 10 + Math.abs(y) * 0.26);
    k.path(`M${(-half).toFixed(1)} ${y}Q0 ${y + r.range(3, 6)} ${half.toFixed(1)} ${y}`, { w: 0.6 });
  }
  k.shape([[-46, 112], [-14, 108], [46, 112], [30, 120], [-30, 120]], { fill: 'paper', w: 1.2, jit: 0.6 });
  return k.g;
}

/** A bison in dotted line (it has six legs) and a hand with seven fingers, on a rock slab; floor scree and a hatched foot under it. */
function malowidlo(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -64], [-18, -68], [24, -65], [50, -62], [52, 40], [14, 44], [-30, 42], [-52, 38]], { fill: 'hatch', w: 2.2, jit: 1 });
  k.shape([[-44, -58], [-14, -61], [22, -59], [44, -56], [45, 34], [14, 38], [-28, 36], [-45, 32]], { fill: 'paper', w: 1.2, jit: 1 });
  // the bison: hump, head down at the left with horns, a back line and belly, six legs
  const dash = (n: SVGElement): void => n.setAttribute('stroke-dasharray', '2.6 2.4');
  dash(k.path('M-40 -10Q-42 -28 -26 -30Q-20 -40 -6 -34Q10 -30 20 -24Q26 -18 22 -4Q10 2 -10 0Q-26 2 -40 -10Z', { w: 1.5 }));
  dash(k.path('M-40 -10Q-46 -8 -45 2M-32 -28L-36 -38M-26 -30L-28 -40', { w: 1.3 }));
  const legs = [-34, -26, -16, -4, 8, 18];
  legs.forEach((x, i) => dash(k.path(`M${x} ${i < 3 ? -2 : 0}L${x + (i % 2 ? 2 : -2)} ${i % 2 ? 12 : 14}`, { w: 1.3 })));
  k.dots([[-33, -22, 1]]);
  // the hand: a palm and seven fingers fanned out, dotted like the bison
  const hx = 28;
  const hy = 18;
  dash(k.path(`M${hx - 8} ${hy}Q${hx - 9} ${hy + 10} ${hx} ${hy + 12}Q${hx + 9} ${hy + 10} ${hx + 8} ${hy}`, { w: 1.3 }));
  for (let f = 0; f < 7; f++) {
    const a = -Math.PI * 0.86 + (f * Math.PI * 0.72) / 6;
    const len = 15 - Math.abs(f - 3) * 1.4;
    const x1 = hx + Math.cos(a) * 9;
    const y1 = hy + 2 + Math.sin(a) * 4;
    dash(k.path(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${(hx + Math.cos(a) * (9 + len)).toFixed(1)} ${(hy + 2 + Math.sin(a) * (4 + len)).toFixed(1)}`, { w: 1.2 }));
  }
  rock(k, r, -34, 52, 10, 6, 1.3);
  rock(k, r, 28, 54, 7, 5, 1.1);
  return k.g;
}

/** A rope strung on four iron pitons with a sag between each; two survey flags hang from it, a coil lies at the foot of the last piton. */
function lina(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const xs = [-42, -14, 14, 42];
  xs.forEach((x) => {
    k.shape([[x - 6, 52], [x + 6, 52], [x + 8, 58], [x - 8, 58]], { fill: 'hatch', w: 1.2, jit: 0.2 });
    k.line(x, -36, x, 52, 2.2);
    k.disc(x, -38, 3, { fill: 'paper', w: 1.3 });
  });
  for (let i = 0; i < 3; i++) {
    const a = xs[i] ?? 0;
    const b = xs[i + 1] ?? 0;
    k.path(`M${a} -38Q${(a + b) / 2} ${-24 + r.range(-3, 2)} ${b} -38`, { w: 1.5 });
  }
  const flag = (x: number): void => {
    k.shape([[x, -26], [x + 14, -20], [x, -14]], { fill: 'hatch', w: 1, jit: 0.3 });
    k.path(`M${x} -26V-12`, { w: 0.9 });
  };
  flag(-30);
  flag(r.chance(0.5) ? 0 : 6);
  k.path('M46 54q8 -6 14 0q-8 6 -14 0M48 56q6 -4 10 0', { w: 1 });
  return k.g;
}

/** A carbide lamp on a tripod: three legs spread under a hatched tank, a reflector bowl over a small flame, three dashed rays out of it. */
function lampa(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(0, -4, -30, 84, 2.4);
  k.line(0, -4, 30, 84, 2.4);
  k.line(0, -4, 4 + r.range(-2, 2), 90, 2.4);
  k.path('M-24 44H24', { w: 1 });
  k.shape([[-14, -4], [14, -4], [12, -26], [-12, -26]], { fill: 'hatch', w: 1.7, jit: 0.4 });
  k.shape([[-6, -26], [6, -26], [24, -56], [-24, -56]], { fill: 'paper', w: 1.8, jit: 0.4 });
  k.path('M-24 -56Q0 -66 24 -56', { w: 1.4 });
  k.path('M0 -30Q-5 -40 0 -48Q5 -40 0 -30Z', { fill: 'ink', w: 1 });
  const rays = k.path('M-30 -64L-44 -76M0 -70V-86M30 -64L44 -76', { w: 0.9 });
  rays.setAttribute('stroke-dasharray', '3 3');
  return k.g;
}

/** A ladder of two rails and eight rungs leaning against a ledge: a hatched step of rock on the right with a paper top, a coil of rope at its foot. */
function drabinaSkalna(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[2, -42], [34, -46], [52, -42], [54, 70], [-4, 70]], { fill: 'hatch', w: 2, jit: 0.6 });
  k.shape([[2, -42], [34, -46], [52, -42], [50, -34], [4, -34]], { fill: 'paper', w: 1.4, jit: 0.4 });
  const top = (side: number): Pt => [side * 20 - 12, -40];
  const foot = (side: number): Pt => [side * 20 - 36, 72];
  for (let s = 0; s < 2; s++) k.line(top(s)[0], top(s)[1], foot(s)[0], foot(s)[1], 2.2);
  for (let i = 1; i <= 8; i++) {
    const f = i / 9;
    const a: Pt = [top(0)[0] + (foot(0)[0] - top(0)[0]) * f, top(0)[1] + (foot(0)[1] - top(0)[1]) * f];
    const b: Pt = [top(1)[0] + (foot(1)[0] - top(1)[0]) * f, top(1)[1] + (foot(1)[1] - top(1)[1]) * f];
    k.line(a[0], a[1], b[0], b[1], 1.3);
  }
  k.path('M-46 76q8 -6 14 0q-8 6 -14 0', { w: 1 });
  return k.g;
}

/** A puddle drawn as a coffee ring (flat on the floor): a thick uneven ring, a thinner one inside it, a dried tail, splashes. */
function kaluza(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const ring = (rx: number, ry: number, rough: number): string => {
    const pts: Vec[] = rockPoints(r, 0, 0, rx, ry, 14, rough).map(([x, y]) => ({ x, y }));
    return smoothClosed(pts);
  };
  k.path(ring(44, 22, 0.07), { w: 2 });
  k.path(ring(36, 17, 0.1), { w: 0.8 }).setAttribute('stroke-dasharray', '9 4');
  k.path(`M-18 -4Q0 ${r.range(2, 6).toFixed(1)} 20 -2`, { w: 0.6 }).setAttribute('stroke-dasharray', '2 3');
  k.dots([[r.range(46, 52), r.range(-6, 4), 1.2], [r.range(-52, -46), r.range(-4, 6), 0.9], [r.range(-10, 10), 28, 1]]);
  return k.g;
}

/** A heap of bones assembled wrongly: a ribcage with a basket handle over it, a long bone through its ribs, a jaw, a pile of small ones. */
function kosci(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-48, 44], [-20, 34], [10, 38], [44, 34], [50, 46], [20, 54], [-30, 54]], { fill: 'paper', w: 1.2, jit: 0.8 });
  k.path('M-46 44h92', { w: 0.6 }).setAttribute('stroke-dasharray', '3 3');
  // the spine and ribs
  k.path('M-8 -26Q-6 4 -8 40', { w: 2 });
  for (let i = 0; i < 6; i++) {
    const y = -20 + i * 10;
    const w = 14 + Math.sin((i / 5) * Math.PI) * 12;
    k.path(`M-7 ${y}Q${(-7 - w).toFixed(1)} ${y - 4} ${(-7 - w).toFixed(1)} ${y + 8}M-7 ${y}Q${(-7 + w).toFixed(1)} ${y - 4} ${(-7 + w).toFixed(1)} ${y + 8}`, { w: 1.5 });
  }
  // the handle: a basket arch over the cage, clamped to the top ribs
  k.path('M-20 -16Q-8 -66 12 -16', { w: 2 });
  k.disc(-20, -16, 2, { fill: 'paper', w: 1 });
  k.disc(12, -16, 2, { fill: 'paper', w: 1 });
  // a long bone through the cage, a jaw, small bones
  k.line(-44, 22, 40, -6, 2);
  for (const [x, y] of [[-44, 22], [40, -6]] as const) {
    k.disc(x - 2, y - 2, 3, { fill: 'paper', w: 1.2 });
    k.disc(x + 2, y + 2, 3, { fill: 'paper', w: 1.2 });
  }
  k.path('M18 40Q36 52 52 38M22 40v-4M30 43v-5M38 43v-5M46 41v-4', { w: 1.3 });
  k.shape([[-40, 42], [-32, 40], [-30, 44], [-38, 46]], { fill: 'paper', w: 0.9, jit: 0.2 });
  k.dots([[-26, 48, 1], [-12, 50, 0.9], [8, 48, 1.1]]);
  return k.g;
}

/** A crystal cluster: six hexagonal prisms from a hatched rock, a facet line each, one side shaded. */
function krysztaly(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-48, 52], [-32, 36], [-10, 44], [14, 34], [38, 42], [50, 52], [30, 62], [-26, 62]], { fill: 'hatch', w: 1.8, jit: 0.8 });
  const prisms: { x: number; h: number; w: number; lean: number }[] = [
    { x: -30, h: 54, w: 16, lean: -10 },
    { x: -12, h: 94, w: 20, lean: -3 },
    { x: 8, h: 112, w: 22, lean: 2 },
    { x: 26, h: 78, w: 18, lean: 7 },
    { x: 40, h: 46, w: 13, lean: 12 },
  ];
  prisms.forEach((p) => {
    const bx = p.x;
    const top: Pt = [bx + p.lean, 44 - p.h];
    const tip: Pt = [bx + p.lean + p.w / 2 - 2, 44 - p.h - p.w * 0.6];
    k.shape([[bx, 46], [bx + p.w, 46], [top[0] + p.w, top[1]], tip, top], { fill: 'paper', w: 1.5, jit: 0.3 });
    k.shape([[bx + p.w * 0.55, 46], [bx + p.w, 46], [top[0] + p.w, top[1]], [tip[0], tip[1]], [top[0] + p.w * 0.55, top[1]]], { fill: 'hatch', w: 0.6, jit: 0.2 });
    k.path(`M${top[0]} ${top[1]}L${bx} 46`, { w: 0.6 });
  });
  return k.g;
}

registerDrawings('jaskinia', {
  urwisko,
  'urwisko-boczne': urwiskoBoczne,
  stalagmity,
  stalaktyt,
  'glaz-jaskiniowy': glazJaskiniowy,
  kolumna,
  malowidlo,
  lina,
  lampa,
  'drabina-skalna': drabinaSkalna,
  kaluza,
  kosci,
  krysztaly,
});
