/**
 * The base page (DESIGN 4.1): the stations of the ticket system drawn as ink objects, the layout's props, the locked and
 * the open exit, the clause header that appears once the ticket is accepted, and the margin-note label under each
 * station (always shown: Space Mono, 12 px on the screen, upper case, a hand-drawn underline like the HUD labels).
 *
 * Everything lives in the #page layer (no wobble filter), like the obstacles of the run's pages. Paint (DESIGN 3.4) sits
 * under the drawings as a few pale washes. Nothing here owns state: `drawBase` draws once, `view.frame(s)` keeps the
 * labels at 12 px when the zoom changes and puts the Tunel label under the hole, `view.unlock(header)` swaps the exit.
 */
import { createRng, type Rng } from '../core/rng';
import { type Vec } from '../core/vec';
import { t } from '../i18n';
import { FOLD, type Page } from '../world/pages';
import { LABEL_DY, LABEL_H_PX, LABEL_PX, labelText, type BaseProp, type Station, type TappableStation } from '../world/base';
import { npcAt } from '../world/npc';
import type { RunState } from '../world/run';
import { viewZoom } from './camera';
import { drawIn } from './ink';
import { drawNpc } from './npc';
import { drawHeader, drawPage, type PageHeader } from './obstacles';
import { dotPath, el, n2, polyline, wobblyCircle, wobblyLine } from './svg';
import { easeOut, tween } from './tween';
import { washGroup, type WashHue } from './wash';

type Pt = [number, number];
const poly = (pts: readonly Pt[], close = false): string => polyline(pts.map(([x, y]) => ({ x, y })), close);
const paper = (node: SVGElement): void => {
  node.style.fill = 'var(--paper)';
};
const solid = (node: SVGElement): void => {
  node.style.fill = 'var(--ink)';
  node.style.stroke = 'none';
};
const at = (x: number, y: number, rot = 0): SVGGElement => el('g', { transform: `translate(${n2(x)} ${n2(y)})${rot ? ` rotate(${n2((rot * 180) / Math.PI)})` : ''}` });
const stroke = (d: string, w = 1.6, extra: Record<string, string | number> = {}): SVGPathElement => el('path', { d, 'stroke-width': w, ...extra });
const sheet = (pts: readonly Pt[], w = 1.7): SVGPathElement => {
  const p = el('path', { d: poly(pts, true), 'stroke-width': w });
  paper(p);
  return p;
};
const hatched = (pts: readonly Pt[], pattern: 'hatch' | 'hatch-wide' = 'hatch', w = 1.2): SVGPathElement =>
  el('path', { d: poly(pts, true), fill: `url(#${pattern})`, 'stroke-width': w });
/** A short line of fake handwriting. */
const scrawl = (r: Rng, x: number, y: number, len: number): string => {
  const pts: Vec[] = [];
  for (let px = 0; px <= len; px += 3.5) pts.push({ x: x + px, y: y + (px % 7 === 0 ? -1.2 : 1.2) * r.range(0.5, 1.2) });
  return polyline(pts);
};
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const wash = (seed: number, hue: WashHue, radius: number, dx: number, dy: number, opacity = 0.26): SVGGElement => {
  const g = washGroup(createRng(seed).fork('wash'), hue, radius, { opacity });
  g.setAttribute('transform', `translate(${n2(dx)} ${n2(dy)})`);
  return g;
};

// ---------- the four stations ----------

