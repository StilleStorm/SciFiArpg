/**
 * Aiming (DESIGN 5.6), pure logic. A skill declares a mode in heroes/defs.ts: auto, kierunek (a direction) or wskazanie (a point).
 * The pad (ui/pads.ts) turns a drag into an `Aim`; the skills (heroes/skills.ts) resolve it with the functions here, and the
 * preview (render/aimFx.ts) draws what the same functions say the skill will do, so the picture and the effect cannot disagree.
 */
import { isRebuttal } from '../combat/claims';
import type { Enemy } from '../entities/types';
import type { RunState } from '../world/run';
import type { AimMode, SkillDef } from './defs';
import { areaOf, nearestEnemy } from './helpers';
import { BEBEN_REACH, KSIEZYC_ORBIT, LEGENDA_R, ROZLACZENIE_REACH, START_R } from './numbers';
import { PARADOKS_R, POWTORZENIE_REACH } from './petlowiec/numbers';

export type Aim =
  | { kind: 'auto'; target?: Enemy | null }
  | { kind: 'kierunek'; dx: number; dy: number }
  | { kind: 'wskazanie'; x: number; y: number };

export const AUTO_AIM: Aim = { kind: 'auto' };

export interface Point {
  x: number;
  y: number;
}

/** A finger must travel this far (css px) from where it landed before a press becomes an aimed cast. */
export const DRAG_START_PX = 8;
/** A press shorter than this, and moved less than DRAG_START_PX, is a tap. */
export const TAP_MS = 180;
/** The pad's circle (css px, radius): a release inside it cancels an aimed cast. */
export const PAD_R = 22;
/** One screen px of drag is this many world units for a point (wskazanie). */
export const DRAG_SCALE = 1.6;
/** A tap on a point skill with no target aims this far ahead of the hero (world units). */
export const AHEAD = 120;
/** Proszę czekać takes the enemy nearest to the aimed point if it is within this many units. */
export const PICK_RADIUS = 60;
/** Triangulacja's shot: speed and lifetime (heroes/skills.ts flies it, the preview draws its length). */
export const LINE_SPEED = 680;
export const LINE_TTL = 0.62;
/** The circle drawn round the enemy Proszę czekać would take: its radius plus this (the figure is drawn wider than its radius). */
export const TARGET_RING = 26;

/** Nalesnik: how far Orbita rolls (units), and the radius of the flag's zone before ranks (heroes/skills.ts uses both). */
export const ORBITA_LENGTH = 230;
export const WNIOSEK_RADIUS = 120;

interface Geometry {
  /** How far a target may be for the auto cast. */
  autoRange(s: RunState): number;
  /** Kierunek: the arrow's length. Wskazanie: how far the point may be from the hero. */
  reach(s: RunState): number;
  /** Wskazanie: the radius of the circle drawn at the point. */
  radius(s: RunState): number;
}

const DEFAULT_RANGE = 240;

