/**
 * Attack animations: a player can see an attack happen. `attack:started` (core/events.ts) opens a short
 * animation record on the attacker's `<g>`; the figure's own `patch` (heroFigures.ts, enemyFigures.ts) asks
 * `attackAt` once per frame and moves its cached sub-groups by the pose computed here. Everything is a pure
 * function of the milliseconds since the first drawn frame, on the same clock as the views (game time), so
 * a paused game freezes the picture and nothing here needs a timer.
 * The only DOM made here is one ink stroke in the fx layer (the Pralka's whip, the Kartograf's measurement, the
 * Konsultant's cable lash with its ticket card) and, when a Petlowiec remark lands, a tiny struck-out word;
 * the stroke is changed by attributes only and removed when the animation ends.
 * Ink only: no particles, no glow, a few units of motion.
 */
import type { Bus } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import type { Vec } from '../core/vec';
import type { HeroId } from '../heroes';
import { el, n2 } from './svg';
import { easeOut, tween } from './tween';
import type { Views } from './view';

// ---------- timing (pure) ----------

export const HERO_ATTACK_MS: Record<HeroId, number> = { pralka: 320, konsultant: 230, petlowiec: 200, kartograf: 200 };
/** The Konsultant's cable: the tip reaches the target in 90 ms and snaps back in 120. The hit resolves when it arrives (heroes/auto.ts). */
export const LASH_OUT_MS = 90;
export const LASH_BACK_MS = 120;
/** The Pralka's whip is drawn in 35 ms, stays fully drawn for 180 ms and is rubbed out in 45. */
export const WHIP_AT_MS = 60;
export const WHIP_DRAW_MS = 35;
export const WHIP_HOLD_MS = 180;
export const WHIP_ERASE_MS = 45;
/** Wind-up 120 ms, lunge and return 100 ms. */
export const ENEMY_MELEE_MS = 220;
export const ENEMY_RANGED_MS = 140;
/** Distance of the Pralka's lurch, of an enemy's wind-up (back) and lunge (forward), of a ranged enemy's recoil, in units. */
export const LURCH = 16;
export const WIND_UP = 6;
export const LUNGE = 12;
export const RECOIL = 4;
export const KICK = 6;
/** Rotation of the Konsultant's throwing arm, degrees. */
export const THROW_DEG = 40;
/** The whole lunging body of an enemy tilts this many degrees at the full lunge. */
export const LEAN_DEG = 8;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (p: number): number => p * p * (3 - 2 * p);
/** 0 -> 1 -> 0 over `dur` ms (peak in the middle); 0 outside. */
export const pulse = (t: number, dur: number): number => (t <= 0 || t >= dur ? 0 : Math.sin((Math.PI * t) / dur));

/** Piecewise smooth interpolation through [progress, value] keys sorted by progress. */
export function keyframes(p: number, keys: readonly (readonly [number, number])[]): number {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return 0;
  if (p <= first[0]) return first[1];
  if (p >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    const a = keys[i - 1];
    if (!a || !b || p > b[0]) continue;
    return a[1] + (b[1] - a[1]) * smooth((p - a[0]) / (b[0] - a[0] || 1));
  }
  return last[1];
}

/**
 * How far an enemy's body is from its place, along the line to its target (negative = away), `t` ms after the
 * attack began. Melee: leans back 6 over 120 ms, lunges 12 forward in 50 ms, is home 50 ms later. Ranged: a recoil.
 */
export function enemyOffset(t: number, ranged: boolean): number {
  if (ranged) return 0 - RECOIL * pulse(t, ENEMY_RANGED_MS);
  if (t <= 0 || t >= ENEMY_MELEE_MS) return 0;
  if (t < 120) return -WIND_UP * (1 - (1 - t / 120) * (1 - t / 120));
  if (t < 170) return -WIND_UP + (WIND_UP + LUNGE) * smooth((t - 120) / 50);
  return LUNGE * (1 - smooth((t - 170) / 50));
}