/** The Asystent's desk: a school desk with a terminal, a call bell, a stamp, a stack of forms and a drawer. */
function drawBiurko(r: Rng, seed: number): SVGGElement {
  const g = at(0, 0);
  g.append(wash(seed, 'indigo', 50, 8, 10));
  // legs, back pair shorter
  g.append(stroke('M-60 22L-57 52M60 22L57 52M-46 12L-45 38M46 12L45 38', 2));
  g.append(stroke('M-57 52h-7M57 52h7', 1.6));
  // the top (a plane seen from the front and a little above) and its front apron
  g.append(sheet([[-56, 2], [56, 2], [68, 20], [-68, 20]], 1.9));
  g.append(hatched(rect(-68, 20, 68, 29), 'hatch-wide', 1.6));
  // the drawer unit under the right half
  g.append(sheet(rect(22, 29, 62, 50), 1.5));
  g.append(stroke('M28 40h22M38 34v-0.1', 1.3), el('path', { d: dotPath(39, 45, 1.6) }));
  g.children[g.children.length - 1]?.setAttribute('class', 'ink-dot');
  // the terminal: a boxy monitor with a stand
  g.append(stroke('M-24 -6L-26 2M-6 -6L-4 2M-30 2h30', 1.8));
  g.append(sheet([[-40, -50], [2, -50], [4, -8], [-42, -8]], 2));
  const screen = sheet([[-35, -45], [-2, -45], [-1, -14], [-37, -14]], 1.2);
  g.append(screen);
  for (let i = 0; i < 3; i++) g.append(stroke(scrawl(r, -31, -39 + i * 8, 20 + r.range(-4, 6)), 0.9));
  const cursor = el('path', { d: poly(rect(-31, -18, -26, -15), true) });
  solid(cursor);
  g.append(cursor);
  // the call bell
  g.append(stroke('M18 1A11 9 0 0 1 40 1Z', 1.7), stroke('M29 -9v-3M26 -12h6', 1.4));
  // the stamp (a rubber stamp on its pad)
  g.append(stroke('M48 -1h14v-8h-14Z', 1.5), stroke('M52 -9v-10a4 4 0 0 1 8 0v10', 1.5));
  // a stack of forms
  g.append(sheet([[-64, 0], [-46, -2], [-44, 1], [-62, 3]], 1.4), sheet([[-63, -4], [-45, -6], [-43, -3], [-61, -1]], 1.4));
  return g;
}

/** The Sklep: a market stall under a striped awning, with a phone, a jar and a box on the counter. */
function drawKiosk(r: Rng, seed: number): SVGGElement {
  const g = at(0, 0);
  g.append(wash(seed, 'ochre', 52, 6, 8, 0.3));
  g.append(stroke('M-50 -40V36M50 -40V36', 2.1));
  // the counter
  g.append(sheet([[-52, 8], [52, 8], [58, 19], [-58, 19]], 1.8));
  const front = sheet(rect(-58, 19, 58, 42), 1.7);
  g.append(front);
  for (let x = -48; x < 56; x += 16) g.append(stroke(`M${x} 19V42`, 0.9));
  // the awning: six panels, every other one hatched, a scalloped hem
  const panels = 6;
  const wdt = 120 / panels;
  for (let i = 0; i < panels; i++) {
    const x0 = -60 + i * wdt;
    const x1 = x0 + wdt;
    const d = `M${n2(x0)} -46L${n2(x1)} -46L${n2(x1)} -26Q${n2((x0 + x1) / 2)} -14 ${n2(x0)} -26Z`;
    const p = el('path', { d, 'stroke-width': 1.5 });
    if (i % 2) p.setAttribute('fill', 'url(#hatch-wide)');
    else paper(p);
    g.append(p);
  }
  // the sign under the awning
  const plate = sheet(rect(-24, -13, 24, -3), 1.3);
  g.append(plate, el('text', { class: 't-plate', x: 0, y: -5.5, 'font-size': 8.5 }, [t('screens.base.plate.kiosk')]));
  // goods on the counter: a phone, a jar, a box with a ribbon
  g.append(sheet(rect(-44, -1, -32, 9), 1.2), stroke('M-42 7h8', 0.8));
  g.append(el('path', { d: wobblyCircle(r, 4, 3.5, 5.5, 8, 0.05), 'stroke-width': 1.3 }));
  g.append(sheet(rect(26, 0, 42, 9), 1.3), stroke('M34 0V9M26 4.5h16', 0.9));
  return g;
}

