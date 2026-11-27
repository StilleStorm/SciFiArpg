/**
 * Wyzyna (STORY 8.14): the highland of the planet a model drew without ever seeing one. Escarpments as long hatched bars (the
 * terraces; the gaps between segments are the ramps), a rock spire, a cairn, a wooden triangulation tower, striped survey poles, a
 * cable-car pylon without a cable, a weather cage on legs, a wind-bent tree, a box for the summit book, a bench facing nothing, and
 * the model's errors: a cloud lying on the ground, a flight of steps that ends in the air, a door standing free in its frame, a
 * second horizon ruled across the page. Ink and hatching only; no drawing carries a word (Akt III, STORY 8.12).
 */
import type { Rng } from '../../core/rng';
import type { Obstacle } from '../../world/pages';
import { kit, type Kit, type Pt } from './kit';
import { registerDrawings } from './registry';

/** A flat stone: an eight-sided blob, uneven, filled. */
function stone(k: Kit, r: Rng, cx: number, cy: number, rx: number, ry: number, fill: 'paper' | 'hatch'): void {
  const pts: Pt[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx * r.range(0.85, 1.05), cy + Math.sin(a) * ry * r.range(0.85, 1.05)]);
  }
  k.shape(pts, { fill, w: 1.4, jit: 0.3 });
}

/** A scalloped outline (a cloud or a clump of leaves) around an ellipse: `n` bumps of `bump` design units. */
function scallop(cx: number, cy: number, rx: number, ry: number, n: number, bump: number): string {
  const f = (v: number): string => v.toFixed(1);
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (i === 0) {
      d += `M${f(x)} ${f(y)}`;
      continue;
    }
    const am = ((i - 0.5) / n) * Math.PI * 2;
    d += `Q${f(cx + Math.cos(am) * (rx + bump))} ${f(cy + Math.sin(am) * (ry + bump))} ${f(x)} ${f(y)}`;
  }
  return `${d}Z`;
}

/** One segment of an escarpment: a lip, a hatched face with strata and cracks, a ragged foot; the ends slope away (ramps on both sides). */
function skarpa(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-50, -12], [-45, -24], [45, -24], [50, -12]], { fill: 'paper', w: 1.8, jit: 0.6 });
  k.path('M-40 -18H40', { w: 0.7 }).setAttribute('stroke-dasharray', '4 3');
  k.shape([[-50, -12], [50, -12], [47, 20], [-47, 20]], { fill: 'hatch', w: 2.1, jit: 0.8 });
  k.line(-44, -2, -8, -2, 0.9);
  k.line(2, -2, 40, -2, 0.9);
  k.line(-40, 8, 14, 8, 0.9);
  k.line(24, 8, 44, 8, 0.9);
  k.path('M-30 -12L-34 -3L-28 6M18 -12L22 -2L16 9M38 -12L35 -4', { w: 0.9 });
  k.path('M-47 20l6 4l8 -3l10 5l9 -4l12 4l10 -3l8 3l8 -4l6 3', { w: 1.2 });
  k.dots([[-20, 28, 1.6], [12, 27, 1.3], [34, 26, 1.1]]);
  return k.g;
}

/** A rock spire: one leaning needle, its right side shaded, cracks, loose rubble at the foot. */
function iglica(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-24, 56], [-15, -20], [-7, -92], [3, -156], [10, -88], [17, -30], [28, 56]], { fill: 'paper', w: 2.1, jit: 0.8 });
  k.shape([[3, -156], [10, -88], [17, -30], [28, 56], [8, 56], [5, -60]], { fill: 'hatch', w: 1.1, jit: 0.5 });
  k.path('M-12 -30L-6 -52L-10 -70M-4 -108L0 -122M-14 20L-8 6L-12 -8', { w: 0.9 });
  stone(k, r, -30, 54, 7, 4.5, 'paper');
  stone(k, r, 34, 56, 6, 4, 'hatch');
  stone(k, r, 12, 61, 5, 3.4, 'paper');
  return k.g;
}

/** A cairn: flat stones piled in five courses narrowing upward, alternate ones hatched, a last stone set on top. */
function kopczyk(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const courses: [number, number, number][] = [[44, 22, 10], [34, 14, 9], [26, 8, 8], [19, 3, 7], [12, 0, 6]];
  let y = 52;
  courses.forEach(([rx, , ry], i) => {
    stone(k, r, r.range(-3, 3), y - ry, rx, ry, i % 2 === 0 ? 'paper' : 'hatch');
    y -= ry * 1.6;
  });
  stone(k, r, 1, y - 4, 9, 6, 'paper');
  k.path('M-52 60H52', { w: 0.8 });
  return k.g;
}