/** A hero's pose `t` ms into its auto-attack. Neutral values: 0, door 1, nothing drawn. */
export interface HeroPose {
  /** Whole body toward the target, units. */
  lurch: number;
  /** Throwing arm, degrees; negative swings the hand toward the target. */
  arm: number;
  /** Drum, degrees (absolute). */
  drum: number;
  /** Porthole door, horizontal scale about its hinge. */
  door: number;
  /** Instrument pushed away from the target, units. */
  kick: number;
  /** Helmet dip, units down, and tilt, degrees toward the target. */
  dip: number;
  tilt: number;
  /** The ticket has left the hand. */
  ticketOut: boolean;
  /** The Konsultant's cable: how far the tip is out toward the target, 0 (at the hand) .. 1 (on the target). */
  lash: number;
  /** The ticket card is stuck on the target at the tip of the cable. */
  card: boolean;
  /** The ink stroke of this attack, as the visible part of its length: from `erase` to `draw` (0..1 each). */
  draw: number;
  erase: number;
}

export function neutralPose(): HeroPose {
  return { lurch: 0, arm: 0, drum: 0, door: 1, kick: 0, dip: 0, tilt: 0, ticketOut: false, lash: 0, card: false, draw: 0, erase: 0 };
}

export function heroPose(id: HeroId, t: number): HeroPose {
  const pose = neutralPose();
  switch (id) {
    case 'pralka': {
      // 320 ms: the body surges 16 and holds, the drum turns one full revolution, the door swings open to a sliver and back
      const p = clamp01(t / 320);
      pose.lurch = LURCH * keyframes(p, [[0, 0], [0.28, 1], [0.55, 1], [1, 0]]);
      pose.drum = 360 * smooth(p);
      pose.door = 1 - 0.95 * keyframes(p, [[0, 0], [0.3, 1], [0.65, 1], [1, 0]]);
      // the whip: laid down as the body surges, fully drawn for 180 ms, then rubbed out from its root
      pose.draw = clamp01((t - WHIP_AT_MS) / WHIP_DRAW_MS);
      pose.erase = clamp01((t - WHIP_AT_MS - WHIP_DRAW_MS - WHIP_HOLD_MS) / WHIP_ERASE_MS);
      break;
    }
    case 'konsultant': {
      const p = clamp01(t / 160);
      pose.arm = keyframes(p, [[0, 0], [0.15, 30], [0.4, -THROW_DEG], [1, 0]]);
      // the ticket leaves the hand and comes back once the cable has snapped home
      pose.ticketOut = t >= 24 && t < LASH_OUT_MS + LASH_BACK_MS - 5;
      pose.lash = t <= 0 ? 0 : t < LASH_OUT_MS ? easeOut(t / LASH_OUT_MS) : t < LASH_OUT_MS + LASH_BACK_MS ? 1 - smooth((t - LASH_OUT_MS) / LASH_BACK_MS) : 0;
      pose.card = t >= LASH_OUT_MS && t < LASH_OUT_MS + LASH_BACK_MS - 10;
      break;
    }
    case 'petlowiec': {
      const k = keyframes(clamp01(t / 200), [[0, 0], [0.3, 1], [0.7, 1], [1, 0]]);
      pose.dip = 4 * k;
      pose.tilt = 10 * k;
      pose.draw = clamp01(t / 70);
      pose.erase = clamp01((t - 130) / 70);
      break;
    }
    case 'kartograf': {
      pose.kick = t < 25 ? (KICK * t) / 25 : KICK * (1 - clamp01((t - 25) / 115)) ** 2;
      pose.draw = clamp01(t / 80);
      pose.erase = clamp01((t - 80) / 120);
      break;
    }
  }
  return pose;
}

// ---------- geometry (pure) ----------

export interface Aim {
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Unit vector from attacker to target in world space ((1, 0) when they coincide) and the distance. */
  ux: number;
  uy: number;
  dist: number;
}