/** The notice board: two posts, a small roof, a board with pinned slips. */
function drawTablica(r: Rng, seed: number): SVGGElement {
  const g = at(0, 0);
  g.append(wash(seed, 'green', 50, -6, 8));
  g.append(stroke('M-44 -44V24M44 -44V24M-52 24h16M36 24h16', 2.2));
  g.append(stroke('M-60 -52L0 -58L60 -52', 1.6), stroke('M-44 -50L-40 -54M44 -50L40 -54', 1));
  const board = sheet(rect(-52, -46, 52, 4), 1.9);
  g.append(board, stroke(poly(rect(-48, -42, 48, 0), true), 0.8));
  const slips: { x: number; y: number; w: number; h: number; rot: number }[] = [
    { x: -42, y: -38, w: 26, h: 21, rot: -4 },
    { x: -9, y: -39, w: 24, h: 24, rot: 3 },
    { x: 22, y: -37, w: 22, h: 30, rot: -2 },
    { x: -40, y: -12, w: 30, h: 10, rot: 2 },
  ];
  for (const s of slips) {
    const sg = at(s.x + s.w / 2, s.y + s.h / 2, (s.rot * Math.PI) / 180);
    sg.append(sheet(rect(-s.w / 2, -s.h / 2, s.w / 2, s.h / 2), 1.2));
    for (let i = 0; i < Math.floor((s.h - 6) / 5); i++) sg.append(stroke(scrawl(r, -s.w / 2 + 3, -s.h / 2 + 8 + i * 5, s.w * r.range(0.45, 0.75)), 0.7));
    const pin = el('path', { d: dotPath(0, -s.h / 2 + 2.5, 1.7) });
    solid(pin);
    sg.append(pin);
    g.append(sg);
  }
  return g;
}

/** The paczkomat: a column of lockers on spindly legs, a dead screen crossed out in pen, an antenna with a dish. */
function drawPaczkomat(r: Rng, seed: number): SVGGElement {
  const g = at(0, 0);
  g.append(wash(seed, 'brick', 44, 7, 6));
  const w = 46;
  const body = sheet(rect(-w / 2, -50, w / 2, 24), 2);
  g.append(body);
  g.append(stroke('M13 -50V-70M13 -70l-6 -5M13 -70l6 -5M5 -74a9 6 0 0 1 16 0', 1.4));
  // the screen, dead: hatched, crossed out with the pen
  g.append(hatched(rect(-17, -44, 17, -29), 'hatch', 1.2), stroke('M-15 -42L15 -31M15 -42L-15 -31', 1.8));
  // lockers: three columns, four rows; one stands open
  const cw = (w - 12) / 3;
  const ch = 12;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const x = -w / 2 + 6 + col * cw;
      const y = -24 + row * (ch + 1.5);
      if (row === 2 && col === 1) {
        g.append(sheet(rect(x, y, x + cw - 2, y + ch), 1));
        g.append(stroke(poly([[x + cw - 2, y], [x + cw + 4, y - 2], [x + cw + 4, y + ch - 2], [x + cw - 2, y + ch]], true), 1));
      } else {
        const d = el('path', { d: poly(rect(x, y, x + cw - 2, y + ch), true), 'stroke-width': 1 });
        if (r.chance(0.3)) d.setAttribute('fill', 'url(#hatch)');
        g.append(d);
      }
    }
  }
  // legs with knees, feet apart
  for (const side of [-1, 1]) {
    g.append(stroke(`M${side * 14} 24L${side * 20} 38L${side * 15} 52h${side * 9}`, 1.7));
    g.append(stroke(`M${side * 20} 38l${side * -3} 0`, 1.2));
  }
  return g;
}

// ---------- the props ----------

/** A scorch mark and chalk circle round the landing spot, flat on the paper. */
function drawScorch(r: Rng): SVGGElement {
  const g = at(0, 0);
  g.append(el('path', { d: wobblyCircle(r, 0, 4, 62, 14, 0.03), 'stroke-width': 1.3, 'stroke-dasharray': '9 6' }));
  g.append(el('path', { d: wobblyCircle(r, 0, 4, 47, 12, 0.04), 'stroke-width': 0.9 }));
  let ticks = '';
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.3;
    ticks += `M${n2(Math.cos(a) * 47)} ${n2(4 + Math.sin(a) * 47)}L${n2(Math.cos(a) * 62)} ${n2(4 + Math.sin(a) * 62)}`;
  }
  g.append(stroke(ticks, 1.1));
  let flecks = '';
  for (let i = 0; i < 14; i++) {
    const a = r.range(0, Math.PI * 2);
    const rad = r.range(66, 92);
    flecks += dotPath(Math.cos(a) * rad, 4 + Math.sin(a) * rad * 0.8, r.range(0.9, 1.9));
  }
  const dots = el('path', { d: flecks });
  solid(dots);
  g.append(dots);
  return g;
}

