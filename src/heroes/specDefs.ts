/**
 * Specializations as data (S4, DESIGN 10.2 and 10.3). A hero folder lists, in `specs.ts`, the category of each skill and three
 * specializations (columns of the Karta uprawnien, named after the loadouts of docs/SKILLS.md), each with its skills and one
 * capstone: a small buff that is a `ParagraphPatch`-shaped change laid on one skill at its cast. Types and `defineSpec` only:
 * no registry, so hero folders may import it. The runtime API (categoryOf, activeCapstone, setLoadout) is heroes/specializations.ts.
 */
import type { ParagraphPatch } from './paragraphs';
import type { HeroId } from './registry';

export type SkillCategory = 'podstawowa' | 'ofensywna' | 'obronna' | 'uzytkowa' | 'ostateczna';
export const SKILL_CATEGORIES: readonly SkillCategory[] = ['podstawowa', 'ofensywna', 'obronna', 'uzytkowa', 'ostateczna'];

/** Capstone fields: the multipliers area, dmg, dur, width, reach (1.2 = +20%) and `cd`, seconds added to the cooldown (negative = shorter). */
export type CapstonePatch = Pick<ParagraphPatch, 'area' | 'dmg' | 'dur' | 'width' | 'reach' | 'cd'>;

export interface Capstone {
  nameKey: string;
  /** One line: what changes, in numbers. */
  descKey: string;
  /** The skill id that gets the buff at every cast. */
  skill: string;
  patch: CapstonePatch;
}

export interface Specialization {
  id: string;
  nameKey: string;
  /** Skill ids of the column, in the order they print on the chart. */
  skills: readonly string[];
  capstone: Capstone;
}

export interface HeroSpecs {
  /** Skill id -> category; every skill of the hero. */
  categories: Readonly<Record<string, SkillCategory>>;
  /** Exactly three. */
  list: readonly [Specialization, Specialization, Specialization];
}

/** Build one specialization. Keys: `heroes.<hero>.spec.<id>.name`, `.cap.name`, `.cap.desc`. */
export function defineSpec(hero: HeroId, id: string, skills: readonly string[], capstoneSkill: string, patch: CapstonePatch): Specialization {
  const base = `heroes.${hero}.spec.${id}`;
  return { id, nameKey: `${base}.name`, skills, capstone: { nameKey: `${base}.cap.name`, descKey: `${base}.cap.desc`, skill: capstoneSkill, patch } };
}
