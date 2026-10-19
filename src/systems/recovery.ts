/**
 * Recovery of racja (PLAN 8): potwierdzenia, stamped slips left by the fallen. Walking near one pulls it in; if racja is
 * not full it restores a quarter of the maximum at once, otherwise it is kept (up to five per character) and used by a
 * tap on the margin note or, automatically, before a blow that would leave less than 15%. Out of combat racja also comes
 * back slowly ("zmiana zdania"). Plain data and functions; the HUD and the bindings only read and call these.
 */
import type { Bus } from '../core/events';
import { createPotwierdzeniePickup } from '../entities/factory';
import type { Pickup, Player } from '../entities/types';
import { t } from '../i18n';
import type { DropSource } from '../items/types';
import { nextId, type RunState } from '../world/run';

/** How many slips a character may hold. */
export const HELD_CAP = 5;
/** Share of the maximum racja one slip restores. */
export const HEAL_SHARE = 0.25;
/** A blow that would leave less racja than this share uses a held slip first. */
export const AUTO_FLOOR = 0.15;
/** Walking this close (plus the radii) pulls a slip in. */
export const VACUUM_RADIUS = 90;
export const VACUUM_SPEED = 240;
/** Regeneration out of combat: share of the maximum per second, after this many seconds without a blow. */
export const REGEN_RATE = 0.02;
export const REGEN_DELAY = 4;

/** Chance that a dead enemy of each tier leaves a slip. */
export const POTWIERDZENIE_DROP: Record<DropSource, number> = { common: 0.1, elite: 0.5, boss: 1 };

export const heldOf = (p: Player): number => p.potwierdzenia ?? 0;

/** Racja that one slip would give right now; `incoming` is a blow about to land (an auto-use counts the racja after it). */
const room = (p: Player, incoming = 0): number => Math.max(0, Math.min(p.hpMax - (p.hp - incoming), Math.round(p.hpMax * HEAL_SHARE)));

/** Can the player take (or keep) one more slip? */
export const canTakeSlip = (p: Player): boolean => p.hp < p.hpMax || heldOf(p) < HELD_CAP;

/** Roll and place the slip of one dead enemy. Returns it, or null. */
export function rollPotwierdzenie(s: RunState, x: number, y: number, source: DropSource): Pickup | null {
  const rng = s.rngs.loot;
  if (!rng.chance(POTWIERDZENIE_DROP[source])) return null;
  const a = rng.range(0, Math.PI * 2);
  const d = rng.range(6, 26);
  const k = createPotwierdzeniePickup(nextId(s), x + Math.cos(a) * d, y + Math.sin(a) * d);
  s.pickups.push(k);
  return k;
}

/** Walking over a slip: heals when racja is not full, is kept when it is, stays on the ground when five are held. */
export function takePotwierdzenie(s: RunState, bus: Bus, _k: Pickup): boolean {
  const p = s.player;
  if (p.suspended) return false;
  if (p.hp < p.hpMax) {
    const healed = room(p);
    p.hp += healed;
    bus.emit('recovery:taken', { healed, held: heldOf(p) });
    return true;
  }
  if (heldOf(p) >= HELD_CAP) return false;
  p.potwierdzenia = heldOf(p) + 1;
  bus.emit('recovery:taken', { healed: 0, held: p.potwierdzenia });
  bus.emit('margin:note', { text: t('ui.potw.kept', { count: p.potwierdzenia }), x: p.x, y: p.y - 30 });
  return true;
}

/**
 * Use one held slip. False when none is held, racja is full, or the run is not live. `incoming` is the blow an auto-use
 * comes before: the slip is measured against the racja after it, so a heavy blow at full racja still uses one.
 */
export function useHeld(s: RunState, bus: Bus, auto = false, incoming = 0): boolean {
  const p = s.player;
  if (s.status !== 'running' || s.phase !== 'run' || p.suspended || p.hp <= 0) return false;
  if (heldOf(p) <= 0 || p.hp - incoming >= p.hpMax) return false;
  const healed = room(p, incoming);
  p.hp += healed;
  p.potwierdzenia = heldOf(p) - 1;
  bus.emit('recovery:used', { auto, healed, held: p.potwierdzenia });
  bus.emit('stamp', { text: t('ui.potw.stamp'), x: p.x, y: p.y - 24 });
  if (auto) bus.emit('footnote', { text: t('ui.potw.auto', { count: p.potwierdzenia }) });
  return true;
}

/**
 * A blow of `amount` is about to be subtracted from racja: note the time (regeneration waits) and, if it would leave
 * less than 15% and a slip is held, use one first.
 */
export function onPlayerBlow(s: RunState, bus: Bus, amount: number): void {
  const p = s.player;
  p.hurtAt = s.time;
  if (heldOf(p) > 0 && p.hp - amount < p.hpMax * AUTO_FLOOR) useHeld(s, bus, true, amount);
}

/** Per step: slips within reach are pulled toward the player; racja comes back slowly after 4 s of calm. */
export function tickRecovery(s: RunState, _bus: Bus, dt: number): void {
  const p = s.player;
  if (p.hp > 0 && p.hp < p.hpMax && s.time - (p.hurtAt ?? -Infinity) >= REGEN_DELAY) {
    p.hp = Math.min(p.hpMax, p.hp + p.hpMax * REGEN_RATE * dt);
  }
  if (p.suspended || !canTakeSlip(p)) return;
  for (const k of s.pickups) {
    if (!k.potwierdzenie) continue;
    const d = Math.hypot(p.x - k.x, p.y - k.y);
    if (d > VACUUM_RADIUS + p.r + k.r || d < 0.001) continue;
    const step = Math.min(d, VACUUM_SPEED * dt);
    k.x += ((p.x - k.x) / d) * step;
    k.y += ((p.y - k.y) / d) * step;
  }
}