/** A landing leg of the capsule: a piece of hull with rivets, splayed struts, a telescoping piston and a foot plate. */
function drawLeg(r: Rng, seed: number): SVGGElement {
  const g = at(0, 0);
  g.append(wash(seed, 'indigo', 44, 6, 6, 0.22));
  // the foot plate, flat on the ground, hatched underneath
  const foot = el('path', { d: 'M-38 0A38 8 0 0 0 38 0A38 8 0 0 0 -38 0Z', 'stroke-width': 1.8 });
  paper(foot);
  g.append(foot, stroke('M-30 5Q0 14 30 5', 1));
  // splayed struts and a cross brace
  g.append(stroke('M-22 -64L-30 -6M22 -64L30 -6', 2.1));
  g.append(stroke('M-27 -40L25 -52M27 -40L-25 -52', 1.1));
  // the piston: a thick sleeve, a thin rod, a ring where they meet
  g.append(stroke('M0 -64V-32', 3.2), stroke('M0 -32V-6', 1.5), sheet(rect(-5, -37, 5, -29), 1.3));
  // a piece of the hull above, with a row of rivets
  g.append(sheet([[-40, -74], [-22, -92], [22, -92], [40, -74], [32, -64], [-32, -64]], 1.9));
  let rivets = '';
  for (let i = 0; i < 6; i++) rivets += dotPath(-26 + i * 10.4, -82 + r.range(-0.6, 0.6), 1.2);
  const rv = el('path', { d: rivets });
  solid(rv);
  g.append(rv);
  return g;
}

/** A flag stuck in a heap of earth. The cloth is blank but for a pencilled question mark. */
function drawFlag(r: Rng, seed: number): SVGGElement {
  const g = at(0, 0);
  g.append(wash(seed, 'violet', 26, 5, -30, 0.22));
  g.append(stroke('M0 4V-76', 2));
  const ball = el('path', { d: dotPath(0, -78, 2.4) });
  solid(ball);
  g.append(ball);
  g.append(sheet([[0, -74], [38, -70], [31, -61], [38, -52], [0, -50]], 1.6));
  g.append(el('text', { class: 't-note', x: 15, y: -57, 'font-size': 13, 'text-anchor': 'middle' }, ['?']));
  g.append(stroke(`M-12 4Q0 -4 12 4`, 1.3), stroke('M-8 6l-3 3M0 6l0 3M8 6l3 3', 0.9));
  g.append(el('path', { d: wobblyLine(r, -14, 4, 14, 4, 3, 0.8), 'stroke-width': 1.2 }));
  return g;
}

/** A hut: a crooked box, a hatched pitched roof, a chimney with smoke, a door and a window. */
function drawHut(r: Rng, seed: number): SVGGElement {
  const g = at(0, 0);
  g.append(wash(seed, 'brick', 36, 6, 6, 0.24));
  g.append(sheet([[-30, -12], [31, -14], [30, 27], [-31, 26]], 1.9));
  g.append(hatched([[-40, -12], [r.range(-4, 4), -48], [41, -14]], 'hatch-wide', 1.8));
  const smokeBase = at(19, -42);
  smokeBase.append(sheet(rect(-5, 0, 5, 14), 1.4), stroke('M0 -4Q-6 -10 0 -16Q6 -22 0 -28', 1));
  g.append(smokeBase);
  g.append(stroke('M-8 27V8Q0 2 8 8V27', 1.5), el('path', { d: dotPath(5, 18, 1.1) }));
  g.append(sheet(rect(12, -2, 25, 10), 1.3), stroke('M18.5 -2V10M12 4h13', 0.8));
  g.append(stroke(`M-31 26h-5M31 26h6`, 1.2));
  return g;
}

