/**
 * Ultimates as data (S3, DESIGN 10.2: argument ostateczny). An ultimate is its numbers plus a cast and a tick that call the
 * primitives; it has three paragraphs like a skill. Types and `defineUltimate` only: no registry, so hero folders may import it.
 * The runtime (meter spent, stamp, page reaction, ticking) is heroes/ultimate.ts.
 *
 * Limits every ultimate keeps (tested for all of them, in all three paragraphs): at most `MAX_ULT_S` seconds, one stamp, one
 * page reaction (a margin note), a radius of at most `MAX_ULT_RADIUS` or the hero's own path; at most one ultimate per hero acts
 * page-wide, and only by laying a status.
 */
import type { Bus } from '../core/events';
import type { DamageType } from '../combat/damage';
import type { Player } from '../entities/types';
import type { RunState } from '../world/run';
import type { Ctx } from './primitives/ctx';
import type { ParagraphNo, ParagraphPatch } from './paragraphs';
import type { ActiveUlt } from './state';
import type { HeroId } from './registry';

export const MAX_ULT_S = 8;
export const MAX_ULT_RADIUS = 220;
/** The level at which a hero's first ultimate opens (DESIGN 10.2: 12 / 24 / 36). */
export const FIRST_ULTIMATE_LEVEL = 12;

/**
 * One paragraph: the patch (the closed vocabulary of heroes/paragraphs.ts, at most four fields; here `dur` multiplies the seconds,
 * `dmg` the damage, `count` adds copies, `cost` is racja lost at the cast) and `tune`, the numbers that belong to this ultimate alone.
 */
export interface UltimateParagraph {
  n: ParagraphNo;
  nameKey: string;
  descKey: string;
  patch: ParagraphPatch;
  tune: Readonly<Record<string, number>>;
}

/** What a cast or a tick may read: the run, the ultimate being cast, its resolved numbers. */
export interface UltEnv {
  c: Ctx;
  s: RunState;
  bus: Bus;
  p: Player;
  def: UltimateDef;
  /** The running record (at the cast: the one just made, `left` full). */
  u: ActiveUlt;
  patch: ParagraphPatch;
  /** The damage type of the active paragraph. */
  type: DamageType;
  /** A number of the active paragraph's `tune`, else the base number of the ultimate. */
  tune(key: string, base: number): number;
}

export interface UltimateDef {
  id: string;
  /** Level at which it opens. */
  level: number;
  /** Base damage type (a paragraph's `patch.type` replaces it). */
  type: DamageType;
  /** Base seconds; the paragraph's `dur` multiplies it, `MAX_ULT_S` caps it. */
  seconds: number;
  /** Largest radius it acts in, or null when it follows the hero's own path or acts page-wide through a status. */
  radius: number | null;
  /** True for the one ultimate of the hero that reaches the whole page, and then only by a status. */
  pageWide: boolean;
  nameKey: string;
  descKey: string;
  stampKey: string;
  /** The page reaction: a margin note, `{number}` is filled with the ticket number. */
  noteKey: string;
  /** Radius of the ring it draws round the hero, which the margin note must stand clear of (heroes/ultimate.ts `ultNoteY`). */
  noteClear?: number;
  list: readonly [UltimateParagraph, UltimateParagraph, UltimateParagraph];
  /** The instant part of the cast. Runs once, after the cost is paid. */
  cast(e: UltEnv): void;
  /** Every step while it lasts. */
  tick?(e: UltEnv, dt: number): void;
  /** When the time is up. */
  end?(e: UltEnv): void;
}

export interface UltimateSpec {
  id: string;
  level?: number;
  type: DamageType;
  seconds: number;
  radius: number | null;
  pageWide?: boolean;
  noteClear?: number;
  two: { patch: ParagraphPatch; tune?: Record<string, number> };
  three: { patch: ParagraphPatch; tune?: Record<string, number> };
  cast: UltimateDef['cast'];
  tick?: UltimateDef['tick'];
  end?: UltimateDef['end'];
}

/** Build an ultimate. Keys: `heroes.<hero>.ult.<id>.{name,desc,stamp,note}` and `.para.<n>.{name,desc}` (src/i18n/pl/heroes/<hero>.json). */
export function defineUltimate(hero: HeroId, o: UltimateSpec): UltimateDef {
  const base = `heroes.${hero}.ult.${o.id}`;
  const para = (n: ParagraphNo, patch: ParagraphPatch, tune: Record<string, number> = {}): UltimateParagraph => ({
    n,
    nameKey: `${base}.para.${n}.name`,
    descKey: `${base}.para.${n}.desc`,
    patch,
    tune,
  });
  const def: UltimateDef = {
    id: o.id,
    level: o.level ?? FIRST_ULTIMATE_LEVEL,
    type: o.type,
    seconds: o.seconds,
    radius: o.radius,
    pageWide: o.pageWide === true,
    nameKey: `${base}.name`,
    descKey: `${base}.desc`,
    stampKey: `${base}.stamp`,
    noteKey: `${base}.note`,
    list: [para(1, {}), para(2, o.two.patch, o.two.tune), para(3, o.three.patch, o.three.tune)],
    cast: o.cast,
  };
  if (o.noteClear !== undefined) def.noteClear = o.noteClear;
  if (o.tick) def.tick = o.tick;
  if (o.end) def.end = o.end;
  return def;
}

/** Gather `dt` into `u.acc` and call `fn` once for every whole second reached (a tick of "x per second" damage). */
export function perSecond(u: ActiveUlt, dt: number, fn: () => void): void {
  u.acc += dt;
  while (u.acc >= 1 - 1e-6) {
    u.acc -= 1;
    fn();
  }
}
