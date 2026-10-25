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

/** The share (0..1) by which the kiosk's service fee is cut for the run `s` (Konsultant's passive 10); 0 for every other hero. */
export function priceCut(s: RunState): number {
  return heroById(s.player.heroId).quirk?.priceCut?.(s) ?? 0;
}

export { HITS_PER_ERROR } from './pralka/quirk';
export { ROUND_BELOW, ROUND_COOLDOWN_S, ROUND_S, ROUND_UPOR } from './nalesnik/quirk';
