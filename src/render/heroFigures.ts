/**
 * Hero figures in the manner of Mroz: spindly, assembled from small parts, hatched. About 64 world units tall,
 * origin near the middle of the body. Legs swap between two frames (patch); nothing is rebuilt per frame.
 * Also the builders for summons (a dotted copy "z innej petli"), projectiles (a short ink dash), and a wrapper
 * that draws an enemy with `copyOf` as the hero it copies.
 */
import { createRng } from '../core/rng';
import type { Enemy, Player, Projectile, Summon } from '../entities/types';
import type { HeroId } from '../heroes';
import { t } from '../i18n';
import { HERO_ATTACK_MS, attackAt, driveHeroStroke, driveLash, driveLaser, heroPose, scribblePath, setStroke, trackRemark } from './attackFx';
import { buildMoon, patchMoon } from './heroFx';
import { blobPoints, el, n2, smoothClosed } from './svg';
import type { Builder } from './view';
import { HERO_HUE, washGroup } from './wash';
import '../ui/forms.css';

const LEG_PERIOD_MS = 150;
/** Heroes, summons and hero copies are drawn this much larger on the page (the profile card keeps 1). */
export const HERO_SCALE = 1.15;

interface FigureDef {
  scale: number;
  /** Strokes. */
  body: readonly string[];
  /** Hatched fills (no stroke). */
  hatch: readonly string[];
  /** Hatched circles [cx, cy, r]. */
  hatchCircles?: readonly (readonly [number, number, number])[];
  /** Circles [cx, cy, r]. */
  circles: readonly (readonly [number, number, number])[];
  /** Two leg frames, each [left, right]. */
  legs: readonly [readonly [string, string], readonly [string, string]];
  /** Dotted extras that stay dotted even on a solid figure. */
  echo?: readonly (readonly [number, number, number])[];
  /** Sub-groups that move in an attack (data-part); what they hold is left out of the lists above. */
  parts?: Partial<Record<PartName, PartDef>>;
}

type PartName = 'arm' | 'ticket' | 'drum' | 'door' | 'instrument' | 'head' | 'cable' | 'disc' | 'pores' | 'pebble';
interface PartDef {
  body?: readonly string[];
  /** Strokes that go into a nested group `data-tail` (the loose end of the Konsultant's cable, hidden while it lashes). */
  tail?: readonly string[];
  hatch?: readonly string[];
  hatchCircles?: readonly (readonly [number, number, number])[];
  circles?: readonly (readonly [number, number, number])[];
}