/** A triangulation tower: an A-frame of timber with cross braces, a platform and a small cabin under a hatched roof, a mast on top. */
function wiezaTriang(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const half = (y: number): number => 9 + ((y + 100) / 160) * 19;
  const levels = [60, 28, -4, -36, -68, -100];
  for (let i = 0; i + 1 < levels.length; i++) {
    const a = levels[i] ?? 0;
    const b = levels[i + 1] ?? 0;
    k.line(-half(a), a, half(b), b, 1);
    k.line(half(a), a, -half(b), b, 1);
    k.line(-half(b), b, half(b), b, 1.2);
  }
  k.line(-28, 60, -9, -100, 2.4);
  k.line(28, 60, 9, -100, 2.4);
  k.shape([[-33, 60], [-23, 60], [-23, 64], [-33, 64]], { fill: 'hatch', w: 1, jit: 0.2 });
  k.shape([[23, 60], [33, 60], [33, 64], [23, 64]], { fill: 'hatch', w: 1, jit: 0.2 });
  k.shape([[-17, -100], [17, -100], [17, -94], [-17, -94]], { fill: 'hatch', w: 1.5, jit: 0.3 });
  k.shape([[-12, -122], [12, -122], [12, -100], [-12, -100]], { fill: 'paper', w: 1.7, jit: 0.4 });
  k.shape([[-5, -116], [5, -116], [5, -105], [-5, -105]], { w: 0.8, jit: 0.2 });
  k.shape([[-16, -122], [0, -134], [16, -122]], { fill: 'hatch', w: 1.5, jit: 0.4 });
  k.line(0, -134, 0, -152, 1.3);
  k.path('M0 -152L10 -148L0 -144', { w: 1 });
  return k.g;
}

/** Three striped survey poles of different heights, a pennant on the tallest, tripod feet. */
function tyczki(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const poles: [number, number][] = [[-30, 70], [0, 100], [30, 56]];
  for (const [x, h] of poles) {
    const seg = h / 8;
    for (let i = 0; i < 8; i++) {
      const y1 = 42 - i * seg;
      k.shape([[x - 3, y1], [x + 3, y1], [x + 3, y1 - seg], [x - 3, y1 - seg]], { fill: i % 2 === 0 ? 'hatch' : 'paper', w: 1, jit: 0.15 });
    }
    k.path(`M${x - 8} 48L${x} 42L${x + 8} 48`, { w: 1 });
  }
  k.path('M0 -58L12 -53L0 -48', { w: 1.2, fill: 'hatch' });
  return k.g;
}

/** A cable-car pylon with no cable: a lattice of two legs, a crossbeam with two sheave wheels, empty hooks hanging from it. */
function pylonKolejki(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const half = (y: number): number => 5 + ((y + 80) / 150) * 15;
  const ys = [70, 40, 10, -20, -50, -80];
  for (let i = 0; i + 1 < ys.length; i++) {
    const a = ys[i] ?? 0;
    const b = ys[i + 1] ?? 0;
    k.line(-half(a), a, half(b), b, 0.9);
    k.line(half(a), a, -half(b), b, 0.9);
    k.line(-half(b), b, half(b), b, 0.9);
  }
  k.line(-20, 70, -5, -80, 2.2);
  k.line(20, 70, 5, -80, 2.2);
  k.shape([[-26, 70], [-14, 70], [-14, 76], [-26, 76]], { fill: 'hatch', w: 1, jit: 0.2 });
  k.shape([[14, 70], [26, 70], [26, 76], [14, 76]], { fill: 'hatch', w: 1, jit: 0.2 });
  k.shape([[-34, -90], [34, -90], [34, -80], [-34, -80]], { fill: 'paper', w: 1.8, jit: 0.4 });
  k.disc(-26, -97, 6, { fill: 'paper', w: 1.4 });
  k.disc(-26, -97, 2, { fill: 'hatch', w: 0.8 });
  k.disc(26, -97, 6, { fill: 'paper', w: 1.4 });
  k.disc(26, -97, 2, { fill: 'hatch', w: 0.8 });
  k.path('M-14 -80V-66Q-14 -60 -9 -60M14 -80V-66Q14 -60 19 -60', { w: 1 });
  return k.g;
}

