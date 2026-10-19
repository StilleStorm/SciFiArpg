/**
 * Paragraphs and the unlock schedule (S2, DESIGN 10.2): which paragraph of which skill a character may use, which one is
 * active, and how the active ones are laid on a run. Pure functions on plain data; the save layer stores `paragraphs`
 * (save/character.ts), the forms read the contracts below.
 *
 * Schedule: § 1 is the skill itself. § 2 opens at the skill's level + 6 and § 3 at + 14 (the skill's level is the one it opens
 * at, listed with its paragraphs in the hero folder), or at once when the character holds the family permission the paragraph
 * names. The fourth and fifth skill count only once installed (a rank of its update entry).
 */
import { heroDef, type SkillDef, type SkillIndex } from '../heroes/defs';
import { applyParagraph, PARAGRAPH_NOS, PARAGRAPH_STEP, type Paragraph, type ParagraphNo, type ParagraphPatch } from '../heroes/paragraphs';
import type { HeroId } from '../heroes/registry';
import { heroById } from '../heroes/registry';
import type { RunState } from '../world/run';

export type { Paragraph, ParagraphNo, ParagraphPatch };

/** What the schedule reads: the hero, how far it has come, what it has installed and found. A `Character` is one. */
export interface ParagraphProgress {
  heroId: HeroId;
  level: number;
  /** Taken update id -> rank; `skill4` and `skill5` above 0 mean the fourth and fifth skill are installed. */
  upgrades: Readonly<Record<string, number>>;
  permissions: readonly string[];
}

/** A progress record that also keeps the active paragraphs: skill id -> n, absent = § 1. */
export interface ParagraphCharacter extends ParagraphProgress {
  paragraphs?: Record<string, ParagraphNo>;
}

const NONE: readonly Paragraph[] = [];

/** The three paragraphs of a hero's skill, § 1 first; empty for a skill the hero does not have. */
export function paragraphsOf(heroId: HeroId, skillId: string): readonly Paragraph[] {
  return heroById(heroId).paragraphs[skillId]?.list ?? NONE;
}

/** The level at which the skill itself opens (0 for an unknown skill). */
export function skillLevelOf(heroId: HeroId, skillId: string): number {
  return heroById(heroId).paragraphs[skillId]?.level ?? 0;
}

/** The level at which paragraph `n` of the skill opens by level alone (1 is the skill's own). */
export function paragraphLevel(heroId: HeroId, skillId: string, n: ParagraphNo): number {
  return skillLevelOf(heroId, skillId) + (n === 1 ? 0 : PARAGRAPH_STEP[n]);
}

/** Skills 1..3 are always installed; the 4th and 5th once an update gave them a rank. */
function installed(c: ParagraphProgress, index: number): boolean {
  return index <= 2 || (c.upgrades[`skill${index + 1}`] ?? 0) > 0;
}

/** Is paragraph `n` of the skill open to this character (the skill must be installed). */
export function isParagraphUnlocked(c: ParagraphProgress, skillId: string, n: ParagraphNo): boolean {
  const index = heroDef(c.heroId).skills.findIndex((k) => k.id === skillId);
  const para = paragraphsOf(c.heroId, skillId)[n - 1];
  if (index < 0 || !para || !installed(c, index)) return false;
  if (n === 1) return true;
  if (para.permission && c.permissions.includes(para.permission)) return true;
  return c.level >= paragraphLevel(c.heroId, skillId, n);
}

/** Every skill of the hero -> the paragraph numbers open now, ascending (empty for a skill not installed). */
export function unlockedParagraphs(c: ParagraphProgress): Record<string, ParagraphNo[]> {
  const out: Record<string, ParagraphNo[]> = {};
  for (const sk of heroDef(c.heroId).skills) out[sk.id] = PARAGRAPH_NOS.filter((n) => isParagraphUnlocked(c, sk.id, n));
  return out;
}

/** The paragraph in force for a skill: the stored one if it is still open, else § 1. */
export function activeParagraph(c: ParagraphCharacter, skillId: string): ParagraphNo {
  const n = c.paragraphs?.[skillId];
  return n !== undefined && n !== 1 && isParagraphUnlocked(c, skillId, n) ? n : 1;
}

/** Make paragraph `n` the active one of the skill. False (nothing changed) when it is not open. § 1 is stored as absence. */
export function setActiveParagraph(c: ParagraphCharacter, skillId: string, n: ParagraphNo): boolean {
  if (!isParagraphUnlocked(c, skillId, n)) return false;
  const next = { ...c.paragraphs };
  if (n === 1) delete next[skillId];
  else next[skillId] = n;
  if (Object.keys(next).length === 0) delete c.paragraphs;
  else c.paragraphs = next;
  return true;
}

// ---------- on a run ----------

/** The schedule input of a run (the run keeps what a character keeps). */
export const runProgress = (s: RunState): ParagraphProgress => ({ heroId: s.player.heroId, level: s.player.level, upgrades: s.hero.upgrades, permissions: s.player.permissions });

/** Lay the active paragraphs on a run (`HeroRun.para` and `.patch`). Anything not open is ignored; all § 1 leaves both fields off. */
export function applyParagraphs(s: RunState, active: Readonly<Record<string, ParagraphNo>> | undefined, force = false): void {
  const h = s.hero;
  const para: ParagraphNo[] = [1, 1, 1, 1, 1];
  const patch: (ParagraphPatch | undefined)[] = [undefined, undefined, undefined, undefined, undefined];
  let any = false;
  heroDef(s.player.heroId).skills.forEach((sk, i) => {
    const n = active?.[sk.id];
    if (n === undefined || n === 1) return;
    if (!force && !isParagraphUnlocked(runProgress(s), sk.id, n)) return;
    const p = paragraphsOf(s.player.heroId, sk.id)[n - 1];
    if (!p) return;
    para[i] = n;
    patch[i] = p.patch;
    any = true;
  });
  if (any) {
    h.para = para;
    h.patch = patch;
  } else {
    delete h.para;
    delete h.patch;
  }
}

/** The active paragraphs of a run as the save keeps them: skill id -> n, § 1 left out. */
export function activeParagraphsOf(s: RunState): Record<string, ParagraphNo> {
  const out: Record<string, ParagraphNo> = {};
  const para = s.hero.para;
  if (!para) return out;
  heroDef(s.player.heroId).skills.forEach((sk, i) => {
    const n = para[i];
    if (n !== undefined && n !== 1) out[sk.id] = n;
  });
  return out;
}

/** The active paragraph of skill `i` on a run. */
export const runParagraph = (s: RunState, i: SkillIndex): ParagraphNo => s.hero.para?.[i] ?? 1;

/** Switch a skill's paragraph in a run (the pause sheet). False when it is not open to this character. Takes effect at the next cast. */
export function setRunParagraph(s: RunState, skillId: string, n: ParagraphNo, force = false): boolean {
  if (!force && !isParagraphUnlocked(runProgress(s), skillId, n)) return false;
  if (!paragraphsOf(s.player.heroId, skillId)[n - 1]) return false;
  applyParagraphs(s, { ...activeParagraphsOf(s), [skillId]: n }, true);
  return true;
}

/** The skill as cast with paragraph `n` (a pure look for the forms: type, aim, cooldown, patch). */
export function skillWith(heroId: HeroId, skillId: string, n: ParagraphNo): SkillDef | null {
  const sk = heroDef(heroId).skills.find((k) => k.id === skillId);
  const p = paragraphsOf(heroId, skillId)[n - 1];
  return sk && p ? applyParagraph(sk, p.patch) : null;
}
