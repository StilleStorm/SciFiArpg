/**
 * The skill dispatcher: `castSkill` checks that a pad may fire, `fire` runs the cast of the hero (src/heroes/<id>/skills.ts, found
 * through the registry), starts the cooldown and announces `skill:cast`. Cooldowns only, no mana. A cast returning false = nothing
 * happened, no cooldown.
 */
import { isSilenced, isStunned } from '../combat/status';
import type { Bus } from '../core/events';
import { t } from '../i18n';
import type { RunState } from '../world/run';
import { AUTO_AIM, fitAim, resolveAim, takeQueuedAim, type Aim, type ResolvedAim } from './aim';
import { heroDef, type PadSlot, type SkillIndex } from './defs';
import { cooldownOf } from './helpers';
import { applyParagraph, withCast, type ParagraphPatch } from './paragraphs';
import { heroById } from './registry';
import { withCapstone } from './specializations';

export type { SkillFn } from './module';
export { FOAM_RADIUS } from './numbers';

/** The aim as the skill resolved it: a concrete direction or point, so that the repeat does what the first cast did. */
function concreteAim(a: ResolvedAim): Aim {
  if (a.kind === 'kierunek') return { kind: 'kierunek', dx: a.dx, dy: a.dy };
  if (a.kind === 'wskazanie') return { kind: 'wskazanie', x: a.x, y: a.y };
  return AUTO_AIM;
}

/**
 * Fire the skill on pad `slot` (0..2) if it is ready and the hero is not wyciszony. `free` skips the cooldown check and
 * does not start one (Pralka's blad programu, Juz to bylo). `aim` is the player's aim (heroes/aim.ts); left out it is the auto cast.
 * Returns true if the skill did something. Cooldowns are kept per skill (`s.hero.pads[slot]`), not per pad (DESIGN 10.1).
 */
export function castSkill(s: RunState, bus: Bus, slot: PadSlot, free = false, aim?: Aim): boolean {
  if (s.status !== 'running' || s.phase === 'base') return false; // the base has nobody to argue with: a pad tap there does nothing
  if (s.modal) return false; // a sheet or banner holds the clock: no skill is cast under it
  const p = s.player;
  const skill = s.hero.pads[slot];
  if (s.law.botTime || isStunned(p)) return false; // the bot hours: skills do nothing, no cooldown is spent
  if (!free) {
    if (s.hero.cd[skill] > 0) return false;
    if (isSilenced(p)) {
      if (s.time - s.hero.silenceNoteAt > 1.5) {
        s.hero.silenceNoteAt = s.time;
        bus.emit('margin:note', { text: t('heroes.silenced'), x: p.x, y: p.y - p.r - 30 });
      }
      return false;
    }
  }
  return fire(s, bus, skill, slot, free, aim ?? (free ? undefined : (takeQueuedAim(slot) ?? undefined)));
}

/**
 * Run skill `skill` as if pad `slot` had been pressed (the checks are castSkill's): the function, the cooldown unless free, the
 * `skill:cast` event, and the note of what was cast for Juz to bylo. A free cast takes the aim it is given (auto by default).
 */
export function fire(s: RunState, bus: Bus, skill: SkillIndex, slot: PadSlot, free: boolean, aim: Aim | undefined): boolean {
  return withCapstone(s, skill, (patch) => cast(s, bus, skill, slot, free, aim, patch));
}

/** The body of `fire`, with the patch of the skill as it is cast (the paragraph, and the capstone if it belongs to this skill). */
function cast(s: RunState, bus: Bus, skill: SkillIndex, slot: PadSlot, free: boolean, aim: Aim | undefined, patch: ParagraphPatch | undefined): boolean {
  const def = heroDef(s.player.heroId);
  const sk = applyParagraph(def.skills[skill], patch); // the active paragraph, laid on the data (heroes/paragraphs.ts)
  const fn = heroById(def.id).casts[sk.id];
  if (!fn) return false;
  const aimed = fitAim(sk, aim ?? AUTO_AIM);
  const resolved = resolveAim(s, sk, aimed);
  if (withCast(patch, s.player.id, () => fn(s, bus, def, aimed)) === false) return false;
  if (patch?.cost) s.player.hp = Math.max(Math.min(1, s.player.hp), s.player.hp - patch.cost); // the price of the paragraph, never fatal
  if (!free) {
    const total = cooldownOf(s, skill, sk.cooldown);
    s.hero.cd[skill] = total;
    s.hero.cdTotal[skill] = total;
    if (sk.id !== 'juzBylo') s.hero.lastCast = { skill, aim: concreteAim(resolved) };
  }
  bus.emit('skill:cast', { slot, skill, free, aim: resolved });
  return true;
}
