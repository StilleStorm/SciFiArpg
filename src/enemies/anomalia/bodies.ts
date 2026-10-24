/**
 * The bodies the Anomalia wears (STORY 3, 8.4) and the helpers the three phases share: making a boss-sized body at the desk,
 * scaling it, striking the old one and putting the new one on the page, and the queue of footnotes (run time, never a timer).
 */
import { createRng } from '../../core/rng';
import type { Bus } from '../../core/events';
import type { Enemy } from '../../entities/types';
import { t } from '../../i18n';
import { CAMPAIGN_LAST, PLANET_COUNT, enemyScaleFor, type EnemyScale, type PriorityId } from '../../world/campaign';
import { nextId, type RunState } from '../../world/run';
import { BOSSES, makeBoss } from '../bosses';
import { setEnemyScale, type BossId, type FamilyId } from '../families';
import { rtOf } from '../runtime';
import { markAnomalia, type AnomaliaStage, type Finale } from './state';
import type { HeroId } from '../../heroes';

/** The three family bosses in the order the Anomalia wears them (phase 1). */
export const FORM_ORDER: readonly FamilyId[] = ['urzadzenia', 'powiadomienia', 'wygenerowane'];
/** The boss of each form (`story.finale.phase1.form.<boss>.old|new`). */
export const FORM_BOSS: readonly BossId[] = ['prototyp', 'weryfikacja', 'hipoteza'];

/** A form has this many times the racja of the family boss it copies (before the scale of the last planet). */
export const FORM_HP_MUL = 1.2;
/** Racja of the hero's face and of the existence finish, before the scale. */
export const FACE_HP = 420;
export const LAST_HP = 360;
export { FACE_END_FRACTION } from './state';
/** Seconds after the correction's footnote is due: the old Asystent speaks, the current one corrects it. */
export const CORRECTION_DELAY_S = 3.5;
/** A right Spor reply costs the existence this much (phase 3), and the racja this share of what is left. */
export const EXISTENCE_PER_REPLY = 0.23;
export const EXISTENCE_FLOOR = 0.3;

/** The scale the Anomalia has: as if it were a boss of the planet after the last one (`CAMPAIGN_LAST`), times the ticket's priority. */
export const finaleScale = (priority: PriorityId): EnemyScale => enemyScaleFor(Math.min(CAMPAIGN_LAST, PLANET_COUNT - 1), priority);

/** A boss-sized body of `family` at the desk with `hp` racja (times the scale) and the scale's damage. No comment of the family's table. */
export function makeBody(s: RunState, f: Finale, family: FamilyId, hp: number): Enemy {
  const e = makeBoss(nextId(s), f.desk.x, f.desk.y, s.rngs.spawn.int(1, 1e6), family, s.rngs.spawn);
  setEnemyScale(e, f.scale);
  e.hp = e.hpMax = Math.max(1, Math.round(hp * f.scale.hp));
  e.stats = { ...e.stats, dmgMin: Math.max(1, Math.round(e.stats.dmgMin * f.scale.dmg)), dmgMax: Math.max(1, Math.round(e.stats.dmgMax * f.scale.dmg)) };
  const rt = rtOf(e);
  rt.baseDmg = { min: e.stats.dmgMin, max: e.stats.dmgMax };
  rt.sporAt = undefined;
  e.home = { x: f.desk.x, y: f.desk.y };
  return e;
}

/** The racja of the family boss a form copies, times `FORM_HP_MUL`. */
export const formHp = (boss: BossId): number => BOSSES[boss].hp * FORM_HP_MUL;

/** Print a footnote now, or at run time `at` (a correction when `correction`). */
export function note(s: RunState, bus: Bus, f: Finale, text: string, delay = 0, correction = false): void {
  if (delay <= 0) bus.emit('footnote', correction ? { text, correction: true } : { text });
  else f.queue.push({ at: s.time + delay, text, ...(correction ? { correction: true } : {}) });
}

/** Print the footnotes that are due. */
export function flushNotes(s: RunState, bus: Bus, f: Finale): void {
  if (f.queue.length === 0) return;
  const due = f.queue.filter((n) => n.at <= s.time);
  if (due.length === 0) return;
  f.queue = f.queue.filter((n) => n.at > s.time);
  for (const n of due) bus.emit('footnote', n.correction ? { text: n.text, correction: true } : { text: n.text });
}

/**
 * The Anomalia takes another body: the old one is struck through where it stands (an `enemy:died` of the common tier, so no
 * drop and no victory: `isRetired`), the new one is drawn in at the desk and becomes the Anomalia of `stage`.
 */
export function swapBody(s: RunState, bus: Bus, f: Finale, old: Enemy | null, next: Enemy, stage: Exclude<AnomaliaStage, 'done'>, hero?: HeroId): void {
  if (old) {
    const i = s.enemies.indexOf(old);
    if (i >= 0) s.enemies.splice(i, 1);
    f.retired.add(old.id);
    bus.emit('enemy:died', { id: old.id, x: old.x, y: old.y, tier: 'common', family: old.family });
  }
  s.enemies.push(next);
  markAnomalia(s, next, stage, hero);
  if (old) bus.emit('boss:phase', { id: next.id, family: next.family, x: next.x, y: next.y }); // the music and the bell turn with each body
  f.stage = stage;
  f.currentId = next.id;
  f.since = s.time;
  f.lastWindow = 0;
}

/** The shuffle stream of one comment: its own, so the shuffle never moves another system's rolls. */
export const sporRng = (s: RunState, e: Enemy, tag: string) => createRng(s.seed ^ Math.imul(e.id, 0x9e3779b1)).fork(`finale-${tag}`);

/** Text of a story key (`story.finale.<path>`). */
export const finaleText = (path: string): string => t(`story.finale.${path}`);