/** Reach and area of the six aimed skills; the numbers are the ones heroes/skills.ts uses. */
const GEOMETRY: Record<string, Geometry> = {
  odwirowanie: { autoRange: () => DEFAULT_RANGE, reach: (s) => 150 * areaOf(s, 2), radius: () => 0 },
  przekierowuje: { autoRange: () => DEFAULT_RANGE, reach: (s) => 150 * areaOf(s, 1), radius: () => 0 },
  triangulacja: { autoRange: () => 340, reach: (s) => LINE_SPEED * LINE_TTL * areaOf(s, 0), radius: () => 0 },
  prosze: { autoRange: (s) => 300 * areaOf(s, 0), reach: (s) => 300 * areaOf(s, 0), radius: () => 14 },
  teren: { autoRange: () => 300, reach: () => 300, radius: (s) => 85 * areaOf(s, 1) },
  korekta: { autoRange: () => 260, reach: (s) => 150 * areaOf(s, 2), radius: () => 14 },
  orbita: { autoRange: () => DEFAULT_RANGE, reach: (s) => ORBITA_LENGTH * areaOf(s, 0), radius: () => 0 },
  wniosek: { autoRange: () => 260, reach: () => 260, radius: (s) => WNIOSEK_RADIUS * areaOf(s, 2) },
  // the fourth and fifth skills (DESIGN 10.1); the area scales by the skill's own index (3 or 4)
  beben: { autoRange: () => DEFAULT_RANGE, reach: (s) => BEBEN_REACH * areaOf(s, 3), radius: () => 0 },
  numer: { autoRange: (s) => 300 * areaOf(s, 3), reach: (s) => 300 * areaOf(s, 3), radius: () => 14 },
  rozlaczenie: { autoRange: () => DEFAULT_RANGE, reach: (s) => ROZLACZENIE_REACH * areaOf(s, 4), radius: () => 0 },
  start: { autoRange: () => 260, reach: () => 260, radius: (s) => START_R * areaOf(s, 4) },
  legenda: { autoRange: () => 260, reach: () => 260, radius: (s) => LEGENDA_R * areaOf(s, 4) },
  ksiezyc: { autoRange: () => DEFAULT_RANGE, reach: (s) => KSIEZYC_ORBIT * areaOf(s, 4), radius: () => 0 },
  // S19: the Konsultant's skills 6 to 10 (indices 5 to 9): a ticket 260 away, a form of 60 within 300, a step back of 120, a phone of 110 within 300
  zgloszenie: { autoRange: () => 260, reach: () => 0, radius: () => 0 },
  formularz: { autoRange: () => 300, reach: () => 300, radius: (s) => 60 * areaOf(s, 6) },
  przerwaTechniczna: { autoRange: () => DEFAULT_RANGE, reach: () => 120, radius: () => 0 },
  oddzwonimy: { autoRange: () => 300, reach: () => 300, radius: (s) => 110 * areaOf(s, 9) },
  // S20: the Kartograf's skills 6 to 10 (indices 5 to 9): a measured line 300 away, five lines of 220, a border put 70 ahead, a benchmark of 60 within 260, a rose round him
  pomiar: { autoRange: () => 300, reach: () => 0, radius: () => 0 },
  przekroj: { autoRange: () => DEFAULT_RANGE, reach: () => 220, radius: () => 0 },
  granica: { autoRange: () => DEFAULT_RANGE, reach: () => 130, radius: () => 0 },
  punktOdniesienia: { autoRange: () => 260, reach: () => 260, radius: () => 60 },
  rozaWiatrow: { autoRange: () => 140, reach: () => 0, radius: () => 0 },
  // S21: the Nalesnik's skills 6 to 10 (indices 5 to 9): a short roll at a target within 115, a band round him, a round-up on the spot, a hop of up to 140 landing in 100, a curve of 200
  krawedz: { autoRange: () => 115, reach: () => 0, radius: () => 0 },
  pierscien: { autoRange: () => DEFAULT_RANGE, reach: () => 0, radius: () => 0 },
  zaokraglenie: { autoRange: () => DEFAULT_RANGE, reach: () => 0, radius: () => 0 },
  upadek: { autoRange: () => 140, reach: () => 140, radius: (s) => 100 * areaOf(s, 8) },
  zmianaOrbity: { autoRange: () => 200, reach: () => 200, radius: () => 0 },
  // S19: Pralka's Odpompowanie (skill 10, index 9): a puddle of 100 at a point up to 260 away
  odpompowanie: { autoRange: () => 260, reach: () => 260, radius: (s) => 100 * areaOf(s, 9) },
  // S20: the Petlowiec's skills 6 to 10 (indices 5 to 9): a remark at a target within 260, a line of 180, a clock of 110 within 260 (Paradoks, index 7)
  uwaga: { autoRange: () => 260, reach: () => 0, radius: () => 0 },
  powtorzenie: { autoRange: () => DEFAULT_RANGE, reach: (s) => POWTORZENIE_REACH * areaOf(s, 6), radius: () => 0 },
  paradoks: { autoRange: () => 260, reach: () => 260, radius: (s) => PARADOKS_R * areaOf(s, 7) },
};

/** The arrow length (kierunek) or the farthest point (wskazanie) of a skill; 0 for an auto skill. */
export const reachOf = (s: RunState, skill: SkillDef): number => (GEOMETRY[skill.id]?.reach(s) ?? 0) * (skill.patch?.reach ?? 1);
/** Radius of the circle drawn for a wskazanie skill. */
export const radiusOf = (s: RunState, skill: SkillDef): number => GEOMETRY[skill.id]?.radius(s) ?? 0;
/** How far the auto cast looks for a target. */
export const autoRangeOf = (s: RunState, skill: SkillDef): number => GEOMETRY[skill.id]?.autoRange(s) ?? DEFAULT_RANGE;

// ---------- auto target ----------

/**
 * The best target in range for the auto cast: an enemy whose standing claim has the skill's damage type (a rebuttal, DESIGN 5.2)
 * before the nearest one. Null when nobody is in range.
 */
export function autoTarget(s: RunState, skill: SkillDef, range: number = autoRangeOf(s, skill)): Enemy | null {
  const p = s.player;
  let nearest: Enemy | null = null;
  let nd = range + 1e-6;
  let match: Enemy | null = null;
  let md = range + 1e-6;
  for (const e of s.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nd) {
      nd = d;
      nearest = e;
    }
    if (d < md && isRebuttal(e.claim, skill.type)) {
      md = d;
      match = e;
    }
  }
  return match ?? nearest;
}

// ---------- drag -> aim ----------