const FIGURES: Record<HeroId, FigureDef> = {
  // a washing machine with opinions, a hose and a pending application
  pralka: {
    scale: 1.4,
    body: [
      'M-17-21H17V12H-17Z', // cabinet
      'M-17-13H17', // control panel
      'M3-18.5H13V-15.5H3Z', // detergent slot
      'M-14-9L-8-7.5M14-9L8-7.5', // brows
      'M-5 9.5Q0 7.5 5 9.5', // mouth
      'M0-21V-25M-3-25Q0-28.5 3-25', // lint tuft
      'M-17-6Q-25-5-26 3', // left arm
      'M17-6Q25-8 27-1', // right arm
      'M24-1L33-3L34 9L25 11Z', // application form
      'M26 2.5L32 1.5M26.5 5.5L32.5 4.5', // typed lines
      'M-17 6Q-24 9-22 15Q-20 19-15 17', // hose
      'M-15-19h.01M15-19h.01M-15 10h.01M15 10h.01M7-17h.01M10-17h.01', // rivets and dials
      'M-12 12V14M12 12V14', // adjustable feet
    ],
    hatch: ['M10-12H17V12H10Z'],
    circles: [
      [-11, -17, 2.2],
      [-5, -17, 1.5],
      [-26, 4, 1.6],
      [27, -1, 1.4],
    ],
    parts: {
      // the drum turns in the attack (a sock and a button make the turning visible); the door swings on its hinge
      drum: {
        hatchCircles: [[0, -2, 6]],
        // a striped sock plastered to the drum, heel and toe, and a button
        body: ['M-4.6-5.8L-1-6.8L-0.2-1.8Q0.6 0.9 3.8 1.5L3.4 4.4Q-2 4.6-3.6 0.8Z', 'M-4.2-4.2L-0.7-5M-3.9-2.2L-0.3-3', 'M4.6-3.4h.01'],
      },
      door: { circles: [[0, -2, 8.5], [0, -2, 6.8]], body: ['M-3.5-4.5Q-1-6.5 2-5.5'] }, // porthole, glare on the glass
    },
    legs: [
      ['M-8 12L-9 17.5L-12 18.5', 'M8 12L9 17L12 17'],
      ['M-8 12L-6 17L-9 18.5', 'M8 12L11 17.5L14 18.5'],
    ],
  },
  // a helpline consultant who left the queue, still wearing the headset and dragging the cable
  konsultant: {
    scale: 1.35,
    body: [
      'M-6.5-26A6.5 6.5 0 0 1 6.5-26', // headband
      'M-8.5-27H-6V-22H-8.5Z', // ear cup
      'M-7.5-22Q-8-17-2.5-17', // boom
      'M-2-24.2h.01M2-24.2h.01M-1.5-21.3H1.5', // face
      'M0-18.5V-16',
      'M-8-16L8-16L9.5 3L-9.5 3Z', // jacket
      'M-8-16L0-7.5L8-16', // lapels
      'M0-16L-1.8-13L0-3L1.8-13Z', // tie
      'M8-15L13-8L12-1', // arm with cable
      'M-6.5-10H-2.5V-8H-6.5Z', // name plate
      'M-5-29Q0-32 5-29', // hair
    ],
    hatch: ['M-1.6-13L0-3L1.6-13Z', 'M3.5-14L8.5-15L9.5 3L4 3Z'],
    circles: [
      [0, -24, 5.5],
      [-2, -17, 1.2],
    ],
    parts: {
      // the throwing arm, and the ticket in its hand (it leaves the hand in the throw)
      arm: { body: ['M-8-15L-14-8L-13-1'] },
      ticket: { body: ['M-20-6L-11-8L-9 4L-18 6Z', 'M-18-3L-12-4.5M-17.5 0L-11.5-1.5'] },
      // the headset cable: from the boom down the chest to the hand, and its loose end with the plug (the lash in the attack)
      cable: { body: ['M-2.5-17Q8-13 6-6Q5-1.5 12-1'], tail: ['M12-1Q22 3 15 9Q8 14 20 17M20 16h3v3h-3Z'] },
    },
    legs: [
      ['M-4.5 3L-5 12L-6.5 19H-2', 'M4.5 3L5.5 12L8 19H12'],
      ['M-4.5 3L-2.5 12L-4 19H0.5', 'M4.5 3L8 12L9.5 19H14'],
    ],
  },
  // a cosmonaut who arrived before departing: a second helmet, dotted, a little behind the first
  petlowiec: {
    scale: 1.3,
    body: [
      'M-5-12.5H5',
      'M-8-12H8L9 4H-9Z', // suit
      'M-4-9H4V-2H-4Z', // panel
      'M-9 1H9', // belt
      'M-8-10H-13.5V2H-8', // backpack
      'M-13.5-6Q-17-6-17 0', // tube
      'M-8-10L-14-4L-13 3', // arms
      'M8-10L14-5L16 1',
      'M-13.5-6H-8M-13.5-2H-8', // tank ribs
      'M-4 9h.01M4 9h.01', // knee pads
    ],
    hatch: ['M-3.2-8.2H3.2V-2.8H-3.2Z', 'M4-12H8L9 4H4.5Z'],
    circles: [
      [-13, 4, 1.8],
      [16, 2, 1.8],
      [0, -5.5, 1],
    ],
    echo: [[4.5, -24, 9.5]],
    parts: {
      // the helmet dips in the remark
      head: {
        body: ['M-6.5-24Q0-29 6.5-24L6-19Q0-15.5-6-19Z', 'M6-30L9-36', 'M-8.5-22h.01M8.5-22h.01M0-31.5h.01'], // visor, antenna, rivets
        hatch: ['M-6-23.5Q0-27.5 6-23.5L5.6-19.8Q0-17 -5.6-19.8Z'],
        circles: [[0, -22, 9.5], [9.5, -37, 1.3]],
      },
    },
    legs: [
      ['M-4 4L-4.5 12L-8 17H-2.5', 'M4 4L5 11L8.5 17H14'],
      ['M-4 4L-2 12L-4.5 17H1', 'M4 4L8 12L7 17H12.5'],
    ],
  },
  // a surveyor of planets that only the navigation app confirms; carries the range pole and the map
  kartograf: {
    scale: 1.25,
    body: [
      'M-12-25Q0-29 12-25', // brim
      'M-6-26L-5-33H5L6-26', // crown
      'M-5.8-28.5H5.8',
      'M2-21.6h.01',
      'M-5.5-16L5.5-16L9 5L-9 5Z', // coat
      'M0-13h.01M0-9h.01M0-5h.01',
      'M3.5-11l1-1.5', // compass needle
      'M-17-10L-6-5L-7.5-1.5L-18.5-6.5Z', // rolled map
      'M-5.5-15L-10-9',
      'M-12-8.5l1 2.5',
    ],
    hatch: ['M-9 1L9 1L9 5L-9 5Z', 'M2.5-15L5.5-15L9 5L3.5 5Z', 'M-5.8-30H5.8V-28.5H-5.8Z'],
    circles: [
      [0, -21, 4.8],
      [3.5, -11, 2],
    ],
    parts: {
      // arm, range pole, flag and marks: pushed back by the measurement
      instrument: {
        body: ['M5.5-15L11-9L15-8', 'M15-36V20', 'M15-36L24-33L15-30Z', 'M13-24H17M13-14H17M13-4H17M13 6H17M13 16H17'],
        hatch: ['M15-35.4L22.8-33L15-30.6Z'],
      },
    },
    legs: [
      ['M-3 5L-4 13L-5 20H-1', 'M3 5L4.5 13L7 20H11'],
      ['M-3 5L-1 13L-2.5 20H1.5', 'M3 5L7 13L8.5 20H12.5'],
    ],
  },
  // a flat asteroid with a pending application: the drawing is built by buildPancake (the disc, its craters, the flag, the orbit)
  nalesnik: {
    scale: 1.1,
    body: [],
    hatch: [],
    circles: [],
    // two marks on the ground under the disc; they swap while it rolls
    legs: [
      ['M-9 25H-3M3 25H9', 'M-9 25H-3M3 25H9'],
      ['M-12 25H-6M6 25H12', 'M-12 25H-6M6 25H12'],
    ],
  },
};

