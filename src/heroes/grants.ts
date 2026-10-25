/**
 * What worn items give a hero's skills (S17; ITEMS 4.1, 4.2, 12.2). Two sources:
 *  - a unique with a `grant` (items/uniques.ts): +1 or +2 ranks on one skill (they may exceed the cap of 3), the skill counts as
 *    installed while it is worn even with no own rank, and the unique carries one paragraph (§ 2 or § 3) of that skill;
 *  - a set of three pieces (items/sets.ts `skills3`): a patch laid on named skills.
 * Both are read off `Player.grants` and `Player.sets`, which items/stats.ts `recomputeStats` keeps current, so nothing here is stored
 * on the run or saved. A grant names a skill id, never a hero: it concerns the hero that owns that skill and is stats only for the others.
 * Only function declarations touch the registry, and only when called, so this file may be imported by the skill helpers.
 */
import type { Player } from '../entities/types';
import { setSkillPatches } from '../items/sets';
import type { ItemGrant } from '../items/types';
import type { RunState } from '../world/run';
import { HEROES, heroDef, skillAt, type SkillDef, type SkillIndex } from './defs';
import type { ParagraphNo, ParagraphPatch } from './paragraphs';
import { heroById, type HeroId } from './registry';

/** The index of skill `skillId` among the hero's skills, or -1 when the hero does not have it. */
export function skillIndexOf(heroId: HeroId, skillId: string): number {
  return heroDef(heroId).skills.findIndex((k) => k.id === skillId);
}

/** The hero that owns a skill id (the one an item's paragraph concerns), or null when none does (a skill a later slice adds). */
export function heroOfSkill(skillId: string): HeroId | null {
  return HEROES.find((h) => h.skills.some((k) => k.id === skillId))?.id ?? null;
}

/** The skill def behind a grant, for the hero in play; null when the grant does not concern this hero. */
export function grantSkill(heroId: HeroId, g: Pick<ItemGrant, 'skill'>): { index: SkillIndex; def: SkillDef } | null {
  const i = skillIndexOf(heroId, g.skill);
  const def = i >= 0 ? heroDef(heroId).skills[i] : undefined;
  return def ? { index: i as SkillIndex, def } : null;
}

/** Ranks the worn uniques add to skill `i` of the hero in play (0 when none). */
export function itemRanksOf(p: Pick<Player, 'grants' | 'heroId'>, i: SkillIndex): number {
  if (!p.grants?.length) return 0;
  let sum = 0;
  for (const g of p.grants) if (skillIndexOf(p.heroId, g.skill) === i) sum += g.ranks;
  return sum;
}

/**
 * The rank of skill `i` as the skills read it: the rank an update gave (`HeroRun.ranks`, at most 3) plus the ranks of worn uniques,
 * which may exceed that cap (ITEMS 12.2).
 */
export const rankOf = (s: RunState, i: SkillIndex): number => (s.hero.ranks[i] ?? 0) + itemRanksOf(s.player, i);

/** The paragraph a worn unique carries for skill `i` (the highest if two do), or 1 when none does. */
export function itemParagraphOf(p: Pick<Player, 'grants' | 'heroId'>, i: SkillIndex): ParagraphNo {
  let n: ParagraphNo = 1;
  for (const g of p.grants ?? []) if (skillIndexOf(p.heroId, g.skill) === i && g.para > n) n = g.para;
  return n;
}

const MULTIPLY = ['area', 'dmg', 'dur', 'width', 'reach'] as const;
const ADD = ['count', 'cd', 'cost'] as const;

/** Lay `extra` on `base` the way a capstone is laid (heroes/specializations.ts): shape multipliers multiply, count, cd and cost add. */
export function layPatch(base: ParagraphPatch | undefined, extra: ParagraphPatch): ParagraphPatch {
  const out: ParagraphPatch = { ...base };
  for (const k of MULTIPLY) {
    const m = extra[k];
    if (m !== undefined) out[k] = (base?.[k] ?? 1) * m;
  }
  for (const k of ADD) {
    const a = extra[k];
    if (a !== undefined) out[k] = (base?.[k] ?? 0) + a;
  }
  return out;
}

/**
 * The patch in force for skill `i`: the active paragraph of the run (`HeroRun.patch`), replaced by the paragraph a worn unique
 * carries when that one is higher, with the patches of worn three-piece sets laid on top. Without items it is `HeroRun.patch[i]` itself.
 */
export function patchAt(s: RunState, i: SkillIndex): ParagraphPatch | undefined {
  if (castOverride && castOverride.i === i) return castOverride.patch;
  const own = s.hero.patch?.[i];
  const p = s.player;
  if (!p.grants?.length && !p.sets) return own;
  let patch = own;
  const carried = itemParagraphOf(p, i);
  if (carried > (s.hero.para?.[i] ?? 1)) {
    const item = heroById(p.heroId).paragraphs[skillAt(heroDef(p.heroId), i).id]?.list[carried - 1]?.patch;
    if (item) patch = item;
  }
  for (const extra of setSkillPatches(p, skillAt(heroDef(p.heroId), i).id)) patch = layPatch(patch, extra);
  return patch;
}

let castOverride: { i: SkillIndex; patch: ParagraphPatch | undefined } | null = null;

/**
 * Run `fn` with `patchAt(s, i)` answering `patch` (the whole patch of a cast: items' paragraph and sets with the capstone laid on,
 * heroes/specializations.ts withCapstone), so every helper inside the cast sees the capstone and the carried paragraph together.
 */
export function withPatchAt<T>(i: SkillIndex, patch: ParagraphPatch | undefined, fn: () => T): T {
  const prev = castOverride;
  castOverride = { i, patch };
  try {
    return fn();
  } finally {
    castOverride = prev;
  }
}

/** The paragraph number in force for skill `i` including a worn unique's. */
export function paragraphAt(s: RunState, i: SkillIndex): ParagraphNo {
  return Math.max(s.hero.para?.[i] ?? 1, itemParagraphOf(s.player, i)) as ParagraphNo;
}
