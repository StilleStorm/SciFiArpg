/**
 * Phase 3 of the Anomalia (STORY 3, 8.4): it exists only as much as the case is believed closed. Its existence coefficient falls
 * with every right Spor reply of the whole fight (and as it is worn down); what it deals is multiplied by it, what it takes is
 * not (`gate.ts`). A right reply in this phase also takes a share of its racja. The kill is the closing stamp: when the racja is
 * down to 1 the stamp falls and the body is struck through the normal death (`boss:died`, the unique, the run ends); the notes follow.
 */
import { SPOR_FIRST_S, silenceSpor } from '../../combat/spor';
import type { Bus } from '../../core/events';
import type { Enemy } from '../../entities/types';
import { t } from '../../i18n';
import { killEnemy } from '../../systems/combat';
import type { RunState } from '../../world/run';
import { rtOf } from '../runtime';
import { EXISTENCE_FLOOR, EXISTENCE_PER_REPLY, LAST_HP, makeBody, note, swapBody } from './bodies';
import type { Finale } from './state';

/** A right reply takes this share of the racja the Anomalia has left in phase 3. */
export const REPLY_BITE = 0.4;
/** Every right reply before phase 3 takes this share off its racja. */
export const REPLY_HEAD_START = 0.1;
/** How far wearing it down thins it out, on top of the replies. */
export const WEAR_THINNING = 0.35;

const clampE = (v: number): number => Math.min(1, Math.max(EXISTENCE_FLOOR, v));

/** The existence it should have now: the replies' share minus what the wear takes. */
export const existenceNow = (f: Finale, e: Enemy): number => clampE(f.exist0 - WEAR_THINNING * (1 - e.hp / Math.max(1, e.hpMax)));

export function startLast(s: RunState, bus: Bus, f: Finale, old: Enemy | null): Enemy {
  const head = Math.max(0.5, 1 - REPLY_HEAD_START * f.correct);
  const e = makeBody(s, f, 'wygenerowane', LAST_HP * head);
  f.exist0 = clampE(1 - EXISTENCE_PER_REPLY * f.correct);
  e.existence = f.exist0;
  rtOf(e).ePin = null;
  swapBody(s, bus, f, old, e, 'last');
  rtOf(e).sporAt = s.time + SPOR_FIRST_S;
  note(s, bus, f, t('story.finale.phase3.meet'));
  return e;
}

/** A right reply was given to the Anomalia in this phase. */
export function lastReplied(f: Finale, e: Enemy): void {
  f.exist0 = clampE(f.exist0 - EXISTENCE_PER_REPLY);
  e.hp = Math.max(1, Math.round(e.hp * (1 - REPLY_BITE)));
}

/** Per step: the coefficient follows the racja; at the last racja the stamp falls. Returns true when the case was closed. */
export function tickLast(s: RunState, bus: Bus, f: Finale, e: Enemy): boolean {
  e.existence = existenceNow(f, e);
  if (e.hp > 1) return false;
  closeCase(s, bus, f, e);
  return true;
}

/**
 * The closing stamp falls and the body is struck through the normal death (`boss:died`: the unique, the run ends 2.8 s later). The notes
 * come after the death, so the level-up and loot notes of the kill are older than the Asystent's: the close, the hero's line, and last
 * the final footnote, which is long and must be the one left on the slip.
 */
export function closeCase(s: RunState, bus: Bus, f: Finale, e: Enemy): void {
  f.stage = 'done';
  bus.emit('stamp', { text: t('story.finale.phase3.stamp'), x: e.x, y: e.y - 60 });
  silenceSpor(s, e);
  killEnemy(s, bus, e);
  bus.emit('footnote', { text: t('story.finale.phase3.close') });
  bus.emit('footnote', { text: t(`story.finale.hero.${f.heroId}`) });
  bus.emit('footnote', { text: t('story.finale.footnote') });
}