/** Where each hero's stain sits (figure units: centre and radius, about 0.9 of the body) and its fixed seed. */
const WASH_AT: Record<HeroId, { cx: number; cy: number; r: number; seed: number }> = {
  pralka: { cx: 0, cy: -4, r: 21, seed: 0x4801 },
  konsultant: { cx: 0, cy: -7, r: 20, seed: 0x4802 },
  petlowiec: { cx: 0, cy: -10, r: 21, seed: 0x4803 },
  kartograf: { cx: -1, cy: -7, r: 20, seed: 0x4804 },
  nalesnik: { cx: 0, cy: 1, r: 22, seed: 0x4805 },
};

interface Parts {
  inner: SVGGElement;
  /** The sub-groups that move in an attack, found once at creation. */
  named: Partial<Record<PartName, SVGGElement>>;
  /** Konsultant: the loose end of the cable (hidden while the lash is out). */
  tail: SVGGElement | null;
  /** Petlowiec: the ink "—!" next to the head, and its strokes (pathLength 1). */
  speech: SVGGElement | null;
  speechPaths: SVGPathElement[];
  /** Offsets of `inner` (leg bob, attack lurch) and the last transform written to each moving node. */
  bob: number;
  lx: number;
  ly: number;
  sig: Partial<Record<PartName | 'inner' | 'speech' | 'rim', string>>;
  /** Parts are away from their rest pose; the next frame without an attack puts them back. */
  posed: boolean;
  legs: SVGPathElement[];
  foam: SVGGElement | null;
  caption: SVGTextElement | null;
  /** The stain; it is counter-mirrored when the figure faces left, so it does not jump sideways on a turn. */
  wash: SVGGElement | null;
  heroId: HeroId;
  scale: number;
  /** Nalesnik: the rim stroke (thicker when rounded) and the state of the roll. */
  rim: SVGPathElement | null;
  pancake: { squash: number; roll: number; flip: number; lastMs: number; px: number | null; py: number | null };
}
const parts = new WeakMap<SVGGElement, Parts>();

const circlePath = (cx: number, cy: number, r: number): string => `M${n2(cx - r)} ${n2(cy)}a${n2(r)} ${n2(r)} 0 1 0 ${n2(2 * r)} 0a${n2(r)} ${n2(r)} 0 1 0 ${n2(-2 * r)} 0`;

/** Where each part turns, in figure units. */
const PIVOT = { arm: [-8, -15], drum: [0, -2], door: [-8.5, -2], head: [0, -13] } as const;
/** The Petlowiec's remark: a scribbled dash and a scribbled exclamation mark (about 14 units high) beside the helmet. */
const SPEECH = ['M13-22Q15.5-26 18-22.5Q20.5-19.5 23-22.5Q25.5-25.5 28-22', 'M33.6-35.5Q32-31.5 34-28Q34.8-25 33.6-22', 'M33.2-17.5h.01'] as const;

function buildPart(name: PartName, def: PartDef): SVGGElement {
  const g = el('g', { 'data-part': name });
  for (const d of def.hatch ?? []) g.append(el('path', { d, fill: 'url(#hatch)', stroke: 'none' }));
  for (const [cx, cy, r] of def.hatchCircles ?? []) g.append(el('path', { d: circlePath(cx, cy, r), fill: 'url(#hatch)', stroke: 'none' }));
  for (const d of def.body ?? []) g.append(el('path', { d }));
  for (const [cx, cy, r] of def.circles ?? []) g.append(el('path', { d: circlePath(cx, cy, r) }));
  if (def.tail) g.append(el('g', { 'data-tail': 1 }, def.tail.map((d) => el('path', { d }))));
  return g;
}

