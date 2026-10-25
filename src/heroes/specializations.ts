/**
 * Categories, specializations and capstones (S4, DESIGN 10.2 and 10.3). The contract the desk forms build against:
 *
 *   categoryOf(skill: SkillDef | string): SkillCategory | null      // 'podstawowa' | 'ofensywna' | 'obronna' | 'uzytkowa' | 'ostateczna'
 *   categoryNameKey(c: SkillCategory): string                       // forms.category.<c>
 *   specializationsOf(heroId): readonly Specialization[]            // three columns: id, nameKey, skills (ids), capstone {nameKey, descKey, skill, patch}
 *   specializationOf(heroId, id): Specialization | undefined
 *   capstoneCount(c: LoadoutView, specId): number                   // unlocked pad skills of the column
 *   activeCapstone(c: LoadoutView): ActiveCapstone | null           // {spec, capstone} when c.specialization is chosen AND >= 2 pad skills belong to it
 *   setLoadout(c: LoadoutView, l: Loadout): LoadoutResult           // validates, then writes pads / ultimate / specialization into c (all or nothing)
 *   loadoutAdvice(c: LoadoutView): SkillCategory[]                  // advisory only: categories absent from the pads when two pads share one; [] otherwise
 *   unlockedSkills(c: LoadoutView): SkillIndex[]                    // skills that may be equipped
 *   ultimatesOf(heroId): string[]                                   // ultimate ids
 *
 * `Character` (save/character.ts) is a LoadoutView. Rules: any unlocked skill may be equipped (three different ones); the rule of three
 * (one per category) is advice, never enforced; a capstone is granted only for the one chosen column, and only while >= 2 of the
 * equipped pad skills belong to it; at a cast the capstone patch is laid on its skill (`withCapstone`, called by heroes/skills.ts `fire`).
 */
import { heroDef, PAD_SLOTS, SKILL_INDICES, skillAt, type SkillDef, type SkillIndex } from './defs';
import { patchAt, withPatchAt } from './grants';
import type { ParagraphPatch } from './paragraphs';
import { heroById, HERO_IDS, type HeroId } from './registry';
import { SKILL_CATEGORIES, type Capstone, type CapstonePatch, type SkillCategory, type Specialization } from './specDefs';
import type { RunState } from '../world/run';

export type { Capstone, CapstonePatch, SkillCategory, Specialization };
export { SKILL_CATEGORIES };

/** The fields of a character the loadout reads and writes. */
export interface LoadoutView {
  heroId: HeroId;
  pads: [SkillIndex, SkillIndex, SkillIndex];
  upgrades: Readonly<Record<string, number>>;
  ultimate?: string;
  specialization?: string;
}

export interface Loadout {
  pads: readonly [SkillIndex, SkillIndex, SkillIndex];
  ultimate: string;
  /** A specialization id, or null for none (no capstone). */
  specialization: string | null;
}

export type LoadoutResult = { ok: true } | { ok: false; reason: 'pads' | 'locked' | 'ultimate' | 'specialization' };

export interface ActiveCapstone {
  spec: Specialization;
  capstone: Capstone;
}

const NONE: readonly Specialization[] = [];

/** Category of a skill (a def or its id); 'ostateczna' for an ultimate id; null when unknown. */
export function categoryOf(skill: SkillDef | string): SkillCategory | null {
  const id = typeof skill === 'string' ? skill : skill.id;
  for (const h of HERO_IDS) {
    const c = heroById(h).specs?.categories[id];
    if (c) return c;
    if (heroById(h).ultimates?.some((u) => u.id === id)) return 'ostateczna';
  }
  return null;
}

/** The category names are shared with the desk forms (src/i18n/pl/forms.json `category`). */
export const categoryNameKey = (c: SkillCategory): string => `forms.category.${c}`;

export const specializationsOf = (heroId: HeroId): readonly Specialization[] => heroById(heroId).specs?.list ?? NONE;

export const specializationOf = (heroId: HeroId, id: string): Specialization | undefined => specializationsOf(heroId).find((x) => x.id === id);

export const ultimatesOf = (heroId: HeroId): string[] => (heroById(heroId).ultimates ?? []).map((u) => u.id);

/** Skills 1..3 are always open; the others once an update gave them a rank (as progression/paragraphs.ts). */
export const isSkillUnlocked = (c: Pick<LoadoutView, 'upgrades'>, i: SkillIndex): boolean => i <= 2 || (c.upgrades[`skill${i + 1}`] ?? 0) > 0;