/** A house front of the little town: narrow, tall, four windows, a stepped top. */
function drawHouse(r: Rng, seed: number): SVGGElement {
  const g = at(0, 0);
  g.append(wash(seed, 'violet', 44, 6, 8, 0.2));
  g.append(sheet([[-26, -58], [-12, -58], [-12, -66], [12, -66], [12, -58], [26, -58], [26, 58], [-26, 58]], 1.9));
  for (let row = 0; row < 3; row++) {
    for (const x of [-15, 5]) {
      const w = sheet(rect(x, -46 + row * 28, x + 11, -30 + row * 28), 1.2);
      if ((row + (x > 0 ? 1 : 0)) % 3 === 0) w.setAttribute('fill', 'url(#hatch)');
      g.append(w);
    }
  }
  g.append(stroke('M-9 58V38Q0 31 9 38V58', 1.5));
  g.append(stroke(scrawl(r, -22, -52, 14), 0.8));
  return g;
}

/** The little town's square: cobbles in two rings and scattered stones. Flat on the paper. */
function drawSquare(r: Rng): SVGGElement {
  const g = at(0, 0);
  g.append(el('path', { d: wobblyCircle(r, 0, 0, 132, 18, 0.025), 'stroke-width': 1.2, 'stroke-dasharray': '10 7' }));
  g.append(el('path', { d: wobblyCircle(r, 0, 0, 112, 16, 0.03), 'stroke-width': 0.9, 'stroke-dasharray': '3 9' }));
  let stones = '';
  for (let i = 0; i < 46; i++) {
    const a = r.range(0, Math.PI * 2);
    const rad = Math.sqrt(r.range(0.04, 1)) * 100;
    stones += dotPath(Math.cos(a) * rad, Math.sin(a) * rad, r.range(0.9, 1.8));
  }
  const dots = el('path', { d: stones });
  solid(dots);
  g.append(dots);
  return g;
}

function drawStation(st: Station, planet: number): SVGGElement {
  const r = createRng(977 + Math.round(st.x) * 31 + Math.round(st.y)).fork(st.id);
  const seed = Math.round(st.x * 13 + st.y * 7);
  const body = ((): SVGGElement => {
    switch (st.id) {
      case 'biurko':
        return drawBiurko(r, seed);
      case 'kiosk':
        return drawKiosk(r, seed);
      case 'tablica':
        return drawTablica(r, seed);
      case 'paczkomat':
        return drawPaczkomat(r, seed);
      case 'urzednik':
        return drawNpc(npcAt(planet));
    }
  })();
  const g = at(st.x, st.y);
  g.setAttribute('data-station', st.id);
  g.append(body);
  return g;
}

function drawProp(p: BaseProp): SVGGElement {
  const r = createRng(p.seed);
  const body = ((): SVGGElement => {
    switch (p.kind) {
      case 'scorch':
        return drawScorch(r);
      case 'leg':
        return drawLeg(r, p.seed);
      case 'flag':
        return drawFlag(r, p.seed);
      case 'hut':
        return drawHut(r, p.seed);
      case 'house':
        return drawHouse(r, p.seed);
      case 'square':
        return drawSquare(r);
    }
  })();
  const g = at(p.x, p.y, p.rot);
  g.append(body);
  return g;
}

// ---------- the exit ----------

/**
 * The folded corner of the base page, in the frame of the top-left corner (mirrored by the caller). Locked: only the
 * perforation of a fold, dashed, as if the corner could be folded and was not. Open: the real dog-ear of the run's
 * pages with its pen arrow.
 */
