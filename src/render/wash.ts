/**
 * Paint (DESIGN 3.4): a wash is a pale watercolour stain that sits under a figure's ink and does not respect it.
 * Two overlapping ragged blobs of one hue, flat translucent fill, no stroke, no filter, no gradient. The pair is
 * offset from the figure by a few units, so the line and the stain live separate lives.
 * Pure geometry (`washShape`) is separate from the DOM (`washGroup`) so it can be tested. Built once in `create`,
 * never touched per frame. The colours are CSS variables (`--wash-<hue>`), the night edition dims them through
 * `--wash-alpha` (see `.wash` in style.css).
 */
import type { Rng } from '../core/rng';
import type { FamilyId } from '../enemies/ids';
import type { HeroId } from '../heroes';
import type { ItemTier } from '../items/types';
import type { Vec } from '../core/vec';
import { el, n2, smoothClosed } from './svg';

export type WashHue = 'indigo' | 'brick' | 'violet' | 'green' | 'ochre' | 'yellow';

export const WASH_HUES: readonly WashHue[] = ['indigo', 'brick', 'violet', 'green', 'ochre', 'yellow'];

/** Day values (also in style.css as --wash-<hue>). Watered down by opacity, never used at full strength. */
export const WASH_HEX: Record<WashHue, string> = {
  indigo: '#3f5f8f',
  brick: '#b5572e',
  violet: '#7a5a9c',
  green: '#4f7a52',
  ochre: '#c89a2a',
  yellow: '#e8c43a',
};

/** The hues a loose stain on the page may take (the star yellow is for gwiazdki only). */
export const STAIN_HUES: readonly WashHue[] = ['indigo', 'brick', 'violet', 'green', 'ochre'];

export const washVar = (hue: WashHue): string => `var(--wash-${hue})`;

export const HERO_HUE: Record<HeroId, WashHue> = {
  pralka: 'indigo',
  konsultant: 'ochre',
  petlowiec: 'violet',
  kartograf: 'green',
  nalesnik: 'ochre',
};

export const FAMILY_HUE: Record<FamilyId, WashHue> = {
  urzadzenia: 'indigo',
  powiadomienia: 'brick',
  wygenerowane: 'violet',
};

/** Rarity decides the hue of a card's stain; a wariant or a free version is brick. */
export const TIER_HUE: Record<ItemTier, WashHue> = {
  zwykly: 'ochre',
  nietypowy: 'indigo',
  rzadki: 'green',
  unikatowy: 'violet',
};

/** Opacity bounds of a wash (DESIGN 3.4: 0.2-0.4, nothing stronger). */
export const WASH_MIN = 0.16;
export const WASH_MAX = 0.42;
const clampOpacity = (v: number): number => Math.min(WASH_MAX, Math.max(WASH_MIN, v));

export interface BlobOpts {
  /** Number of outline points; default 11-13. */
  count?: number;
  /** Depth of the waves on the edge, as a fraction of r; default 0.2-0.32. */
  jitter?: number;
}

/**
 * Outline points of a stain: the radius follows two or three low harmonics of the angle plus a little
 * noise, so the edge waves like soaked paper and never pinches into a spike (independent per-point
 * radii would do that once the curve is smoothed).
 */
export function washPoints(rng: Rng, cx: number, cy: number, r: number, count: number, jitter: number): Vec[] {
  const phase = rng.range(0, Math.PI * 2);
  const k1 = rng.int(2, 3);
  const k2 = rng.int(4, 6);
  const p1 = rng.range(0, Math.PI * 2);
  const p2 = rng.range(0, Math.PI * 2);
  const a1 = jitter * rng.range(0.55, 0.75);
  const a2 = jitter * rng.range(0.2, 0.35);
  const pts: Vec[] = [];
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2 + rng.range(-0.06, 0.06);
    const rr = r * (1 + a1 * Math.sin(k1 * a + p1) + a2 * Math.sin(k2 * a + p2) + rng.range(-0.04, 0.04));
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

/** A closed ragged blob around (cx, cy): the edge of soaked paper. */
export function washPath(rng: Rng, cx: number, cy: number, r: number, opts: BlobOpts = {}): string {
  const count = opts.count ?? rng.int(11, 13);
  const jitter = opts.jitter ?? rng.range(0.2, 0.32);
  return smoothClosed(washPoints(rng, cx, cy, r, count, jitter));
}

export interface WashOpts {
  /** Centre of the figure the stain belongs to (the stain is then offset from it). */
  cx?: number;
  cy?: number;
  /** Fill opacity of the outer blob; the inner one is 0.02 lighter. Default 0.22. */
  opacity?: number;
  /** Added to both blobs (bosses: 0.1). */
  bonus?: number;
  /** Distance of the whole stain from (cx, cy). Default 2-6 units. */
  offset?: readonly [number, number];
}

export interface WashShape {
  hue: WashHue;
  /** The outer blob and the inner one, in drawing order. */
  blobs: readonly { d: string; opacity: number }[];
  /** Where the stain sits relative to the figure's centre. */
  dx: number;
  dy: number;
}

/**
 * Geometry of one wash of radius `r`: an outer blob (r x 1.0-1.25) and an inner one (r x 0.55-0.8) shifted by
 * 0.15-0.35 r in a random direction, the pair pushed 2-6 units off the figure.
 */
export function washShape(rng: Rng, hue: WashHue, r: number, opts: WashOpts = {}): WashShape {
  const cx = opts.cx ?? 0;
  const cy = opts.cy ?? 0;
  const [lo, hi] = opts.offset ?? [2, 6];
  const bonus = opts.bonus ?? 0;
  const base = opts.opacity ?? 0.22;
  const a = rng.range(0, Math.PI * 2);
  const dist = rng.range(lo, hi);
  const dx = Math.cos(a) * dist;
  const dy = Math.sin(a) * dist;
  const ox = cx + dx;
  const oy = cy + dy;
  const outerR = r * rng.range(1.0, 1.25);
  const innerR = r * rng.range(0.55, 0.8);
  const ia = rng.range(0, Math.PI * 2);
  const idist = r * rng.range(0.15, 0.35);
  const outer = washPath(rng, ox, oy, outerR);
  const inner = washPath(rng, ox + Math.cos(ia) * idist, oy + Math.sin(ia) * idist, innerR);
  return {
    hue,
    blobs: [
      { d: outer, opacity: clampOpacity(base + bonus) },
      { d: inner, opacity: clampOpacity(base - 0.02 + bonus) },
    ],
    dx,
    dy,
  };
}

export interface WashGroupOpts extends WashOpts {
  /** Half strength (a summon's stain): class wash-faint. */
  faint?: boolean;
}

/** A `<g class="wash">` with the two blobs. Fills only, never a stroke; opacity comes from the attributes and `.wash`. */
export function washGroup(rng: Rng, hue: WashHue, r: number, opts: WashGroupOpts = {}): SVGGElement {
  const shape = washShape(rng, hue, r, opts);
  const g = el('g', { class: opts.faint ? 'wash wash-faint' : 'wash' });
  for (const b of shape.blobs) {
    g.append(el('path', { d: b.d, fill: washVar(hue), 'fill-opacity': n2(b.opacity), stroke: 'none' }));
  }
  return g;
}

/** The ink layer's fade (ink.ts) treats paths inside a wash as paint, not as strokes. */
export const isWashPath = (node: Element): boolean => node.parentElement?.classList.contains('wash') === true;