/** The shield: a ring of foam bubbles around the washing machine. */
function foamGroup(): SVGGElement {
  const g = el('g', { class: 'foam' });
  const rng = createRng(0xf0a);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const rr = rng.range(27, 32);
    g.append(el('circle', { cx: n2(Math.cos(a) * rr), cy: n2(-4 + Math.sin(a) * rr * 0.95), r: n2(rng.range(3, 5.6)) }));
  }
  for (let i = 0; i < 4; i++) g.append(el('circle', { cx: n2(rng.range(-22, 22)), cy: n2(rng.range(-24, 16)), r: n2(rng.range(1.2, 2.4)) }));
  g.style.display = 'none';
  return g;
}

// ---------- the pancake (Nalesnik) ----------

/** Radius of the disc in figure units, of the dotted orbit (an ellipse), and the pores in the disc. */
const DISC_R = 20;
const ORBIT_RX = 31;
const ORBIT_RY = 24;
/** Degrees the craters turn per world unit rolled (the disc is about 29 units across the page: 1 / 29 rad). */
const ROLL_DEG_PER_UNIT = 2;
/** Edge-on while rolling. */
const EDGE_ON = 0.35;
/** Rounded up (the quirk): the craters grow, the rim thickens. */
const ROUND_PORES = 1.3;
const ROUND_DISC = 1.08;
const RIM_W = 1.6;
const RIM_W_ROUND = 2.7;

const polar = (deg: number, r: number): string => `${n2(Math.cos((deg * Math.PI) / 180) * r)} ${n2(Math.sin((deg * Math.PI) / 180) * r)}`;

/**
 * Draws the pancake into `inner` and records its moving parts in `named`: a dotted orbit ring with a pebble, a small flag
 * planted at the top, and the disc (a rim, a folded lip at the lower right, hatching) with a sub-group of craters that turns
 * when it rolls. Returns the rim stroke. The craters are seeded: 8 small irregular circles that never touch.
 */
function buildPancake(inner: SVGGElement, named: Partial<Record<PartName, SVGGElement>>): SVGPathElement {
  const rng = createRng(0x4805).fork('pancake');
  inner.append(el('ellipse', { cx: 0, cy: 0, rx: ORBIT_RX, ry: ORBIT_RY, 'stroke-dasharray': '1.5 3.2', fill: 'none' }));
  const pebble = el('g', { 'data-part': 'pebble' }, [el('path', { d: circlePath(0, 0, 2.6) }), el('path', { d: 'M-1 -0.6Q0 -1.4 1 -0.4', 'stroke-width': 0.7 })]);
  named.pebble = pebble;
  inner.append(pebble);
  // the planted flag: a pole from the rim of the disc, a hatched pennant
  inner.append(
    el('path', { d: `M0 ${-DISC_R + 1}V-41` }),
    el('path', { d: 'M0-41L12-37L0-33', 'stroke-linejoin': 'round' }),
    el('path', { d: 'M0-40.2L10.5-37L0-34', fill: 'url(#hatch)', stroke: 'none' }),
  );
  const disc = el('g', { 'data-part': 'disc' });
  // the folded edge: the lip curls over at the lower right, two arcs with hatching between
  disc.append(el('path', { d: `M${polar(105, DISC_R)}A${DISC_R} ${DISC_R} 0 0 0 ${polar(15, DISC_R)}L${polar(25, DISC_R - 4)}A${DISC_R - 4} ${DISC_R - 4} 0 0 1 ${polar(95, DISC_R - 4)}Z`, fill: 'url(#hatch)', stroke: 'none' }));
  const rim = el('path', { d: smoothClosed(blobPoints(rng, 0, 0, DISC_R, 14, 0.025)), 'stroke-width': RIM_W });
  disc.append(rim);
  disc.append(el('path', { d: `M${polar(95, DISC_R - 4)}A${DISC_R - 4} ${DISC_R - 4} 0 0 0 ${polar(25, DISC_R - 4)}M${polar(112, DISC_R - 2)}l-3.5 -1.5M${polar(8, DISC_R - 2)}l1.6 -3.8`, 'stroke-width': 1.1 }));
  const pores = el('g', { 'data-part': 'pores' });
  const placed: { x: number; y: number; r: number }[] = [];
  for (let tries = 0; placed.length < 8 && tries < 200; tries++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.range(0, 1)) * (DISC_R - 7.5);
    const r = rng.range(1.5, 3.3);
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + r + 2.2)) continue;
    placed.push({ x, y, r });
  }
  for (const q of placed) {
    pores.append(el('path', { d: smoothClosed(blobPoints(rng, q.x, q.y, q.r, 7, 0.28)), 'stroke-width': 1.1 }));
    pores.append(el('path', { d: `M${n2(q.x - q.r * 0.5)} ${n2(q.y + q.r * 0.2)}Q${n2(q.x)} ${n2(q.y + q.r * 0.6)} ${n2(q.x + q.r * 0.5)} ${n2(q.y + q.r * 0.1)}`, 'stroke-width': 0.7 }));
  }
  named.pores = pores;
  disc.append(pores);
  named.disc = disc;
  inner.append(disc);
  return rim;
}

