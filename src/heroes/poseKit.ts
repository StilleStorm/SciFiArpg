/**
 * Pure timing and easing of the hero auto-attack poses (S1): the pose record, the keyframe helpers and the constants the five
 * hero figures share. Leaf module (imports only the easing curve), so every hero's figure.ts can use it and render/attackFx.ts
 * re-exports it.
 */
/** The Konsultant's cable: the tip reaches the target in 90 ms and snaps back in 120. The hit resolves when it arrives (heroes/auto.ts). */
export const LASH_OUT_MS = 90;
export const LASH_BACK_MS = 120;
/** The Pralka's whip is drawn in 35 ms, stays fully drawn for 180 ms and is rubbed out in 45. */
export const WHIP_AT_MS = 60;
export const WHIP_DRAW_MS = 35;
export const WHIP_HOLD_MS = 180;
export const WHIP_ERASE_MS = 45;
/** Distance of the Pralka's lurch (also the unit of an enemy's lunge in render/attackFx.ts), in units. */
export const LURCH = 16;
export const KICK = 6;
/** The Nalesnik's flip: it turns over in 220 ms, hopping 12 units toward the enemy; the ink slap is drawn as it lands. */
export const FLIP_MS = 220;
export const HOP = 12;
export const SLAP_AT_MS = 90;
export const SLAP_DRAW_MS = 35;
export const SLAP_HOLD_MS = 25;
export const SLAP_ERASE_MS = 70;
/** Rotation of the Konsultant's throwing arm, degrees. */
export const THROW_DEG = 40;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (p: number): number => p * p * (3 - 2 * p);
/** 0 -> 1 -> 0 over `dur` ms (peak in the middle); 0 outside. */
export const pulse = (t: number, dur: number): number => (t <= 0 || t >= dur ? 0 : Math.sin((Math.PI * t) / dur));

/** Piecewise smooth interpolation through [progress, value] keys sorted by progress. */
export function keyframes(p: number, keys: readonly (readonly [number, number])[]): number {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return 0;
  if (p <= first[0]) return first[1];
  if (p >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    const a = keys[i - 1];
    if (!a || !b || p > b[0]) continue;
    return a[1] + (b[1] - a[1]) * smooth((p - a[0]) / (b[0] - a[0] || 1));
  }
  return last[1];
}
/** A hero's pose `t` ms into its auto-attack. Neutral values: 0, door 1, nothing drawn. */
export interface HeroPose {
  /** Whole body toward the target, units. */
  lurch: number;
  /** Throwing arm, degrees; negative swings the hand toward the target. */
  arm: number;
  /** Drum, degrees (absolute). */
  drum: number;
  /** Porthole door, horizontal scale about its hinge. */
  door: number;
  /** Instrument pushed away from the target, units. */
  kick: number;
  /** Nalesnik's disc: vertical scale of the flip, -1 .. 1 (1 = lying as usual). */
  flip: number;
  /** Helmet dip, units down, and tilt, degrees toward the target. */
  dip: number;
  tilt: number;
  /** The ticket has left the hand. */
  ticketOut: boolean;
  /** The Konsultant's cable: how far the tip is out toward the target, 0 (at the hand) .. 1 (on the target). */
  lash: number;
  /** The ticket card is stuck on the target at the tip of the cable. */
  card: boolean;
  /** The ink stroke of this attack, as the visible part of its length: from `erase` to `draw` (0..1 each). */
  draw: number;
  erase: number;
}

export function neutralPose(): HeroPose {
  return { lurch: 0, arm: 0, drum: 0, door: 1, kick: 0, flip: 1, dip: 0, tilt: 0, ticketOut: false, lash: 0, card: false, draw: 0, erase: 0 };
}
