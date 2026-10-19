/**
 * Paragraphs (S2, DESIGN 10.2): every skill has three variants, § 1 the base, § 2 and § 3 patches on its data. A patch is a
 * handful of fields from a closed vocabulary (at most `PATCH_FIELD_LIMIT`); `applyParagraph` lays one on a `SkillDef` at cast,
 * and the numbers a skill reads (power, area, duration, reach, width, count) are read through heroes/helpers.ts from the patch
 * the run keeps in `HeroRun.patch`. Types and pure functions only: no registry, so heroes/helpers.ts may import it.
 *
 * What a field does:
 *  - type: the damage type of the skill (claims, rebuttals, resist).
 *  - aim: the aim mode. Only 'auto' is meaningful for a skill whose cast reads an aim (a tap does the whole job).
 *  - reach, area, width, count: the shape. Length of a line / throw / blink / orbit, radius, half-angle of a cone or the width of
 *    a line, extra projectiles or copies.
 *  - dur, dmg: multipliers of the duration and of the damage.
 *  - cd, cost: the price. Seconds added to the cooldown (negative = shorter), racja lost at the cast (never below 1).
 *  - status: one marker laid on whoever the cast strikes or marks (skillDamage, statusApply).
 */
import type { DamageType } from '../combat/damage';
import type { StatusKind } from '../combat/status';
import type { FamilyId } from '../enemies/ids';
import type { AimMode, SkillDef } from './defs';
import type { HeroId } from './registry';

export type ParagraphNo = 1 | 2 | 3;
export const PARAGRAPH_NOS: readonly ParagraphNo[] = [1, 2, 3];

/** Skill level (the level it opens at) plus these gives the level at which § 2 and § 3 open (DESIGN 10.2). */
export const PARAGRAPH_STEP: Readonly<Record<2 | 3, number>> = { 2: 6, 3: 14 };

export interface ParagraphPatch {
  type?: DamageType;
  aim?: AimMode;
  reach?: number;
  area?: number;
  width?: number;
  count?: number;
  dur?: number;
  dmg?: number;
  cd?: number;
  cost?: number;
  status?: { kind: StatusKind; seconds: number };
}

export type PatchKey = keyof ParagraphPatch;
export const PATCH_KEYS: readonly PatchKey[] = ['type', 'aim', 'reach', 'area', 'width', 'count', 'dur', 'dmg', 'cd', 'cost', 'status'];
/** DESIGN 10.2: a paragraph patches at most four fields. */
export const PATCH_FIELD_LIMIT = 4;

/** How many fields a patch sets. */
export const patchFields = (p: ParagraphPatch): number => PATCH_KEYS.filter((k) => p[k] !== undefined).length;

export interface Paragraph {
  n: ParagraphNo;
  nameKey: string;
  descKey: string;
  patch: ParagraphPatch;
  /** A family permission that opens this paragraph without the level (the rare ones). */
  permission?: FamilyId;
}

export interface SkillParagraphs {
  skill: string;
  /** The level at which the skill itself opens (SKILLS.md); § 2 and § 3 follow at `PARAGRAPH_STEP`. */
  level: number;
  list: readonly [Paragraph, Paragraph, Paragraph];
}

/** What a hero folder writes per paragraph: the patch, and optionally the permission that opens it early. */
export interface ParagraphSpec {
  patch?: ParagraphPatch;
  permission?: FamilyId;
}

/**
 * Build the three paragraphs of a skill. Keys are `heroes.<hero>.para.<skill>.<n>.{name,desc}` (src/i18n/pl/heroes/<hero>.json).
 * Paragraph 1 is always the unpatched skill.
 */
export function defineParagraphs(hero: HeroId, skill: string, level: number, two: ParagraphSpec, three: ParagraphSpec): SkillParagraphs {
  const make = (n: ParagraphNo, spec: ParagraphSpec): Paragraph => {
    const p: Paragraph = {
      n,
      nameKey: `heroes.${hero}.para.${skill}.${n}.name`,
      descKey: `heroes.${hero}.para.${skill}.${n}.desc`,
      patch: n === 1 ? {} : (spec.patch ?? {}),
    };
    if (n !== 1 && spec.permission) p.permission = spec.permission;
    return p;
  };
  return { skill, level, list: [make(1, {}), make(2, two), make(3, three)] };
}

/** The numbers a patch lays on a skill's data; a copy, the original is never touched. The patch rides along (`SkillDef.patch`) for the aim geometry. */
export function applyParagraph(sk: SkillDef, patch: ParagraphPatch | undefined): SkillDef {
  if (!patch || patchFields(patch) === 0) return sk;
  const out: SkillDef = { ...sk, patch };
  if (patch.type) out.type = patch.type;
  if (patch.aim) out.aim = patch.aim;
  if (patch.cd) out.cooldown = Math.max(1, sk.cooldown + patch.cd);
  return out;
}

// ---------- the scope of one cast: what `status` lays on the struck ----------

export interface Scope {
  status: { kind: StatusKind; seconds: number } | undefined;
  source: number;
}

let scope: Scope | null = null;

/** Run `fn` with the patch's status armed for skillDamage and statusApply (nested casts restore the outer scope). */
export function withCast<T>(patch: ParagraphPatch | undefined, source: number, fn: () => T): T {
  const outer = scope;
  scope = patch?.status ? { status: patch.status, source } : null;
  try {
    return fn();
  } finally {
    scope = outer;
  }
}

/** The status the cast in progress lays on whoever it strikes, if its paragraph has one. */
export const castStatus = (): Scope | null => scope;