/** A weather cage: a louvred screen on four legs under a hatched roof, a little door, a cup anemometer on a mast. */
function klatkaPogodowa(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(-26, 20, -32, 62, 1.8);
  k.line(26, 20, 32, 62, 1.8);
  k.line(-12, 20, -14, 56, 1.2);
  k.line(12, 20, 14, 56, 1.2);
  k.shape([[-30, -28], [30, -28], [30, 20], [-30, 20]], { fill: 'paper', w: 2, jit: 0.5 });
  for (let i = 0; i < 6; i++) k.line(-27, -22 + i * 7.5, 27, -17 + i * 7.5, 0.8);
  k.shape([[-34, -28], [34, -28], [28, -37], [-28, -37]], { fill: 'hatch', w: 1.6, jit: 0.3 });
  k.shape([[-8, -4], [8, -4], [8, 16], [-8, 16]], { w: 0.9, jit: 0.2 });
  k.disc(5, 6, 1.1, { w: 0.8 });
  k.line(0, -37, 0, -56, 1.3);
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i / 3) * Math.PI * 2 + 0.5;
    const x = Math.cos(a) * 12;
    const y = -58 + Math.sin(a) * 12;
    k.line(0, -58, x, y, 1);
    k.disc(x, y, 3, { fill: i === 0 ? 'hatch' : 'paper', w: 1 });
  }
  return k.g;
}

/** A wind-bent tree: a trunk and every branch leaning right, foliage as scalloped clumps streaming one way. */
function drzewoWichura(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-10, 72], [-6, 14], [4, -26], [18, -52], [24, -47], [13, -22], [5, 14], [10, 72]], { fill: 'paper', w: 2, jit: 0.5 });
  k.path('M0 72Q-6 66 -16 68M6 72Q14 66 24 70', { w: 1.3 });
  k.path('M-1 20Q14 6 34 -2M4 -10Q22 -22 44 -26M14 -38Q30 -50 52 -50', { w: 1.5 });
  const clumps: [number, number, number, number][] = [[36, -4, 16, 7], [46, -28, 16, 8], [50, -52, 18, 9], [20, -62, 12, 7]];
  clumps.forEach(([cx, cy, rx, ry], i) => {
    k.path(scallop(cx, cy, rx, ry, 7, 3), { fill: i % 2 === 0 ? 'paper' : 'hatch', w: 1.3 });
    k.path(`M${cx + rx + 3} ${cy - 3}h10M${cx + rx + 2} ${cy + 3}h13`, { w: 0.8 });
  });
  return k.g;
}

/** A box for the summit book: a lidded box on a post, the lid raised, a book inside, a pencil on a string. */
function skrzynkaKsiegi(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-5, 46], [5, 46], [5, 92], [-5, 92]], { fill: 'hatch', w: 1.5, jit: 0.3 });
  k.shape([[-32, 6], [32, 6], [32, 48], [-32, 48]], { fill: 'paper', w: 2.1, jit: 0.5 });
  k.path('M-32 20H32', { w: 0.8 });
  k.shape([[-24, 6], [24, 6], [24, -6], [-24, -6]], { fill: 'paper', w: 1.3, jit: 0.3 });
  k.path('M-20 -1H20M0 -6V6', { w: 0.7 });
  k.shape([[-34, 6], [34, 6], [28, -28], [-28, -28]], { fill: 'hatch', w: 1.7, jit: 0.4 });
  k.disc(0, 28, 2.4, { fill: 'paper', w: 1.2 });
  k.path('M32 16Q42 24 36 40', { w: 0.9 });
  k.shape([[33, 40], [39, 40], [38, 54], [34, 54]], { fill: 'paper', w: 1, jit: 0.15 });
  return k.g;
}

/** A bench in profile with its seat and backrest slats, a short dashed sight line running off to the left toward nothing. */
function lawkaDonikad(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-34, 0], [34, 0], [34, 8], [-34, 8]], { fill: 'paper', w: 2, jit: 0.4 });
  k.shape([[28, -2], [37, -44], [43, -43], [35, -2]], { fill: 'hatch', w: 1.3, jit: 0.2 });
  k.path('M30 -16L39 -15M32 -28L41 -27', { w: 0.9 });
  k.line(-28, 8, -30, 40, 2);
  k.line(28, 8, 30, 40, 2);
  k.path('M-44 -12H-68', { w: 0.9 }).setAttribute('stroke-dasharray', '3 4');
  return k.g;
}

