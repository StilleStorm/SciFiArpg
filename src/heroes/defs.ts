/** The five heroes (DESIGN section 10, 10.1): numbers, auto-attack, five typed skills (the 4th and 5th installed through permissions), one quirk. Data only. */
import type { DamageType, Stats } from '../combat/damage';
import type { FamilyId } from '../enemies/ids';
import type { HeroId } from './registry';
import type { ParagraphPatch } from './paragraphs';

/** A skill of the hero (0..4) and a pad (0..2); `HeroRun.pads` says which skill each pad fires (DESIGN 10.1). */
export type SkillIndex = 0 | 1 | 2 | 3 | 4;
export type PadSlot = 0 | 1 | 2;
export const PAD_SLOTS: readonly PadSlot[] = [0, 1, 2];
export const SKILL_INDICES: readonly SkillIndex[] = [0, 1, 2, 3, 4];

/** How a skill is aimed (DESIGN 5.6): by itself, by a direction, or by a point. */
export type AimMode = 'auto' | 'kierunek' | 'wskazanie';

export interface SkillDef {
  /** Key into SKILLS in skills.ts. */
  id: string;
  nameKey: string;
  /** Word on the pad. */
  padKey: string;
  descKey: string;
  type: DamageType;
  /** Seconds. Skills cost nothing else (no mana). */
  cooldown: number;
  /** What a drag on the pad sets (heroes/aim.ts); a tap is always the auto cast. */
  aim: AimMode;
  /** Skills 4 and 5 only: the permission (enemy family) their first rank needs in the update form (DESIGN 10.1). */
  requires?: FamilyId;
  /** Set only on the copy `applyParagraph` makes: the patch of the active paragraph (heroes/paragraphs.ts). */
  patch?: ParagraphPatch;
}

/** Standing traits of a hero (S1: what used to be `heroId === ...` branches). */
export interface HeroTraits {
  /** Items are trialed this many times faster. */
  trialSpeed?: number;
  /** Enemy defects are visible at once. */
  seesDefects?: boolean;
  /** The whole page map is revealed on entry. */
  revealsPage?: boolean;
  /** Projectiles skim off at (nearly) full racja (heroes/shield.ts). */
  skim?: boolean;
  /** On a petla death the old self stays behind as a friendly ghost first, not a hostile copy (death/outcomes.ts). */
  friendlyCopy?: boolean;
  /** Extra gwiazdki per kill while the buff of skill 3 runs. */
  buffKillGwiazdki?: number;
}

export interface HeroDef {
  id: HeroId;
  nameKey: string;
  /** Three sober lines for the profile. */
  descKeys: readonly [string, string, string];
  quirkKey: string;
  /** Racja at level 1 and per level gained. */
  racja: number;
  racjaPerLevel: number;
  speed: number;
  /** Collision radius. */
  r: number;
  baseStats: Stats;
  auto: {
    type: DamageType;
    range: number;
    cooldown: number;
    /** Thrown/shot: a projectile flies; otherwise the hit lands at once. */
    projectile: boolean;
    /** Projectile only: gains a pierce on a critical hit. */
    pierceOnCrit?: boolean;
    /**
     * The shot lands at once as a ruled line (heroes/auto.ts): no projectile flies. `projectile` stays true for such a hero so
     * that systems/combat.ts `attack()` leaves the announcing to `fireAuto`; `pierceOnCrit` then lets the line run on through
     * everything up to the range limit.
     */
    hitscan?: boolean;
    /** Projectile only: the shot is a lash (fast, thick, heroes/auto.ts) rather than a thrown missile. */
    lash?: boolean;
  };
  /** Standing traits the player carries from level 1 (state.ts applyHero copies them onto the player). */
  traits?: HeroTraits;
  /** i18n key of the Asystent's remark on this hero chosen for the first time (heroes/chosen.ts). */
  chosenNoteKey?: string;
  skills: readonly [SkillDef, SkillDef, SkillDef, SkillDef, SkillDef];
}

// The five heroes live in src/heroes/<id>/def.ts; the registry (heroes/registry.ts) lists them.
export { HEROES, HERO_IDS, heroDef } from './registry';
