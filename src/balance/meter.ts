/** Balance numbers of the Argument meter (combat/meter.ts re-exports them; DESIGN 10.2). Plain values. */

/** A rebuttal (the hit's type matched the standing claim). */
export const METER_REBUTTAL = 0.1;
/** A kill, by tier: slower than a rebuttal. */
export const METER_KILL = 0.04;
export const METER_KILL_ELITE = 0.06;
export const METER_KILL_BOSS = 0.15;
/** A correct Spor reply fills half of the meter. */
export const METER_SPOR = 0.5;
/** Out of combat the meter drains this much per second ... */
export const METER_DRAIN_PER_S = 0.01;
/** ... once no enemy has been within METER_COMBAT_R of the player for this many seconds. */
export const METER_IDLE_S = 4;
export const METER_COMBAT_R = 320;