export function aimOf(x: number, y: number, tx: number, ty: number): Aim {
  const dist = Math.hypot(tx - x, ty - y);
  return dist < 0.001 ? { x, y, tx, ty, ux: 1, uy: 0, dist: 0 } : { x, y, tx, ty, ux: (tx - x) / dist, uy: (ty - y) / dist, dist };
}

/** Chord of the whip (about 40 units of ink once bowed); it starts clear of the front of the lurching cabinet. */
export const WHIP_CHORD = 40;
const WHIP_BOW = 16;

export interface WhipGeom {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  ex: number;
  ey: number;
  /** Unit vector across the whip, on the side it bows to. */
  nx: number;
  ny: number;
}

export function whipGeom(a: Aim): WhipGeom {
  const gap = Math.max(28, Math.min(40, a.dist - 20));
  const sx = a.x + a.ux * gap;
  const sy = a.y + a.uy * gap;
  const ex = sx + a.ux * WHIP_CHORD;
  const ey = sy + a.uy * WHIP_CHORD;
  // it always bows upward, like a swing, whichever side the target is on
  const sgn = a.ux < 0 ? -1 : 1;
  const nx = a.uy * sgn;
  const ny = -a.ux * sgn;
  return { sx, sy, cx: sx + a.ux * (WHIP_CHORD / 2) + nx * WHIP_BOW, cy: sy + a.uy * (WHIP_CHORD / 2) + ny * WHIP_BOW, ex, ey, nx, ny };
}

/** The Pralka's whip: a curved stroke from in front of the cabinet toward and through the target. */
export function whipPath(a: Aim): string {
  const w = whipGeom(a);
  return `M${n2(w.sx)} ${n2(w.sy)}Q${n2(w.cx)} ${n2(w.cy)} ${n2(w.ex)} ${n2(w.ey)}`;
}

/** Three drops of ink thrown off the tip of the whip: [x, y] each, drawn as dots. */
export function whipSplash(a: Aim): [number, number][] {
  const w = whipGeom(a);
  const at = (along: number, across: number): [number, number] => [Math.round((w.ex + a.ux * along + w.nx * across) * 100) / 100, Math.round((w.ey + a.uy * along + w.ny * across) * 100) / 100];
  return [at(6, 1.5), at(2.5, -6), at(11, -4.5)];
}

const LASH_WAVE = 3.5;
const LASH_WAVELENGTH = 38;

/**
 * The Konsultant's cable lashing out: from the hand at `root` toward the target, the tip a fraction `ext` of the way, a slight
 * travelling sine along it that dies out at both ends so the tip lands exactly on the target. Returns the path and the tip.
 */
export function lashPath(root: Vec, target: Vec, ext: number, t: number): { d: string; tip: Vec } {
  const dx = (target.x - root.x) * ext;
  const dy = (target.y - root.y) * ext;
  const len = Math.hypot(dx, dy);
  const tip = { x: root.x + dx, y: root.y + dy };
  if (len < 0.5) return { d: `M${n2(root.x)} ${n2(root.y)}h.01`, tip };
  const ux = dx / len;
  const uy = dy / len;
  const n = Math.max(8, Math.min(60, Math.ceil(len / 3)));
  let d = '';
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const amp = LASH_WAVE * Math.sin(Math.PI * u) * Math.min(1, len / 60);
    const off = amp * Math.sin((u * len) / LASH_WAVELENGTH * Math.PI * 2 - t * 0.05);
    d += `${k === 0 ? 'M' : 'L'}${n2(root.x + dx * u - uy * off)} ${n2(root.y + dy * u + ux * off)}`;
  }
  return { d, tip };
}
// ---------- handwriting (pure) ----------

/**
 * A line of illegible handwriting: `bumps` arches joined at the baseline, like "mmm", about `width` wide and `height` high,
 * centred on the origin. Seeded, so each remark has its own hand.
 */
