/**
 * Attack animations: a player can see an attack happen. `attack:started` (core/events.ts) opens a short
 * animation record on the attacker's `<g>`; the figure's own `patch` (heroFigures.ts, enemyFigures.ts) asks
 * `attackAt` once per frame and moves its cached sub-groups by the pose computed here. Everything is a pure
 * function of the milliseconds since the first drawn frame, on the same clock as the views (game time), so
 * a paused game freezes the picture and nothing here needs a timer.
 * The only DOM made here is one ink stroke in the fx layer (the Pralka's whip, the Kartograf's measurement);
 * it is changed by attributes only and removed when the animation ends.
 * Ink only: no particles, no glow, a few units of motion.
 */
import type { Bus } from '../core/events';
import type { HeroId } from '../heroes';
import { el, n2 } from './svg';
import { tween } from './tween';
import type { Views } from './view';

// ---------- timing (pure) ----------

export const HERO_ATTACK_MS: Record<HeroId, number> = { pralka: 210, konsultant: 160, petlowiec: 200, kartograf: 200 };
/** Wind-up 120 ms, lunge and return 100 ms. */
export const ENEMY_MELEE_MS = 220;
export const ENEMY_RANGED_MS = 140;
/** Distance of the Pralka's lurch, of an enemy's wind-up (back) and lunge (forward), of a ranged enemy's recoil, in units. */
export const LURCH = 10;
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
  /** The ink stroke of this attack, as the visible part of its length: from `erase` to `draw` (0..1 each). */
  draw: number;
  erase: number;
}

export function neutralPose(): HeroPose {
  return { lurch: 0, arm: 0, drum: 0, door: 1, kick: 0, dip: 0, tilt: 0, ticketOut: false, draw: 0, erase: 0 };
}

export function heroPose(id: HeroId, t: number): HeroPose {
  const pose = neutralPose();
  switch (id) {
    case 'pralka': {
      const p = clamp01(t / 180);
      pose.lurch = LURCH * Math.sin(Math.PI * p);
      pose.drum = 180 * smooth(p);
      pose.door = 1 - 0.85 * Math.sin(Math.PI * p);
      // the whip: drawn on the peak of the swing (90 ms), visible 120 ms, rubbed out from its root
      pose.draw = clamp01((t - 90) / 40);
      pose.erase = clamp01((t - 130) / 80);
      break;
    }
    case 'konsultant': {
      const p = clamp01(t / 160);
      pose.arm = keyframes(p, [[0, 0], [0.15, 30], [0.4, -THROW_DEG], [1, 0]]);
      pose.ticketOut = t >= 24 && p < 0.9;
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

/** Chord of the whip; the curve bulges to about 24 units of ink. It starts beyond the front of the cabinet. */
export const WHIP_CHORD = 20;
const WHIP_START = 26;

/** The Pralka's whip: a curved stroke between the hero and the target, centred on the middle of the gap. */
export function whipPath(a: Aim): string {
  const gap = Math.max(WHIP_START, a.dist * 0.5 - WHIP_CHORD / 2);
  const sx = a.x + a.ux * gap;
  const sy = a.y + a.uy * gap;
  const ex = sx + a.ux * WHIP_CHORD;
  const ey = sy + a.uy * WHIP_CHORD;
  // it always bows upward, like a swing, whichever side the target is on
  const sgn = a.ux < 0 ? -1 : 1;
  const cx = sx + a.ux * (WHIP_CHORD / 2) + a.uy * sgn * 12;
  const cy = sy + a.uy * (WHIP_CHORD / 2) - a.ux * sgn * 12;
  return `M${n2(sx)} ${n2(sy)}Q${n2(cx)} ${n2(cy)} ${n2(ex)} ${n2(ey)}`;
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
  if (active.get(g) === a) active.delete(g);
}

/** Start (or restart) the animation of the figure `g`. */
export function beginAttack(g: SVGGElement, x: number, y: number, tx: number, ty: number, ranged: boolean): void {
  const old = active.get(g);
  if (old) finish(g, old);
  active.set(g, { ...aimOf(x, y, tx, ty), ranged, t0: null, fx: null, ink: [] });
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
    return;
  }
  if (!a.fx) {
    const layer = fxLayer();
    if (!layer) return;
    let root: SVGElement;
    if (id === 'pralka') {
      // the stroke is laid over a slightly wider stroke of bare paper, so it reads on top of the figures it crosses
      const d = whipPath(a);
      const back = el('path', { d, pathLength: 1, 'stroke-width': 5.4, class: 'attack-ink-back' });
      back.style.stroke = 'var(--paper)';
      const front = el('path', { d, pathLength: 1, 'stroke-width': 2.6, class: 'attack-ink' });
      root = el('g', {}, [back, front]);
      a.ink = [back, front];
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
  } else {
    const seg = measureSegment(a, scale, draw, erase);
    a.ink[0]?.setAttribute('d', seg.d);
    a.ink[0]?.setAttribute('stroke-dashoffset', n2(seg.offset));
  }
}

// ---------- the bus ----------

/** `attack:started` -> the attacker's figure starts moving. The one place this event becomes a picture. */
export function bindAttackFx(bus: Bus, views: Views): () => void {
  return bus.on('attack:started', (ev) => {
    const g = views.get(ev.attackerId);
    if (g) beginAttack(g, ev.x, ev.y, ev.tx, ev.ty, ev.ranged);
  });
}