/**
 * The pancake rolls on its edge while it walks: the disc is drawn edge-on (horizontal scale 0.35) and the craters turn in
 * proportion to the distance walked; standing it lies flat, the full disc. The flip of the auto-attack scales it vertically
 * (-1 .. 1), the quirk draws it rounder (craters larger, rim thicker). The orbit pebble goes round all the time.
 */
function patchPancake(e: Walker, p: Parts, timeMs: number): void {
  const st = p.pancake;
  const dt = Math.min(100, Math.max(0, timeMs - st.lastMs));
  st.lastMs = timeMs;
  const want = e.moving ? EDGE_ON : 1;
  st.squash = Math.abs(want - st.squash) < 0.01 ? want : st.squash + (want - st.squash) * Math.min(1, dt / 70);
  if (e.x !== undefined && e.y !== undefined) {
    if (st.px !== null && st.py !== null) {
      const d = Math.hypot(e.x - st.px, e.y - st.py);
      if (d < 40) st.roll = (st.roll + d * ROLL_DEG_PER_UNIT) % 360;
    }
    st.px = e.x;
    st.py = e.y;
  }
  const sy = st.flip < 0 ? Math.min(st.flip, -0.02) : Math.max(st.flip, 0.02);
  const fuller = e.round ? ROUND_DISC : 1;
  setPart(p, 'disc', p.named.disc, `scale(${n2(st.squash * fuller)} ${n2(sy * fuller)})`);
  const k = e.round ? ROUND_PORES : 1;
  setPart(p, 'pores', p.named.pores, `rotate(${n2(Math.round(st.roll * 2) / 2)}) scale(${k})`);
  const round = e.round === true;
  if (p.rim && p.sig.rim !== String(round)) {
    p.sig.rim = String(round);
    p.rim.setAttribute('stroke-width', String(round ? RIM_W_ROUND : RIM_W));
  }
  const a = Math.round(timeMs / 1100 / 0.15) * 0.15;
  setPart(p, 'pebble', p.named.pebble, `translate(${n2(Math.cos(a) * ORBIT_RX)} ${n2(Math.sin(a) * ORBIT_RY)})`);
}

export interface FigureOpts {
  /** Drawn in dotted line (a summon, "z innej petli"). */
  dotted?: boolean;
  /** Add the foam shield group (the player). */
  foam?: boolean;
  /** Caption written under the figure (kept upright when the figure faces left). */
  caption?: string;
  /** Extra size factor (HERO_SCALE on the page). */
  size?: number;
  /** Paint a wash under the strokes (on the page only; the profile card stays plain). */
  wash?: boolean;
  /** Half-strength stain (copies and decoys of the hero). */
  faint?: boolean;
}