export function scribblePath(rng: Rng, bumps: number, width: number, height: number): string {
  const step = width / bumps;
  let x = -width / 2;
  let d = `M${n2(x)} ${n2(rng.range(-0.6, 0.6))}`;
  for (let i = 0; i < bumps; i++) {
    const h = height * rng.range(0.6, 1.15);
    const x1 = x + step;
    d += `Q${n2(x + step / 2 + rng.range(-0.8, 0.8))} ${n2(-h * 1.75)} ${n2(x1)} ${n2(rng.range(-0.7, 0.7))}`;
    x = x1;
  }
  return d;
}

/** Where the range pole's sight is on the page, for a Kartograf drawn at `scale`, aiming at (tx, ty). */
export function measureStart(a: Aim, scale: number): { x: number; y: number } {
  const side = a.ux < 0 ? -1 : 1;
  return { x: a.x + side * 15 * scale, y: a.y - 22 * scale };
}

/** The kind of dotted measurement line: from the pole to the target, visible between `erase` and `draw`. */
export function measureSegment(a: Aim, scale: number, draw: number, erase: number): { d: string; offset: number; len: number } {
  const s = measureStart(a, scale);
  const dx = a.tx - s.x;
  const dy = a.ty - s.y;
  const len = Math.hypot(dx, dy);
  const x0 = s.x + dx * erase;
  const y0 = s.y + dy * erase;
  const x1 = s.x + dx * draw;
  const y1 = s.y + dy * draw;
  return { d: `M${n2(x0)} ${n2(y0)}L${n2(x1)} ${n2(y1)}`, offset: -erase * len, len };
}

// ---------- the record on a figure ----------

export interface AttackAnim extends Aim {
  ranged: boolean;
  /** Clock of the first frame that drew it; null until that frame (the event comes between two renders). */
  t0: number | null;
  /** The ink stroke in the fx layer, once there is one (`ink`: its paths, the last one is the ink). */
  fx: SVGElement | null;
  ink: SVGPathElement[];
  /** The Pralka's drops of ink at the tip of the whip, and whether they are showing. */
  splash: SVGPathElement | null;
  splashOn: boolean;
  /** The Konsultant's ticket card at the tip of the cable. */
  card: SVGGElement | null;
}

const active = new WeakMap<SVGGElement, AttackAnim>();
let fxNode: SVGGElement | null = null;

function fxLayer(): SVGGElement | null {
  if (fxNode?.isConnected) return fxNode;
  const node = typeof document === 'undefined' ? null : document.getElementById('fx');
  fxNode = node instanceof SVGGElement ? node : null;
  return fxNode;
}

function finish(g: SVGGElement, a: AttackAnim): void {
  a.fx?.remove();
  a.fx = null;
  a.ink = [];
  a.splash = null;
  a.card = null;
  if (active.get(g) === a) active.delete(g);
}

/** Start (or restart) the animation of the figure `g`. */
export function beginAttack(g: SVGGElement, x: number, y: number, tx: number, ty: number, ranged: boolean): void {
  const old = active.get(g);
  if (old) finish(g, old);
  active.set(g, { ...aimOf(x, y, tx, ty), ranged, t0: null, fx: null, ink: [], splash: null, splashOn: false, card: null });
}

const scratch: { a: AttackAnim | null; t: number } = { a: null, t: 0 };

/**
 * Called by a figure's patch every frame. Returns the live record and the ms since it began, or null when the
 * figure is not attacking (or just finished: the caller then puts its parts back). The result object is reused.
 */
export function attackAt(g: SVGGElement, now: number, durMs: number): { a: AttackAnim; t: number } | null {
  const a = active.get(g);
  if (!a) return null;
  if (a.t0 === null || now < a.t0) a.t0 = now;
  const t = now - a.t0;
  if (t >= durMs) {
    finish(g, a);
    return null;
  }
  scratch.a = a;
  scratch.t = t;
  return scratch as { a: AttackAnim; t: number };
}

