/**
 * A cast as a list of steps (S1). A skill is its data (`SkillDef`: id, type, cooldown, aim, permission) plus a list of steps,
 * each a call of the primitives in heroes/primitives with the numbers of that skill. A step returning `false` stops the cast:
 * nothing happened, no cooldown is spent. `cast(i, steps)` gives the `SkillFn` that heroes/skills.ts fires from a pad.
 */
import type { Bus } from '../core/events';
import type { Enemy, Player } from '../entities/types';
import type { RunState } from '../world/run';
import { resolveDirection, type Aim } from './aim';
import type { HeroDef, SkillDef, SkillIndex } from './defs';
import { patchAt } from './grants';
import { applyParagraph } from './paragraphs';
import type { SkillFn } from './module';
import type { Ctx } from './primitives';

/** Everything a step may read: the state, the bus, the hero and the skill being cast with the aim the player gave. */
export interface CastEnv {
  c: Ctx;
  s: RunState;
  bus: Bus;
  p: Player;
  hero: HeroDef;
  sk: SkillDef;
  i: SkillIndex;
  aim: Aim;
}

export type Step = (e: CastEnv) => void | false;

/** The skill `i` of the hero as the list of `steps`, run in order, with the active paragraph laid on its data (`env.sk`). */
export function cast(i: SkillIndex, steps: readonly Step[]): SkillFn {
  return (s, bus, hero, aim) => {
    const env: CastEnv = { c: { s, bus }, s, bus, p: s.player, hero, sk: applyParagraph(hero.skills[i], patchAt(s, i)), i, aim };
    for (const step of steps) if (step(env) === false) return false;
  };
}

/** The direction the skill is aimed (a drag, or the nearest enemy) and the enemy under it, if any. */
export function directionOf(e: CastEnv): { dx: number; dy: number; target: Enemy | null } {
  return resolveDirection(e.s, e.sk, e.aim);
}

/** True the first time skill `i` is cast in a run (bit `i` of `HeroRun.noted`): the footnote of the first cast. */
export function firstCast(s: RunState, i: number): boolean {
  const bit = 1 << i;
  if ((s.hero.noted & bit) !== 0) return false;
  s.hero.noted |= bit;
  return true;
}
