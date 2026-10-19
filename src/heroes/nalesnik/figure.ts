/** The Nalesnik's drawing (a flat asteroid, built in code) and his auto-attack animation: the flip with the ink slap. */
import { createRng } from '../../core/rng';
import { blobPoints, el, n2, smoothClosed } from '../../render/svg';
import { circlePath, setPart, type BuildExtras, type FigureDef, type HeroFigure, type PartName, type Parts, type Walker } from '../figureKit';
import { clamp01, FLIP_MS, HOP, keyframes, neutralPose, SLAP_AT_MS, SLAP_DRAW_MS, SLAP_ERASE_MS, SLAP_HOLD_MS, type HeroPose } from '../poseKit';

/** a flat asteroid with a pending application: the drawing is built by buildPancake (the disc, its craters, the flag, the orbit) */
export const figureDef: FigureDef = {
  scale: 1.1,
  body: [],
  hatch: [],
  circles: [],
  // two marks on the ground under the disc; they swap while it rolls
  legs: [
    ['M-9 25H-3M3 25H9', 'M-9 25H-3M3 25H9'],
    ['M-12 25H-6M6 25H12', 'M-12 25H-6M6 25H12'],
  ],
};

export function pose(t: number): HeroPose {
  const pose = neutralPose();
  // the disc turns over about its horizontal axis (vertical scale -1 -> 1) while it hops 12 units toward the enemy
  const p = clamp01(t / FLIP_MS);
  pose.flip = -Math.cos(Math.PI * p);
  pose.lurch = HOP * keyframes(p, [[0, 0], [0.45, 1], [1, 0]]);
  pose.draw = clamp01((t - SLAP_AT_MS) / SLAP_DRAW_MS);
  pose.erase = clamp01((t - SLAP_AT_MS - SLAP_DRAW_MS - SLAP_HOLD_MS) / SLAP_ERASE_MS);
  return pose;
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

export const figure: HeroFigure = {
  def: figureDef,
  wash: { cx: 0, cy: 1, r: 22, seed: 0x4805 },
  attackMs: 220,
  stroke: 'slap',
  pose,
  build: (inner, named): BuildExtras => ({ rim: buildPancake(inner, named) }),
  drive: ({ p, pose }) => {
    p.pancake.flip = pose.flip;
  },
  patch: patchPancake,
};