/** Show the visible part [erase, draw] (0..1 of the length) of a path that has pathLength="1". */
export function setStroke(node: Element, draw: number, erase: number): void {
  const visible = Math.max(0.0005, draw - erase);
  node.setAttribute('stroke-dasharray', `${Math.round(visible * 1000) / 1000} 3`);
  node.setAttribute('stroke-dashoffset', String(Math.round(-erase * 1000) / 1000));
}

/** The one-stroke ink marks that belong to a hero's attack, drawn in the fx layer. */
export function driveHeroStroke(a: AttackAnim, id: HeroId, scale: number, draw: number, erase: number): void {
  if (id !== 'pralka' && id !== 'kartograf') return;
  if (draw <= 0 || erase >= 1) {
    a.fx?.remove();
    a.fx = null;
    a.ink = [];
    a.splash = null;
    return;
  }
  if (!a.fx) {
    const layer = fxLayer();
    if (!layer) return;
    let root: SVGElement;
    if (id === 'pralka') {
      // the stroke is laid over a slightly wider stroke of bare paper, so it reads on top of the figures it crosses
      const d = whipPath(a);
      const back = el('path', { d, pathLength: 1, 'stroke-width': 6, class: 'attack-ink-back' });
      back.style.stroke = 'var(--paper)';
      const front = el('path', { d, pathLength: 1, 'stroke-width': 2.8, class: 'attack-ink' });
      // the splash: three drops thrown off the tip once the lash has landed
      const drops = whipSplash(a);
      const splash = el('path', { d: drops.map(([x, y]) => `M${x} ${y}h.01`).join(''), 'stroke-width': 3.2, class: 'attack-ink' });
      splash.style.display = 'none';
      root = el('g', {}, [back, front, splash]);
      a.ink = [back, front];
      a.splash = splash;
      a.splashOn = false;
    } else {
      const dots = el('path', { 'stroke-dasharray': '1.5 4', 'stroke-width': 1.3, class: 'attack-ink' });
      root = dots;
      a.ink = [dots];
    }
    layer.append(root);
    a.fx = root;
    // a figure that vanishes mid-attack never calls finish: this removes the stroke anyway
    tween(1, () => undefined, { delay: 700, done: () => root.remove() });
  }
  if (id === 'pralka') {
    for (const path of a.ink) setStroke(path, draw, erase);
    const on = draw >= 1 && erase < 0.5;
    if (a.splash && on !== a.splashOn) {
      a.splashOn = on;
      a.splash.style.display = on ? '' : 'none';
    }
  } else {
    const seg = measureSegment(a, scale, draw, erase);
    a.ink[0]?.setAttribute('d', seg.d);
    a.ink[0]?.setAttribute('stroke-dashoffset', n2(seg.offset));
  }
}

/** A small ticket card, paper-filled, at the origin (the drawing of the thrown card, enlarged). */
function ticketCard(): SVGGElement {
  const sheet = el('path', { d: 'M-4.5-3.5H2.5L5 -1V3.5H-4.5Z', 'stroke-width': 1.1 });
  sheet.style.fill = 'var(--paper)';
  return el('g', {}, [sheet, el('path', { d: 'M2.5-3.5V-1H5M-2.5 0H2M-2.5 2H1', 'stroke-width': 1 })]);
}

/**
 * The Konsultant's cable: a lash from the hand `hand` (world) to the target, the tip out over 90 ms and home over 120, and
 * the ticket card stuck at the tip at the moment of the hit. One group in the fx layer, attributes only per frame.
 */