/** One hero figure as a `<g>`. Its legs are `data-leg` paths; `patchFigure` swaps them. */
export function buildHeroFigure(heroId: HeroId, opts: FigureOpts = {}): SVGGElement {
  const def = FIGURES[heroId];
  const g = el('g', { class: `hero hero-${heroId}${opts.dotted ? ' fig-dotted' : ''}` });
  const sc = def.scale * (opts.size ?? 1);
  const inner = el('g', { class: 'fig', transform: `scale(${n2(sc)})` });
  g.append(inner);
  let wash: SVGGElement | null = null;
  if (opts.wash) {
    // DESIGN 3.4: a stain in the hero's hue, offset from the figure, under every stroke and scaling with it
    const at = WASH_AT[heroId];
    wash = washGroup(createRng(at.seed).fork('wash'), HERO_HUE[heroId], at.r, { cx: at.cx, cy: at.cy, faint: opts.faint === true });
    inner.append(wash);
  }
  for (const [cx, cy, r] of def.echo ?? []) {
    const echo = el('path', { d: circlePath(cx, cy, r), 'stroke-dasharray': '1.5 2.5' });
    inner.append(echo);
  }
  for (const d of def.hatch) inner.append(el('path', { d, fill: 'url(#hatch)', stroke: 'none' }));
  for (const [cx, cy, r] of def.hatchCircles ?? []) inner.append(el('path', { d: circlePath(cx, cy, r), fill: 'url(#hatch)', stroke: 'none' }));
  for (const d of def.body) inner.append(el('path', { d }));
  for (const [cx, cy, r] of def.circles) inner.append(el('path', { d: circlePath(cx, cy, r) }));
  inner.dataset['part'] = 'body';
  const named: Partial<Record<PartName, SVGGElement>> = {};
  for (const [name, partDef] of Object.entries(def.parts ?? {}) as [PartName, PartDef][]) {
    const part = buildPart(name, partDef);
    named[name] = part;
    inner.append(part);
  }
  let rim: SVGPathElement | null = null;
  if (heroId === 'nalesnik') rim = buildPancake(inner, named);
  let speech: SVGGElement | null = null;
  const speechPaths: SVGPathElement[] = [];
  if (heroId === 'petlowiec') {
    speech = el('g', { 'data-part': 'speech' });
    SPEECH.forEach((d, i) => speechPaths.push(el('path', { d, pathLength: 1, 'stroke-width': i === 2 ? 3.4 : 1.9 })));
    speech.append(...speechPaths);
    speech.style.display = 'none';
    inner.append(speech);
  }
  const legs = [0, 1].map((i) => el('path', { 'data-leg': i, d: def.legs[0][i as 0 | 1] }));
  inner.append(...legs);
  const foam = opts.foam ? foamGroup() : null;
  if (foam) inner.append(foam);
  let caption: SVGTextElement | null = null;
  if (opts.caption) {
    caption = el('text', { class: 't-caption', x: 0, y: Math.round(36 * (opts.size ?? 1)) }, [opts.caption]);
    g.append(caption);
  }
  const tail = named.cable?.querySelector<SVGGElement>('[data-tail]') ?? null;
  parts.set(g, { inner, named, tail, speech, speechPaths, bob: 0, lx: 0, ly: 0, sig: {}, posed: false, legs, foam, caption, wash, heroId, scale: sc, rim, pancake: { squash: 1, roll: 0, flip: 1, lastMs: 0, px: null, py: null } });
  return g;
}

interface Walker {
  /** Where the figure stands (the Konsultant's lash starts at his hand, which moves with him). */
  x?: number;
  y?: number;
  moving: boolean;
  facing?: 1 | -1;
  shield?: number;
  suspended?: boolean;
  /** Nalesnik rounded up by its quirk. */
  round?: boolean;
}

const hide = (node: SVGElement, off: boolean): void => {
  node.style.display = off ? 'none' : '';
};

/** `inner` carries the leg bob and the attack lurch in front of its scale. */
function syncInner(p: Parts): void {
  const tf = `translate(${n2(p.lx)} ${n2(p.ly + p.bob)}) scale(${p.scale})`;
  if (p.sig.inner === tf) return;
  p.sig.inner = tf;
  p.inner.setAttribute('transform', tf);
}

/** Write a transform on a moving part only when it changed. An empty string puts the part back. */
function setPart(p: Parts, name: PartName | 'speech', node: SVGElement | null | undefined, tf: string): void {
  if (!node || p.sig[name] === tf) return;
  p.sig[name] = tf;
  if (tf) node.setAttribute('transform', tf);
  else node.removeAttribute('transform');
}

/**
 * The auto-attack animation of the hero's own drawing (render/attackFx.ts has the timing): lurch, drum, door,
 * throwing arm, helmet, instrument, and the ink stroke of the attack. A few attribute writes per frame while it
 * lasts, none when idle. Rotations are mirrored when the target is behind the way the figure faces.
 */