/** Keep an aim of another kind than the skill's mode out of the skill: it is the auto cast then. */
export function fitAim(skill: SkillDef, aim: Aim): Aim {
  return aim.kind === 'auto' || aim.kind === skill.aim ? aim : AUTO_AIM;
}

/**
 * A drag from the pad to `pointer` (both in client px) as an aim. Kierunek: the unit vector of the drag from the pad's centre
 * (screen and world directions agree, the view is only scaled). Wskazanie: the hero's position plus the drag scaled
 * DRAG_SCALE world units per px, held to `range` from the hero. A drag with no length is the auto aim.
 */
export function dragToAim(mode: AimMode, pad: Point, pointer: Point, hero: Point, range: number): Aim {
  if (mode === 'auto') return AUTO_AIM;
  const vx = pointer.x - pad.x;
  const vy = pointer.y - pad.y;
  const len = Math.hypot(vx, vy);
  if (len < 1e-6) return AUTO_AIM;
  if (mode === 'kierunek') return { kind: 'kierunek', dx: vx / len, dy: vy / len };
  const p = clampTo(hero, hero.x + vx * DRAG_SCALE, hero.y + vy * DRAG_SCALE, range);
  return { kind: 'wskazanie', x: p.x, y: p.y };
}

/** Released back over the pad: the cast is cancelled. */
export const isCancel = (pointer: Point, pad: Point, radius = PAD_R): boolean => Math.hypot(pointer.x - pad.x, pointer.y - pad.y) <= radius;

/** A quick touch that hardly moved is a tap. */
export const isTap = (ms: number, movedPx: number): boolean => ms < TAP_MS && movedPx < DRAG_START_PX;

function clampTo(from: Point, x: number, y: number, range: number): Point {
  const d = Math.hypot(x - from.x, y - from.y);
  if (range <= 0 || d <= range) return { x, y };
  return { x: from.x + ((x - from.x) / d) * range, y: from.y + ((y - from.y) / d) * range };
}

// ---------- aim -> what the skill does ----------

/** The joystick direction while a thumb is on the stick. */
function steerDir(s: RunState): { dx: number; dy: number } | null {
  const st = s.player.steer;
  return st && st.mag > 0 ? { dx: st.dx, dy: st.dy } : null;
}

/** Straight ahead: the stick's direction if it is held, else the way the hero faces. */
function ahead(s: RunState): { dx: number; dy: number } {
  return steerDir(s) ?? { dx: s.player.facing, dy: 0 };
}

/**
 * The direction of a kierunek skill. A drag gives it. A tap uses the joystick direction if the stick is held, else the
 * direction to the auto target, else the way the hero faces. `target` is the enemy aimed at, if the aim named one.
 */
export function resolveDirection(s: RunState, skill: SkillDef, aim: Aim): { dx: number; dy: number; target: Enemy | null } {
  const a = fitAim(skill, aim);
  if (a.kind === 'kierunek') {
    const l = Math.hypot(a.dx, a.dy);
    if (l > 1e-6) return { dx: a.dx / l, dy: a.dy / l, target: null };
  }
  const named = a.kind === 'auto' ? (a.target ?? null) : null;
  if (!named) {
    const st = steerDir(s);
    if (st) return { dx: st.dx, dy: st.dy, target: null };
  }
  const p = s.player;
  const target = named ?? autoTarget(s, skill);
  if (target) {
    const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
    return { dx: (target.x - p.x) / d, dy: (target.y - p.y) / d, target };
  }
  return { dx: p.facing, dy: 0, target: null };
}

/** Proszę czekać: the enemy nearest to the aimed point (within PICK_RADIUS), else the auto target. Null: nobody. */
export function pickTarget(s: RunState, skill: SkillDef, aim: Aim): Enemy | null {
  const a = fitAim(skill, aim);
  if (a.kind === 'wskazanie') {
    const near = nearestEnemy(s, a.x, a.y, PICK_RADIUS);
    if (near) return near;
  } else if (a.kind === 'auto' && a.target) return a.target;
  return autoTarget(s, skill);
}

/** Teren nieistniejący and Wniosek o status: the centre of the marked area. A tap marks the auto target's place, else a point ahead. */
export function terenCentre(s: RunState, skill: SkillDef, aim: Aim): Point {
  const a = fitAim(skill, aim);
  const p = s.player;
  if (a.kind === 'wskazanie') return clampTo(p, a.x, a.y, reachOf(s, skill));
  const target = (a.kind === 'auto' ? a.target : null) ?? autoTarget(s, skill);
  if (target) return { x: target.x, y: target.y };
  const d = ahead(s);
  return { x: p.x + d.dx * AHEAD, y: p.y + d.dy * AHEAD };
}

/**
 * Korekta: the blink as a direction and a length (never more than the reach). A point sets it. A tap blinks toward where the
 * hero is walking, else straight ahead: the blink is a way out, so it does not default to the nearest enemy.
 */