export function driveLash(a: AttackAnim, pose: HeroPose, t: number, hand: Vec): void {
  if (pose.lash <= 0) {
    a.fx?.remove();
    a.fx = null;
    a.ink = [];
    a.card = null;
    return;
  }
  if (!a.fx) {
    const layer = fxLayer();
    if (!layer) return;
    const back = el('path', { 'stroke-width': 4.6, class: 'attack-ink-back' });
    back.style.stroke = 'var(--paper)';
    const front = el('path', { 'stroke-width': 1.9, class: 'attack-ink' });
    const card = ticketCard();
    card.style.display = 'none';
    const root = el('g', {}, [back, front, card]);
    layer.append(root);
    a.fx = root;
    a.ink = [back, front];
    a.card = card;
    tween(1, () => undefined, { delay: 700, done: () => root.remove() });
  }
  const { d } = lashPath(hand, { x: a.tx, y: a.ty }, pose.lash, t);
  for (const path of a.ink) path.setAttribute('d', d);
  const card = a.card;
  if (card) {
    card.style.display = pose.card ? '' : 'none';
    if (pose.card) {
      // the card sits on the target (where the tip arrived), turned along the lash, mirrored when the lash goes left
      const deg = (Math.atan2(a.ty - hand.y, a.tx - hand.x) * 180) / Math.PI;
      const left = a.tx < hand.x;
      card.setAttribute('transform', `translate(${n2(a.tx)} ${n2(a.ty)}) rotate(${n2(deg)})${left ? ' scale(1 -1)' : ''} scale(1.7)`);
    }
  }
}

// ---------- the Petlowiec's remark landing ----------

/** The remarks in flight (their `<g>`) and where each was last drawn; a hit near one turns it into a struck-out word. */
const flying = new Map<SVGGElement, Vec>();
const LAND_RANGE = 110;

export function trackRemark(g: SVGGElement, x: number, y: number): void {
  if (flying.size > 12) for (const k of flying.keys()) if (!k.isConnected) flying.delete(k);
  const at = flying.get(g);
  if (at) {
    at.x = x;
    at.y = y;
  } else flying.set(g, { x, y });
}

/** A hit at (x, y): the nearest remark in flight lands there as a tiny word with a red line through it. */
export function landRemark(x: number, y: number): boolean {
  let best: SVGGElement | null = null;
  let bd = LAND_RANGE;
  for (const [g, at] of flying) {
    if (!g.isConnected) {
      flying.delete(g);
      continue;
    }
    const d = Math.hypot(at.x - x, at.y - y);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  if (!best) return false;
  flying.delete(best);
  struckWord(x, y - 14, Math.round(x * 31 + y * 17));
  return true;
}

/** The scribble that hit, small, crossed out with the editor's pen; it stays a moment and fades. */
function struckWord(x: number, y: number, seed: number): void {
  const layer = fxLayer();
  if (!layer) return;
  const rng = createRng(seed);
  const word = el('path', { d: scribblePath(rng, 3, 19, 5), 'stroke-width': 1.4, class: 'attack-ink' });
  const line = el('path', { d: `M-12 ${n2(rng.range(1, 2.5))}L12 ${n2(rng.range(-5, -3.5))}`, 'stroke-width': 1.5, pathLength: 1 });
  line.style.stroke = 'var(--accent)';
  line.style.strokeDasharray = '1 2';
  line.style.strokeDashoffset = '1';
  const g = el('g', { transform: `translate(${n2(x)} ${n2(y)}) rotate(${n2(rng.range(-8, 4))})` }, [word, line]);
  layer.append(g);
  tween(110, (p) => (line.style.strokeDashoffset = String(1 - p)), { ease: easeOut, delay: 40 });
  tween(380, (p) => (g.style.opacity = String(1 - p)), { delay: 520, done: () => g.remove() });
}

// ---------- the bus ----------

/** `attack:started` -> the attacker's figure starts moving. The one place this event becomes a picture. */
export function bindAttackFx(bus: Bus, views: Views): () => void {
  const offs = [
    bus.on('attack:started', (ev) => {
      const g = views.get(ev.attackerId);
      if (g) beginAttack(g, ev.x, ev.y, ev.tx, ev.ty, ev.ranged);
    }),
    // the Petlowiec's remark lands: the scribble becomes a struck-out word on the enemy
    bus.on('enemy:hit', (ev) => void landRemark(ev.x, ev.y)),
  ];
  return () => {
    for (const off of offs) off();
  };
}
