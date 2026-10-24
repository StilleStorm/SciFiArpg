/**
 * Types and pen helpers for the part library. Parts are plain path data in a local frame; nothing here
 * touches the DOM, so the assembler and its tests run in node.
 *
 * Frames: a body is drawn with its bottom centre at (0, 0), x to the right (the enemy faces +x), y up is
 * negative. Heads are drawn with their neck at (0, 0). Decorations are drawn around their anchor (0, 0).
 */
import type { DamageType } from '../combat/damage';
import type { Vec } from '../core/vec';
import type { BossId, FamilyId } from './ids';

/** One drawable: outline strokes, thin detail strokes, hatched shapes and small solid ink dots. */
export interface Art {
  /** Outline strokes, normal pen. */
  line?: string;
  /** Detail strokes, thin pen. */
  thin?: string;
  /** Closed shapes filled with the #hatch pattern (no stroke). */
  hatch?: string;
  /** Closed shapes filled solid with ink (eyes, rivets, dots). */
  ink?: string;
}

export type AnchorId = 'topL' | 'topR' | 'back' | 'front' | 'side';
export const ANCHORS: readonly AnchorId[] = ['topL', 'topR', 'back', 'front', 'side'];

export type PartFont = 'mono' | 'monoBold' | 'serif' | 'title';
/** A bit of lettering drawn with a part. `key` is an i18n key; `literal` is for digits only. */
export interface PartText {
  key?: string;
  literal?: string;
  x: number;
  y: number;
  size: number;
  font: PartFont;
  rot?: number;
}

export interface RangedSpec {
  range: number;
  cooldown: number;
  /** Projectile speed in units per second. */
  speed: number;
  /** Fraction of the enemy's damage the shot deals. */
  damageMul: number;
  type: DamageType;
}

export interface BodyArt {
  art: Art;
  /** x of each leg's attachment on the bottom line (y = 0). */
  hips: number[];
  texts?: PartText[];
}

export interface BodyPart {
  id: string;
  family: FamilyId;
  /** Powiadomienia bodies belong to one escalation tier; 0 otherwise. */
  tier: number;
  /** Box of the body, x in [-w/2, w/2], y in [-h, 0]. h counts everything that rises above the hips. */
  w: number;
  h: number;
  /** Where a head attaches; null = no head. */
  neck: Vec | null;
  anchors: Record<AnchorId, Vec>;
  /** Number of seeded variants `draw(v)` understands. */
  variants: number;
  draw(v: number): BodyArt;
  /** Bodies with their own legs (Powiadomienia, Wygenerowane): one path per leg for the given phase. */
  ownLegs?: (v: number, phase: 0 | 1) => string[];
  /** Length of own legs (hip to ground). */
  ownLegLen?: number;
  /** Extra height above the body box taken by antennas and the like (counted in the total height). */
  rise: number;
  ranged?: RangedSpec;
  /** 0..1: how dotted the family drawing is (Wygenerowane). */
  dotted?: number;
  /** Chance that a head sits on this body. */
  headChance: number;
  boss?: BossId;
  /** One of the Anomalia's five faces (enemies/anomalia/faces/figures.ts): never picked by the random assembly. */
  figure?: true;
}

export interface LegPart {
  id: string;
  lenMin: number;
  lenMax: number;
  /** One path per leg for the phase; the count must not depend on the phase. */
  draw(hips: readonly number[], len: number, phase: 0 | 1): string[];
}

export interface HeadPart {
  id: string;
  /** Height above the neck. */
  h: number;
  /** Half width. */
  hw: number;
  art: Art;
}

export interface DecoOut {
  art: Art;
  texts?: PartText[];
}
export type DecoSlot = 'top' | 'side';
export interface DecoPart {
  id: string;
  family: FamilyId;
  slot: DecoSlot;
  /** Anchors this decoration may sit on, in order of preference. */
  anchors: readonly AnchorId[];
  /** Height above the anchor (counted for top decorations). */
  rise: number;
  draw(tier: number): DecoOut;
}

// ---------- pen helpers ----------

const r1 = (n: number): string => String(Math.round(n * 10) / 10);

/** A hand-drawn rectangle: four strokes that overshoot at the corners, as a pen would. */
export function box(x0: number, y0: number, x1: number, y1: number, o = 1.1): string {
  return (
    `M${r1(x0 - o)} ${r1(y0)}L${r1(x1 + o * 0.4)} ${r1(y0 - 0.3)}` +
    `M${r1(x1)} ${r1(y0 - o)}L${r1(x1 + 0.3)} ${r1(y1 + o * 0.4)}` +
    `M${r1(x1 + o)} ${r1(y1)}L${r1(x0 - o * 0.4)} ${r1(y1 + 0.3)}` +
    `M${r1(x0)} ${r1(y1 + o)}L${r1(x0 - 0.3)} ${r1(y0 - o * 0.4)}`
  );
}

/** A closed axis-aligned rectangle as one subpath (for hatch fills). */
export function rectPath(x0: number, y0: number, x1: number, y1: number): string {
  return `M${r1(x0)} ${r1(y0)}L${r1(x1)} ${r1(y0)}L${r1(x1)} ${r1(y1)}L${r1(x0)} ${r1(y1)}Z`;
}

/** Diagonal hatch strokes (slope up-right) clipped to a rectangle. */
export function hatchRect(x0: number, y0: number, x1: number, y1: number, gap = 3, flip = false): string {
  let d = '';
  const lo = flip ? x0 - y1 : x0 + y0;
  const hi = flip ? x1 - y0 : x1 + y1;
  for (let c = lo + gap / 2; c < hi; c += gap) {
    if (!flip) {
      const a = Math.max(x0, c - y1);
      const b = Math.min(x1, c - y0);
      if (b - a > 0.8) d += `M${r1(a)} ${r1(c - a)}L${r1(b)} ${r1(c - b)}`;
    } else {
      // lines y = x - c
      const a = Math.max(x0, c + y0);
      const b = Math.min(x1, c + y1);
      if (b - a > 0.8) d += `M${r1(a)} ${r1(a - c)}L${r1(b)} ${r1(b - c)}`;
    }
  }
  return d;
}

export function ell(cx: number, cy: number, rx: number, ry: number): string {
  return `M${r1(cx - rx)} ${r1(cy)}a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(2 * rx)} 0a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-2 * rx)} 0Z`;
}
export const circ = (cx: number, cy: number, r: number): string => ell(cx, cy, r, r);

/** Polyline through points (flat list x0 y0 x1 y1 ...). */
export function pl(...pts: number[]): string {
  let d = '';
  for (let i = 0; i + 1 < pts.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${r1(pts[i] ?? 0)} ${r1(pts[i + 1] ?? 0)}`;
  return d;
}
export function poly(...pts: number[]): string {
  return pl(...pts) + 'Z';
}

/** Join several Art records into one (for composite bodies). */
export function mergeArt(...arts: Art[]): Art {
  const out: Art = {};
  for (const a of arts) {
    for (const k of ['line', 'thin', 'hatch', 'ink'] as const) {
      const v = a[k];
      if (v) out[k] = (out[k] ?? '') + v;
    }
  }
  return out;
}