function patchAttack(e: Walker, g: SVGGElement, p: Parts, timeMs: number): void {
  const live = attackAt(g, timeMs, HERO_ATTACK_MS[p.heroId]);
  if (!live) {
    if (!p.posed) return;
    p.posed = false;
    p.pancake.flip = 1;
    p.lx = 0;
    p.ly = 0;
    syncInner(p);
    for (const name of ['arm', 'ticket', 'drum', 'door', 'instrument', 'head'] as const) setPart(p, name, p.named[name], '');
    const ticket = p.named.ticket;
    if (ticket) hide(ticket, false);
    if (p.tail) hide(p.tail, false);
    if (p.speech) {
      hide(p.speech, true);
      setPart(p, 'speech', p.speech, '');
    }
    return;
  }
  p.posed = true;
  const { a, t } = live;
  const pose = heroPose(p.heroId, t);
  // the figure is mirrored as a whole when it faces left: the target's direction in the figure's own frame
  const lux = a.ux * (e.facing ?? 1);
  const side = lux < 0 ? -1 : 1;
  p.lx = lux * pose.lurch;
  p.ly = a.uy * pose.lurch;
  syncInner(p);
  switch (p.heroId) {
    case 'pralka':
      setPart(p, 'drum', p.named.drum, `rotate(${n2(pose.drum * side)} ${PIVOT.drum[0]} ${PIVOT.drum[1]})`);
      setPart(p, 'door', p.named.door, `translate(${PIVOT.door[0]} ${PIVOT.door[1]}) scale(${n2(pose.door)} 1) translate(${-PIVOT.door[0]} ${-PIVOT.door[1]})`);
      break;
    case 'konsultant': {
      const tf = `rotate(${n2(pose.arm * side)} ${PIVOT.arm[0]} ${PIVOT.arm[1]})`;
      setPart(p, 'arm', p.named.arm, tf);
      setPart(p, 'ticket', p.named.ticket, tf);
      const ticket = p.named.ticket;
      if (ticket) hide(ticket, pose.ticketOut);
      // the loose end of the cable is the lash while it is out
      if (p.tail) hide(p.tail, pose.lash > 0);
      // the hand: (12, -1) in the figure's frame, mirrored with the way it faces
      const hand = { x: (e.x ?? a.x) + (e.facing ?? 1) * 12 * p.scale, y: (e.y ?? a.y) - p.scale };
      driveLash(a, pose, t, hand);
      break;
    }
    case 'petlowiec': {
      setPart(p, 'head', p.named.head, `translate(0 ${n2(pose.dip)}) rotate(${n2(pose.tilt * side)} ${PIVOT.head[0]} ${PIVOT.head[1]})`);
      const speech = p.speech;
      if (speech) {
        const shown = pose.draw > 0 && pose.erase < 1;
        hide(speech, !shown);
        setPart(p, 'speech', speech, side < 0 ? 'scale(-1 1)' : '');
        if (shown) {
          // the dash first, then the mark, then its dot
          p.speechPaths.forEach((path, i) => setStroke(path, Math.max(0, Math.min(1, pose.draw * 3 - i)), pose.erase));
        }
      }
      break;
    }
    case 'kartograf':
      setPart(p, 'instrument', p.named.instrument, `translate(${n2(-lux * pose.kick)} ${n2(-a.uy * pose.kick)})`);
      driveLaser(a, t);
      break;
    case 'nalesnik':
      p.pancake.flip = pose.flip;
      break;
  }
  driveHeroStroke(a, p.heroId, pose.draw, pose.erase);
}

/** Legs, bob, foam, suspension, caption direction, the attack. Attribute writes only when something changed. */
export function patchFigure(e: Walker, g: SVGGElement, timeMs: number): void {
  const p = parts.get(g);
  if (!p) return;
  const phase = e.moving ? Math.floor(timeMs / LEG_PERIOD_MS) % 2 : 0;
  if (g.dataset['phase'] !== String(phase)) {
    g.dataset['phase'] = String(phase);
    const frame = FIGURES[p.heroId].legs[phase as 0 | 1];
    p.legs.forEach((leg, i) => leg.setAttribute('d', frame[i as 0 | 1]));
    p.bob = phase ? -1 : 0;
    syncInner(p);
  }
  patchAttack(e, g, p, timeMs);
  if (p.heroId === 'nalesnik') patchPancake(e, p, timeMs);
  if (p.foam) {
    const on = (e.shield ?? 0) > 0;
    if (g.dataset['foam'] !== String(on)) {
      g.dataset['foam'] = String(on);
      p.foam.style.display = on ? '' : 'none';
    }
  }
  const sus = e.suspended === true;
  if (g.dataset['sus'] !== String(sus)) {
    g.dataset['sus'] = String(sus);
    g.classList.toggle('suspended', sus);
  }
  if ((p.caption || p.wash) && e.facing !== undefined && g.dataset['face'] !== String(e.facing)) {
    g.dataset['face'] = String(e.facing);
    p.caption?.setAttribute('transform', e.facing < 0 ? 'scale(-1 1)' : '');
    p.wash?.setAttribute('transform', e.facing < 0 ? 'scale(-1 1)' : '');
  }
}

// ---------- builders ----------

export const playerBuilder: Builder<Player> = {
  create: (e) => buildHeroFigure(e.heroId, { foam: e.heroId === 'pralka', size: HERO_SCALE, wash: true }),
  patch: patchFigure,
  drawInMs: 0,
};

export const summonBuilder: Builder<Summon> = {
  create: (e) => {
    if (e.variant === 'moon') return buildMoon(e);
    const opts: FigureOpts = { dotted: true, size: HERO_SCALE, wash: true, faint: true };
    if (e.variant === 'decoy') opts.caption = t('heroes.kartograf.decoy');
    return buildHeroFigure(e.heroId, opts);
  },
  patch: (e, g, timeMs) => (e.variant === 'moon' ? patchMoon(e, g) : patchFigure(e, g, timeMs)),
  drawInMs: 260,
};