export function blinkOf(s: RunState, skill: SkillDef, aim: Aim): { dx: number; dy: number; len: number } {
  const a = fitAim(skill, aim);
  const p = s.player;
  const reach = reachOf(s, skill);
  const goal: Point | null = a.kind === 'wskazanie' ? a : a.kind === 'auto' && a.target ? a.target : p.target;
  if (goal) {
    const d = Math.hypot(goal.x - p.x, goal.y - p.y);
    if (d > 4) return { dx: (goal.x - p.x) / d, dy: (goal.y - p.y) / d, len: Math.min(d, reach) };
  }
  const d = ahead(s);
  return { dx: d.dx, dy: d.dy, len: Math.min(AHEAD, reach) };
}

// ---------- what to draw and what to report ----------

/** What the held pad draws: a dotted arrow from the hero, or a dotted circle at a point. All in world units. */
export type AimPreview = { kind: 'arrow'; x: number; y: number; x2: number; y2: number } | { kind: 'circle'; x: number; y: number; r: number };

/** The preview of `aim` for `skill`, or null when there is nothing to show (an auto skill, or nobody to aim at). */
export function previewOf(s: RunState, skill: SkillDef, aim: Aim): AimPreview | null {
  const p = s.player;
  if (skill.aim === 'kierunek') {
    const d = resolveDirection(s, skill, aim);
    const len = reachOf(s, skill);
    return { kind: 'arrow', x: p.x, y: p.y, x2: p.x + d.dx * len, y2: p.y + d.dy * len };
  }
  if (skill.aim !== 'wskazanie') return null;
  const r = radiusOf(s, skill);
  if (skill.id === 'prosze' || skill.id === 'numer') {
    const target = pickTarget(s, skill, aim);
    if (target) return { kind: 'circle', x: target.x, y: target.y, r: target.r + TARGET_RING };
    const a = fitAim(skill, aim);
    return a.kind === 'wskazanie' ? { kind: 'circle', x: a.x, y: a.y, r } : null;
  }
  if (skill.id === 'teren' || skill.id === 'wniosek' || skill.id === 'start' || skill.id === 'legenda' || skill.id === 'odpompowanie' || skill.id === 'formularz' || skill.id === 'oddzwonimy' || skill.id === 'punktOdniesienia' || skill.id === 'paradoks' || skill.id === 'upadek') {
    const c = terenCentre(s, skill, aim);
    return { kind: 'circle', x: c.x, y: c.y, r };
  }
  const b = blinkOf(s, skill, aim);
  return { kind: 'circle', x: p.x + b.dx * b.len, y: p.y + b.dy * b.len, r };
}

/** The aim as the skill will use it, both as a direction and a point (events `skill:aim` and `skill:cast`). */
export interface ResolvedAim {
  kind: AimMode;
  dx: number;
  dy: number;
  x: number;
  y: number;
}

export function resolveAim(s: RunState, skill: SkillDef, aim: Aim): ResolvedAim {
  const p = s.player;
  const kind = fitAim(skill, aim).kind === 'auto' ? 'auto' : skill.aim;
  if (skill.aim === 'kierunek') {
    const d = resolveDirection(s, skill, aim);
    const len = reachOf(s, skill);
    return { kind, dx: d.dx, dy: d.dy, x: p.x + d.dx * len, y: p.y + d.dy * len };
  }
  if (skill.aim === 'wskazanie') {
    const pv = previewOf(s, skill, aim);
    const x = pv ? pv.x : p.x;
    const y = pv ? pv.y : p.y;
    const d = Math.hypot(x - p.x, y - p.y) || 1;
    return { kind, dx: (x - p.x) / d, dy: (y - p.y) / d, x, y };
  }
  return { kind: 'auto', dx: p.facing, dy: 0, x: p.x, y: p.y };
}

// ---------- hand-over from the pad to the cast ----------

let queued: { slot: number; aim: Aim } | null = null;

/**
 * The pad puts the aim here just before it emits `skill:N` and clears it right after (the emit is synchronous), because that
 * event carries no payload. `castSkill` takes it when it is called without an aim.
 */
export function queueAim(slot: number, aim: Aim): void {
  queued = { slot, aim };
}
export function takeQueuedAim(slot: number): Aim | null {
  const q = queued;
  if (!q || q.slot !== slot) return null;
  queued = null;
  return q.aim;
}
export function clearQueuedAim(): void {
  queued = null;
}

// ---------- the live run, for the pad ----------

let live: RunState | null = null;

/** The hero system notes the run it steps; the pad reads it to compute and draw a held aim (the pad has no state of its own). */
export function trackRun(s: RunState): void {
  live = s;
}
export function trackedRun(): RunState | null {
  return live;
}
