/** Passive quirks that react to events. Pure functions on the run state; heroes/layer.ts wires them to the bus. */
import type { Bus } from '../core/events';
import { t } from '../i18n';
import type { RunState } from '../world/run';
import { castSkill } from './skills';

/** Every 10th hit on a Pralka is a "blad programu": a random skill fires for free. Returns true if it fired. */
export const HITS_PER_ERROR = 10;

export function onPlayerHit(s: RunState, bus: Bus): boolean {
  if (s.status !== 'running' || s.player.heroId !== 'pralka') return false;
  s.hero.hitsTaken++;
  if (s.hero.hitsTaken % HITS_PER_ERROR !== 0) return false;
  bus.emit('footnote', { text: t('heroes.pralka.quirkNote') });
  const slot = s.rngs.combat.int(0, 2) as 0 | 1 | 2;
  return castSkill(s, bus, slot, true);
}