/** The Petlowiec's remark in flight: a scribble of handwriting that is drawn in as it leaves the hand. */
interface Remark {
  line: SVGPathElement;
  ttl0: number;
  drawn: boolean;
}
const remarks = new WeakMap<SVGGElement, Remark>();
/** The scribble draws itself in over this long, in seconds of flight. */
const REMARK_DRAW_S = 0.06;

/**
 * A short dash with a nub, pointing along the velocity (set once at creation). Regulaminowy is a ticket card turned along
 * the flight (mirrored when it flies left, so its lines stay readable); the Konsultant's own auto-attack (`roll`) is not drawn
 * here at all, because its cable lash is (render/attackFx.ts) and the projectile is only the hit arriving with the tip. The
 * Petlowiec's own remark is a line of handwriting, 5 to 7 bumps like an illegible "mmm", along the flight, upright; other
 * egzystencjalny shots are a question mark.
 */
export const projectileBuilder: Builder<Projectile> = {
  create: (e) => {
    const g = el('g', { class: 'projectile' });
    const angle = (Math.atan2(e.vy, e.vx) * 180) / Math.PI;
    const inner = el('g', { transform: `rotate(${n2(angle)})` });
    const long = (e.pierce ?? 0) > 3;
    if (e.damageType === 'regulaminowy' && e.roll === true) {
      // nothing: the lash is the picture
    } else if (e.damageType === 'regulaminowy') {
      const sheet = el('g', { transform: `rotate(${n2(angle)})${e.vx < 0 ? ' scale(1 -1)' : ''}` });
      sheet.append(el('path', { d: 'M-4.5-3.5H2.5L5 -1V3.5H-4.5Z' }), el('path', { d: 'M2.5-3.5V-1H5M-2.5 0H2M-2.5 2H1' }));
      g.append(sheet);
    } else if (e.damageType === 'egzystencjalny' && e.roll === true) {
      const rng = createRng(Math.imul(e.id, 977) + 13);
      const line = el('path', { d: scribblePath(rng, rng.int(5, 7), 30, 6), 'stroke-width': 1.7, pathLength: 1 });
      // along the flight, but never upside down: a leftward flight is the same line turned the other way up
      const deg = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
      g.append(el('g', { transform: `rotate(${n2(deg)})` }, [line]));
      remarks.set(g, { line, ttl0: e.ttl + 1 / 60, drawn: false });
      trackRemark(g, e.x, e.y);
    } else if (e.damageType === 'egzystencjalny') {
      const mark = el('g', { transform: `rotate(${n2(-angle)})` });
      mark.append(el('path', { d: 'M-3.5-2.5Q-3.5-6 0-6Q3.5-6 3.5-2.8Q3.5-0.5 0 0.8V2.2M0 5h.01' }));
      g.append(mark);
    } else {
      inner.append(
        el('path', { d: long ? 'M-20 0L6 0M-13-2L-13 2M-6-2L-6 2' : 'M-6 0L3 0' }),
        el('path', { d: 'M3-1.8L7 0L3 1.8' }),
      );
      g.append(inner);
    }
    return g;
  },
  patch(e, g) {
    const r = remarks.get(g);
    if (!r) return;
    trackRemark(g, e.x, e.y);
    if (r.drawn) return;
    const p = (r.ttl0 - e.ttl) / REMARK_DRAW_S;
    if (p >= 1) {
      r.drawn = true;
      r.line.removeAttribute('stroke-dasharray');
      r.line.removeAttribute('stroke-dashoffset');
    } else setStroke(r.line, Math.max(0.05, p), 0);
  },
  drawInMs: 0,
};

/**
 * Draw enemies with `copyOf` as the hero they copy, in plain ink, with a margin caption "kopia";
 * every other enemy goes to `base` (the enemies agent's builder).
 */
export function wrapEnemyBuilder(base: Builder<Enemy>): Builder<Enemy> {
  const wrapped: Builder<Enemy> = {
    create(e) {
      if (!e.copyOf) return base.create(e);
      const g = buildHeroFigure(e.copyOf.heroId, { caption: t('heroes.copy.caption'), size: HERO_SCALE, wash: true, faint: true });
      g.dataset['copy'] = '1';
      return g;
    },
    patch(e, g, timeMs) {
      if (g.dataset['copy'] === '1') patchFigure(e, g, timeMs);
      else base.patch?.(e, g, timeMs);
    },
  };
  if (base.drawInMs !== undefined) wrapped.drawInMs = base.drawInMs;
  return wrapped;
}

export const heroBuilders = {
  player: playerBuilder,
  summon: summonBuilder,
  projectile: projectileBuilder,
};