export const unlockedSkills = (c: Pick<LoadoutView, 'upgrades'>): SkillIndex[] => SKILL_INDICES.filter((i) => isSkillUnlocked(c, i));

const padIds = (c: LoadoutView): string[] => {
  const skills = heroDef(c.heroId).skills;
  return c.pads.filter((i) => isSkillUnlocked(c, i)).map((i) => skillAt({ skills }, i).id);
};

/** How many of the equipped (unlocked) pad skills belong to the column. */
export function capstoneCount(c: LoadoutView, specId: string): number {
  const spec = specializationOf(c.heroId, specId);
  return spec ? padIds(c).filter((id) => spec.skills.includes(id)).length : 0;
}

/** The capstone in force: the chosen column, if at least two equipped pad skills belong to it. One column at a time, by choice. */
export function activeCapstone(c: LoadoutView): ActiveCapstone | null {
  if (!c.specialization) return null;
  const spec = specializationOf(c.heroId, c.specialization);
  if (!spec || capstoneCount(c, spec.id) < 2) return null;
  return { spec, capstone: spec.capstone };
}

/** Validate and write the loadout. Nothing changes unless every part is acceptable. */
export function setLoadout(c: LoadoutView, l: Loadout): LoadoutResult {
  const [a, b, d] = l.pads;
  if (new Set([a, b, d]).size !== 3 || !l.pads.every((i) => SKILL_INDICES.includes(i))) return { ok: false, reason: 'pads' };
  if (!l.pads.every((i) => isSkillUnlocked(c, i))) return { ok: false, reason: 'locked' };
  if (!ultimatesOf(c.heroId).includes(l.ultimate)) return { ok: false, reason: 'ultimate' };
  if (l.specialization !== null && !specializationOf(c.heroId, l.specialization)) return { ok: false, reason: 'specialization' };
  c.pads = [a, b, d];
  c.ultimate = l.ultimate;
  if (l.specialization === null) delete c.specialization;
  else c.specialization = l.specialization;
  return { ok: true };
}

const ADVISED: readonly SkillCategory[] = ['podstawowa', 'ofensywna', 'obronna', 'uzytkowa'];

/** The rule of three is advice: when two pads hold the same category, the categories no pad holds. Otherwise nothing is missing. */
export function loadoutAdvice(c: Pick<LoadoutView, 'heroId' | 'pads'>): SkillCategory[] {
  const skills = heroDef(c.heroId).skills;
  const cats = PAD_SLOTS.map((p) => categoryOf(skillAt({ skills }, c.pads[p])));
  if (new Set(cats).size === cats.length) return [];
  return ADVISED.filter((k) => !cats.includes(k));
}

// ---------- at the cast ----------

/** The capstone of a run: from the pads in force and the chosen specialization. */
export function runCapstone(s: RunState): ActiveCapstone | null {
  const spec = s.hero.spec;
  if (!spec) return null;
  const upgrades = s.hero.upgrades;
  return activeCapstone({ heroId: s.player.heroId, pads: s.hero.pads, upgrades, specialization: spec });
}

/** The skill patch with the capstone laid on: area, dmg, dur, width, reach multiply; cd adds seconds. */
export function mergeCapstone(base: ParagraphPatch | undefined, cap: CapstonePatch): ParagraphPatch {
  const out: ParagraphPatch = { ...base };
  for (const k of ['area', 'dmg', 'dur', 'width', 'reach'] as const) {
    const m = cap[k];
    if (m !== undefined) out[k] = (base?.[k] ?? 1) * m;
  }
  if (cap.cd !== undefined) out.cd = (base?.cd ?? 0) + cap.cd;
  return out;
}

/**
 * Run `fn(patch)` for a cast of skill `skill` with the capstone laid on, if it belongs to that skill: the run's patch for the
 * skill (`patchAt`, with a worn unique's paragraph and the sets) answers the merged patch for the duration, so every helper that
 * reads it (areaOf, power, durationOf...) sees it.
 */
export function withCapstone<T>(s: RunState, skill: SkillIndex, fn: (patch: ParagraphPatch | undefined) => T): T {
  const base = patchAt(s, skill); // the run's paragraph, a worn unique's and the sets' (heroes/grants.ts)
  const cap = runCapstone(s);
  if (!cap || cap.capstone.skill !== skillAt(heroDef(s.player.heroId), skill).id) return fn(base);
  const merged = mergeCapstone(base, cap.capstone.patch);
  return withPatchAt(skill, merged, () => fn(merged));
}
