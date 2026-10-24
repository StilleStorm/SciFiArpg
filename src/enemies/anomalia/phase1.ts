/**
 * Phase 1 of the Anomalia (STORY 3, 8.4): the three family boss forms in turn, the duel of footnotes. The old Asystent (the
 * Anomalia) speaks a wrong note for each form, the current one corrects it a moment later. A form falls when its racja is down
 * to 1 (the gate holds it there); it is struck, and the next one is drawn at the desk. After the third, phase 2.
 */
import { SPOR_FIRST_S, silenceSpor } from '../../combat/spor';
import type { Bus } from '../../core/events';
import type { Enemy } from '../../entities/types';
import { t } from '../../i18n';
import type { RunState } from '../../world/run';
import { rtOf } from '../runtime';
import { CORRECTION_DELAY_S, FORM_BOSS, FORM_ORDER, formHp, makeBody, note, swapBody } from './bodies';
import type { Finale } from './state';

/** Put form `index` (0..2) at the desk: the first form is the Anomalia's first body, later ones replace `old`. */
export function startForm(s: RunState, bus: Bus, f: Finale, index: number, old: Enemy | null): Enemy {
  const family = FORM_ORDER[index] ?? 'urzadzenia';
  const boss = FORM_BOSS[index] ?? 'prototyp';
  const e = makeBody(s, f, family, formHp(boss));
  f.form = index;
  swapBody(s, bus, f, old, e, 'form');
  // one comment in all of phase 1: the first form posts it; the others and the family's own table stay quiet
  silenceSpor(s, e);
  if (index === 0) rtOf(e).sporAt = s.time + SPOR_FIRST_S;
  note(s, bus, f, t(`story.finale.phase1.form.${boss}.old`));
  note(s, bus, f, t(`story.finale.phase1.form.${boss}.new`), CORRECTION_DELAY_S, true);
  return e;
}

/** The form is down to its last racja. */
export const formFallen = (e: Enemy): boolean => e.hp <= 1;

/** The form that follows `f.form`, or null after the third. */
export const nextFormIndex = (f: Finale): number | null => (f.form + 1 < FORM_ORDER.length ? f.form + 1 : null);
