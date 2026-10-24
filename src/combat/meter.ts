/**
 * The Argument meter (DESIGN 10.2): 0..1 on `player.meter`. It fills from rebuttals (a hit that matches the claim's type), more
 * slowly from kills, and by half from a correct Spor reply; it drains slowly once the player has been out of combat for a while.
 * A full meter is one ultimate (heroes/ultimate.ts `castUltimate`). Never saved: a run starts with an empty meter.
 * Pure functions on the state; the hooks live in systems/combat.ts (rebuttal, kill) and combat/spor.ts (right reply).
 */
import type { Player } from '../entities/types';
import type { RunState } from '../world/run';
import { METER_COMBAT_R, METER_DRAIN_PER_S, METER_IDLE_S, METER_KILL, METER_KILL_BOSS, METER_KILL_ELITE, METER_REBUTTAL, METER_SPOR } from '../balance/meter';

// the numbers live in balance/meter.ts (S16)
export { METER_COMBAT_R, METER_DRAIN_PER_S, METER_IDLE_S, METER_KILL, METER_KILL_BOSS, METER_KILL_ELITE, METER_REBUTTAL, METER_SPOR };

const EPS = 1e-9;

/** The meter, clamped to 0..1. */
export const meterOf = (p: Pick<Player, 'meter'>): number => Math.min(1, Math.max(0, p.meter));
/** A full meter: the ultimate pad may be pressed. */
export const ultimateReady = (p: Pick<Player, 'meter'>): boolean => meterOf(p) >= 1 - EPS;

/** True while an ultimate runs: it does not feed the meter that would cast the next one. */
const held = (s: Pick<RunState, 'hero'>): boolean => (s.hero.ult?.active.length ?? 0) > 0;

/** Add `amount` to the meter (capped at 1). Nothing while an ultimate is running. Returns what was added. */
export function meterGain(s: Pick<RunState, 'player' | 'hero'>, amount: number): number {
  if (held(s) || amount <= 0) return 0;
  const before = meterOf(s.player);
  s.player.meter = Math.min(1, before + amount);
  return s.player.meter - before;
}

/** The share a kill of this tier adds. */
export const killFill = (tier: 'common' | 'elite' | 'boss'): number => (tier === 'boss' ? METER_KILL_BOSS : tier === 'elite' ? METER_KILL_ELITE : METER_KILL);

/** The ultimate was cast: the meter is spent. */
export function meterSpend(p: Pick<Player, 'meter'>): void {
  p.meter = 0;
}

/** Per step: count the quiet, and drain once it has lasted METER_IDLE_S. `clock.idle` is seconds without an enemy near. */
export function tickMeter(s: Pick<RunState, 'player' | 'enemies'>, clock: { idle: number }, dt: number): void {
  const p = s.player;
  const near = s.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) <= METER_COMBAT_R + e.r);
  if (near) {
    clock.idle = 0;
    return;
  }
  clock.idle += dt;
  if (clock.idle >= METER_IDLE_S && p.meter > 0) p.meter = Math.max(0, p.meter - METER_DRAIN_PER_S * dt);
}