function exitShapes(page: Page, seed: number): { locked: SVGGElement; open: SVGGElement; at: Vec; fx: number; fy: number } {
  const exit = page.exit;
  if (!exit) throw new Error('base page without an exit');
  const r = createRng(seed);
  const fx = exit.corner[1] === 'l' ? 1 : -1;
  const fy = exit.corner[0] === 't' ? 1 : -1;
  const a = FOLD;
  const pad = page.inset + 5;
  const j = (): number => r.range(-1.6, 1.6);
  const frame = (): SVGGElement => el('g', { transform: `translate(${n2(exit.x)} ${n2(exit.y)}) scale(${fx} ${fy})` });

  const locked = frame();
  const dashed = (d: string, w: number): SVGPathElement => el('path', { d, 'stroke-width': w, 'stroke-dasharray': '7 6' });
  locked.append(
    dashed(`M${n2(a + pad)} ${n2(-pad)}L${n2(-pad)} ${n2(a + pad)}`, 1.4),
    dashed(poly([[a + pad, -pad], [a * 0.5 + j(), a * 0.5 + j()], [-pad, a + pad], [a + pad + j(), a + pad + j()]], true), 1.1),
  );

  const open = frame();
  const hole = el('path', { d: poly([[-pad, -pad], [a + pad, -pad], [-pad, a + pad]], true) });
  hole.style.fill = 'var(--paper-edge)';
  hole.style.stroke = 'none';
  const tri: Pt[] = [[a + pad, -pad], [-pad, a + pad], [a + pad + j(), a + pad + j()]];
  const flap = el('path', { d: poly(tri, true), 'stroke-width': 1.9 });
  paper(flap);
  const back = el('path', { d: poly(tri, true), fill: 'url(#hatch-wide)', stroke: 'none' });
  const crease = el('path', { d: `M${n2(a + pad - 6)} ${n2(-pad + 2)}Q${n2(a * 0.5)} ${n2(a * 0.5 - 6)} ${n2(-pad + 2)} ${n2(a + pad - 6)}`, 'stroke-width': 0.9 });
  const arrow = el('g', { transform: `translate(${n2(a * 0.62)} ${n2(a * 0.62)}) rotate(-135)` });
  arrow.append(el('path', { d: 'M-16 0H16M6-7L17 0L6 7', 'stroke-width': 2.2 }));
  open.append(hole, flap, back, crease, arrow);
  return { locked, open, at: { x: exit.x + fx * (a + pad + 75), y: exit.y + fy * 30 }, fx, fy };
}

// ---------- the note beside the locked dog-ear ----------

/** The handwritten note is set in EB Garamond italic at this size on the screen (the group is scaled by 1 / zoom). */
export const EXIT_NOTE_PX = 13;
/** The note is drawn in screen pixels from this point of the fold: (28, 42) in the corner's frame, on the line x + y = FOLD. */
const NOTE_FOLD: Pt = [28, 42];

interface ExitNote {
  g: SVGGElement;
  /** The translation to the fold; the zoom scale follows it. */
  base: string;
  word: SVGTextElement;
  /** The red strike that crosses it out when the exit unlocks (pathLength 1, drawn by dash offset). */
  struck: SVGPathElement;
}

/**
 * "wymaga zgłoszenia" written in the margin beside the dashed fold, with a small pen arrow pointing at it. Full ink, upright
 * on the page whichever corner the exit is in: the arrow and the text run inward from the fold (`fx` is +1 for a left corner).
 */
function exitNote(page: Page, fx: number, text: string): ExitNote {
  const exit = page.exit;
  if (!exit) throw new Error('base page without an exit');
  const fy = exit.corner[0] === 't' ? 1 : -1;
  const base = `translate(${n2(exit.x + fx * NOTE_FOLD[0])} ${n2(exit.y + fy * NOTE_FOLD[1])})`;
  const g = el('g', { class: 'base-exit-note', transform: base });
  const arrow = el('path', { d: `M${34 * fx} 3Q${20 * fx} -4 ${5 * fx} 0M${11 * fx} -4.5L${5 * fx} 0L${11.5 * fx} 4`, 'stroke-width': 1.5 });
  const word = el('text', { class: 't-note', x: 40 * fx, y: 4, 'text-anchor': fx > 0 ? 'start' : 'end' }, [text]);
  word.style.fontSize = `${EXIT_NOTE_PX}px`;
  word.style.fill = 'var(--ink)';
  word.style.opacity = '1';
  // a thin edge of bare paper keeps the hand legible where the note crosses a prop or the hatching
  word.style.stroke = 'var(--paper)';
  word.style.strokeWidth = '3px';
  word.style.paintOrder = 'stroke';
  const struck = el('path', { d: '', pathLength: 1, 'stroke-width': 1.8 });
  struck.style.stroke = 'var(--accent)';
  struck.style.strokeDasharray = '1 2';
  struck.style.strokeDashoffset = '1';
  struck.style.display = 'none';
  g.append(arrow, word, struck);
  return { g, base, word, struck };
}

