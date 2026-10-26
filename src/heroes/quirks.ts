/** Passive quirks that react to events: the dispatch to the quirk of the hero in play (the quirks themselves live in src/heroes/<id>/quirk.ts). */
import type { Bus } from '../core/events';
import type { Enemy } from '../entities/types';
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

/** The factor on a blow of the player on `target` from the hero's quirk (1 for every hero without one). */
export function dealtMul(s: RunState, target: Enemy): number {
  return heroById(s.player.heroId).quirk?.dealtMul?.(s, target) ?? 1;
}

/** The factor on the walking speed of enemy `e` from the hero's quirk (1 for every hero without one). */
export function enemySpeedMul(s: RunState, e: Enemy): number {
  return heroById(s.player.heroId).quirk?.enemySpeedMul?.(s, e) ?? 1;
}

/** The racja held back from the player (a bracket on the HUD racja line), or null when the hero holds nothing back. */
export function racjaBracket(s: RunState): number | null {
  return heroById(s.player.heroId).quirk?.racjaBracket?.(s) ?? null;
}

/** A shot of enemy `from` skimmed off the player: the hero's quirk may answer it (Nalesnik, Pory). */
export function onSkim(s: RunState, bus: Bus, from: number): void {
  heroById(s.player.heroId).quirk?.onSkim?.(s, bus, from);
}

export { HITS_PER_ERROR } from './pralka/quirk';
export { ROUND_BELOW, ROUND_COOLDOWN_S, ROUND_S, ROUND_UPOR } from './nalesnik/quirk';