/** A cloud lying on the ground: a hatched scalloped ellipse with a second, smaller one against it. A flat mark under everything. */
function chmuraLezaca(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.path(scallop(0, 0, 40, 18, 9, 6), { fill: 'hatch', w: 1.5 });
  k.path(scallop(-14, -4, 20, 9, 6, 3.5), { fill: 'paper', w: 1.2 });
  k.path(scallop(30, 14, 16, 7, 5, 3), { fill: 'paper', w: 1.1 });
  return k.g;
}

/** A flight of steps that ends in the air: seven steps rising right, a railing that stops, the next two steps only dashed outlines. */
function schodyUrwane(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  const pts: Pt[] = [[-46, 44]];
  for (let i = 0; i < 6; i++) pts.push([-46 + i * 13, 34 - i * 10], [-33 + i * 13, 34 - i * 10]);
  pts.push([32, 44]);
  k.shape(pts, { fill: 'hatch', w: 1.9, jit: 0.3 });
  for (let i = 0; i < 6; i++) k.line(-46 + i * 13, 34 - i * 10, -33 + i * 13, 34 - i * 10, 1.4);
  k.line(-44, 8, 24, -52, 1.2);
  k.path('M-36 18V34M-18 2V24M0 -14V14M18 -30V4', { w: 1.1 });
  k.path('M32 -26H45V-36H58V-46H71', { w: 1.3 }).setAttribute('stroke-dasharray', '3 3');
  return k.g;
}

/** A door standing free in its frame: two posts and a lintel on little feet, the leaf hung open inside, nothing behind it. */
function drzwiRamowe(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.shape([[-38, -66], [38, -66], [38, -58], [-38, -58]], { fill: 'hatch', w: 1.6, jit: 0.3 });
  k.shape([[-38, -58], [-30, -58], [-30, 62], [-38, 62]], { fill: 'hatch', w: 1.6, jit: 0.3 });
  k.shape([[30, -58], [38, -58], [38, 62], [30, 62]], { fill: 'hatch', w: 1.6, jit: 0.3 });
  k.shape([[-42, 62], [-26, 62], [-26, 68], [-42, 68]], { fill: 'paper', w: 1.2, jit: 0.2 });
  k.shape([[26, 62], [42, 62], [42, 68], [26, 68]], { fill: 'paper', w: 1.2, jit: 0.2 });
  k.shape([[-30, -54], [-6, -46], [-6, 56], [-30, 60]], { fill: 'paper', w: 1.9, jit: 0.4 });
  k.shape([[-26, -40], [-12, -36], [-12, -6], [-26, -4]], { w: 0.8, jit: 0.2 });
  k.shape([[-26, 6], [-12, 8], [-12, 44], [-26, 48]], { w: 0.8, jit: 0.2 });
  k.disc(-10, 6, 1.8, { fill: 'hatch', w: 0.9 });
  return k.g;
}

/** A second horizon, ruled straight across the paper: a double line with ticks, a hatched strip under it, a half sun not quite risen. A flat mark. */
function horyzontDrugi(o: Obstacle, r: Rng): SVGGElement {
  const k = kit(o, r, 100);
  k.line(-50, 0, 50, 0, 1.4);
  k.line(-50, 3, 50, 3, 0.7);
  const ticks: string[] = [];
  for (let i = -4; i <= 4; i++) ticks.push(`M${i * 11} 3v6`);
  k.path(ticks.join(''), { w: 0.7 });
  k.path('M-50 12H-8M10 12H50M-50 17H30', { w: 0.8 });
  k.path('M-10 0A10 10 0 0 1 10 0', { fill: 'hatch', w: 1.1 });
  return k.g;
}

registerDrawings('wyzyna', {
  skarpa,
  'iglica-skalna': iglica,
  kopczyk,
  'wieza-triang': wiezaTriang,
  'tyczki-pomiarowe': tyczki,
  'pylon-kolejki': pylonKolejki,
  'klatka-pogodowa': klatkaPogodowa,
  'drzewo-wichura': drzewoWichura,
  'skrzynka-ksiegi': skrzynkaKsiegi,
  'lawka-donikad': lawkaDonikad,
  'chmura-lezaca': chmuraLezaca,
  'schody-urwane': schodyUrwane,
  'drzwi-ramowe': drzwiRamowe,
  'horyzont-drugi': horyzontDrugi,
});
