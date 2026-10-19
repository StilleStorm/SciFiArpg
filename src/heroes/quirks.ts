/** Passive quirks that react to events: the dispatch to the quirk of the hero in play (the quirks themselves live in src/heroes/<id>/quirk.ts). */
import type { Bus } from '../core/events';
import type { RunState } from '../world/run';
import { heroById } from './registry';

/** Taking a hit: the hero's quirk may fire (Pralka: every 10th hit is a "blad programu"). Returns true if it did something. */
export function onPlayerHit(s: RunState, bus: Bus): boolean {
  if (s.status !== 'running') return false;
  return heroById(s.player.heroId).quirk?.onHit?.(s, bus) ?? false;
}

/** Every step: the hero's quirk may tick (Nalesnik: rounding up below a third of racja). */
export function tickRound(s: RunState, bus: Bus): void {
  heroById(s.player.heroId).quirk?.tick?.(s, bus);
}

export { HITS_PER_ERROR } from './pralka/quirk';
export { ROUND_BELOW, ROUND_COOLDOWN_S, ROUND_S, ROUND_UPOR } from './nalesnik/quirk';