/** Cross the note out in red, then let it fade while the dog-ear draws itself in. */
function strikeNote(n: ExitNote, fx: number, seed: number): void {
  let len = n.word.textContent?.length ? n.word.textContent.length * 5.8 : 90;
  try {
    const measured = n.word.getComputedTextLength();
    if (measured > 0) len = measured;
  } catch {
    /* not laid out: the estimate stands */
  }
  const x0 = 40 * fx - 4 * fx;
  const x1 = 40 * fx + (len + 4) * fx;
  n.struck.setAttribute('d', wobblyLine(createRng(seed), x0, 5, x1, -3, 5, 1.2));
  n.struck.style.display = '';
  tween(240, (p) => (n.struck.style.strokeDashoffset = String(1 - p)), { ease: easeOut });
  tween(500, (p) => (n.g.style.opacity = String(1 - p)), { delay: 380, done: () => (n.g.style.display = 'none') });
}

// ---------- the header ----------

/** The printed header of the base page: the form line and the clause; it appears once the ticket is accepted. */
const drawBaseHeader = (page: Page, header: PageHeader): SVGGElement => drawHeader(page, header, { cls: 'base-header', avoidExit: false });

// ---------- the view ----------

export interface BaseView {
  /** Every rendered frame: the margin-note labels come up near a station and go down again. */
  frame(s: RunState): void;
  /** The ticket was accepted: the exit is drawn solid and the clause header is printed. */
  unlock(header: PageHeader): void;
  /** The group the base was drawn into (for the page-turn sweep). */
  readonly ink: SVGGElement;
}

interface Label {
  id: StationId2;
  g: SVGGElement;
  /** Where the label hangs now (world units; the Tunel label follows the hole). */
  x: number;
  y: number;
  shown: boolean;
}
type StationId2 = TappableStation | 'tunel';

/** Under the hole of the service tunnel (the note "c.d. na stronie" hangs above it). */
const TUNEL_DY = 24;

/**
 * A margin-note label: the word in Space Mono capitals, `LABEL_PX` on the screen, with a hand-drawn underline. The group is
 * drawn in screen pixels and scaled by 1 / zoom, so the type keeps its size when the camera zoom changes.
 */
function makeLabel(id: StationId2, x: number, y: number, text: string): Label {
  const g = el('g', { class: 'base-label', 'data-label': id });
  const rng = createRng(Math.round(x * 7 + y * 3));
  const w = text.length * 7.2 + 8;
  const word = el('text', { class: 't-label', x: 0, y: 11, 'text-anchor': 'middle', 'font-size': LABEL_PX }, [text]);
  const under = el('path', { d: wobblyLine(rng, -w / 2, LABEL_H_PX - 4, w / 2, LABEL_H_PX - 5, 4, 0.8), 'stroke-width': 1.1 });
  g.append(under, word);
  return { id, g, x, y, shown: true };
}

/** The note keeps its 13 px on the screen: its group (translated to the fold) is scaled by 1 / zoom. */
const placeNote = (n: ExitNote, zoom: number): void => {
  n.g.setAttribute('transform', `${n.base} scale(${n2(1 / Math.max(0.2, zoom))})`);
};

const placeLabel = (l: Label, zoom: number): void => {
  l.g.setAttribute('transform', `translate(${n2(l.x)} ${n2(l.y)}) scale(${n2(1 / Math.max(0.2, zoom))})`);
};

/**
 * Draw the base page into the #page layer: paper, frame, the decor, then the props and stations, the exit (dashed while
 * the ticket is not accepted) and the labels. `accepted` and `header` draw the unlocked state at once (a held run's base).
 */
