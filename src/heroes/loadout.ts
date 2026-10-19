/** Which skills are installed and which sit on the three pads (DESIGN 10.1). Pure functions on the run state. */
import type { RunState } from '../world/run';
import { heroDef, PAD_SLOTS, SKILL_INDICES, type PadSlot, type SkillDef, type SkillIndex } from './defs';
import { applyParagraph } from './paragraphs';
import { mergeCapstone, runCapstone } from './specializations';

/** Skills 1..3 are always installed; the 4th and 5th once an update gave them a rank. */
export const isInstalled = (s: RunState, i: SkillIndex): boolean => i <= 2 || (s.hero.ranks[i] ?? 0) > 0;

export const installedSkills = (s: RunState): SkillIndex[] => SKILL_INDICES.filter((i) => isInstalled(s, i));

/** Skill `i` as it is cast now: the base data with the active paragraph laid on (heroes/paragraphs.ts). Pads and previews read this, not `def.skills`. */
export const effectiveSkill = (s: RunState, i: SkillIndex): SkillDef => applyParagraph(heroDef(s.player.heroId).skills[i], s.hero.patch?.[i]);

/**
 * The skill pad `slot` fires, as the pad previews it: the active paragraph and, when it belongs to this skill, the capstone
 * (heroes/specializations.ts), so the aim preview's reach and area match the cast. Casts do not read this (`withCapstone` does).
 */
export function padSkill(s: RunState, slot: PadSlot): SkillDef {
  const i = s.hero.pads[slot];
  const sk = heroDef(s.player.heroId).skills[i];
  const cap = runCapstone(s);
  if (!cap || cap.capstone.skill !== sk.id) return effectiveSkill(s, i);
  return applyParagraph(sk, mergeCapstone(s.hero.patch?.[i], cap.capstone.patch));
}

/** The pad that holds skill `i`, if any. */
export function padOf(s: RunState, i: SkillIndex): PadSlot | null {
  for (const slot of PAD_SLOTS) if (s.hero.pads[slot] === i) return slot;
  return null;
}

/**
 * Put skill `i` on pad `slot`. A not-installed skill is refused. A skill already on another pad swaps with the one on
 * `slot`, so the pads always hold three different installed skills. Returns true when something changed.
 */
export function assignPad(s: RunState, slot: PadSlot, i: SkillIndex): boolean {
  if (!isInstalled(s, i)) return false;
  const was = s.hero.pads[slot];
  if (was === i) return false;
  const other = padOf(s, i);
  if (other !== null) s.hero.pads[other] = was;
  s.hero.pads[slot] = i;
  return true;
}

/** After a load or a hero change: any pad holding a not-installed or repeated skill falls back to the first free installed one. */
export function fixPads(s: RunState): void {
  const seen = new Set<SkillIndex>();
  for (const slot of PAD_SLOTS) {
    const i = s.hero.pads[slot];
    if (isInstalled(s, i) && !seen.has(i)) {
      seen.add(i);
      continue;
    }
    const free = installedSkills(s).find((k) => !seen.has(k)) ?? slot;
    s.hero.pads[slot] = free;
    seen.add(free);
  }
}