export function drawBase(layer: SVGGElement, page: Page, opts: { accepted: boolean; header: PageHeader | null; /** 0-based planet of the plan (game.ts passes `questPlanet(s)`); picks the clerk `npcAt(planet)`. */ planet?: number }): BaseView {
  const info = page.base;
  if (!info || !page.exit) throw new Error('drawBase needs a base page');
  const decorOnly: Page = { ...page, obstacles: page.obstacles.filter((o) => o.station === undefined), exit: null };
  const ink = drawPage(layer, decorOnly);
  // draw order: props behind (flat ones first), then stations, back to front
  const props = el('g', { class: 'base-props' });
  for (const p of [...info.props].sort((a, b) => (a.kind === 'scorch' || a.kind === 'square' ? -1 : 0) - (b.kind === 'scorch' || b.kind === 'square' ? -1 : 0) || a.y - b.y)) props.append(drawProp(p));
  const stations = el('g', { class: 'base-stations' });
  for (const st of [...info.stations].sort((a, b) => a.y - b.y)) stations.append(drawStation(st, opts.planet ?? 0));
  ink.append(props, stations);

  const exit = exitShapes(page, 977 + page.w);
  const exitWord = el('text', { class: 't-note', x: n2(exit.at.x), y: n2(exit.at.y), 'text-anchor': 'middle', 'font-size': 16 });
  const exitG = el('g', { class: 'base-exit', 'data-exit-base': '1' });
  const note = exitNote(page, exit.fx, t('screens.base.exitNote'));
  exitG.append(exit.locked, exit.open, exitWord, note.g);
  ink.append(exitG);

  let unlocked = false;
  let headerG: SVGGElement | null = null;
  const lock = (): void => {
    exit.open.style.display = 'none';
    exit.locked.style.display = '';
    exitWord.textContent = '';
    note.g.style.display = '';
    note.g.style.opacity = '1';
  };
  const unlockNow = (animate: boolean): void => {
    unlocked = true;
    exit.locked.style.display = 'none';
    exit.open.style.display = '';
    exitWord.textContent = t('ui.exit.next');
    note.g.style.display = 'none';
    if (animate) {
      note.g.style.display = '';
      strikeNote(note, exit.fx, 977 + page.w);
      drawIn(exit.open, 520);
      exitWord.style.opacity = '0';
      tween(400, (p) => (exitWord.style.opacity = String(p)), { delay: 300 });
    }
  };
  lock();
  if (opts.accepted) unlockNow(false);

  const labels: Label[] = info.stations.map((st) => makeLabel(st.id, st.x, st.y + LABEL_DY[st.id], labelText(st.id)));
  const tunel = makeLabel('tunel', info.hole.x, info.hole.y + TUNEL_DY, t('screens.base.station.tunel').toLocaleUpperCase('pl-PL'));
  tunel.shown = false;
  tunel.g.style.display = 'none';
  labels.push(tunel);
  const labelLayer = el('g', { class: 'base-labels' });
  for (const l of labels) labelLayer.append(l.g);
  ink.append(labelLayer);
  let lastZoom = -1;
  const place = (): void => {
    const z = viewZoom();
    if (z === lastZoom) return;
    lastZoom = z;
    for (const l of labels) placeLabel(l, z);
    placeNote(note, z);
  };
  place();

  const showHeader = (header: PageHeader, animate: boolean): void => {
    headerG?.remove();
    headerG = drawBaseHeader(page, header);
    ink.append(headerG);
    if (animate) drawIn(headerG, 600);
  };
  if (opts.accepted && opts.header) showHeader(opts.header, false);

  // the stations draw themselves in when the page is first shown
  drawIn(props, 500);
  drawIn(stations, 700);

  return {
    ink,
    frame(s) {
      place();
      // the Tunel label hangs under the hole while one is open on the base (the way back into the held run)
      const hole = s.phase === 'base' ? s.tunnel : undefined;
      if (hole) {
        if (tunel.x !== hole.x || tunel.y !== hole.y + TUNEL_DY) {
          tunel.x = hole.x;
          tunel.y = hole.y + TUNEL_DY;
          placeLabel(tunel, lastZoom);
        }
      }
      if ((hole !== undefined) !== tunel.shown) {
        tunel.shown = hole !== undefined;
        tunel.g.style.display = tunel.shown ? '' : 'none';
      }
    },
    unlock(header) {
      if (unlocked) return;
      unlockNow(true);
      showHeader(header, true);
    },
  };
}
