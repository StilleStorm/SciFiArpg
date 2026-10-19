/**
 * The Argument meter as the interface sees it. The meter (fill, drain) is src/combat/meter.ts; the ultimates and
 * `castUltimate` are src/heroes/ultimate.ts. The pad and the HUD only go through this file.
 */
import { meterOf, ultimateReady } from '../combat/meter';
import { castUltimate, ultimateUnlocked } from '../heroes/ultimate';
import type { RunState } from '../world/run';

export { meterOf, ultimateReady, castUltimate, ultimateUnlocked };

/** Test hook: set the meter directly (0..1). */
export function setMeterForUi(s: RunState, v: number): void {
  s.player.meter = Math.min(1, Math.max(0, v));
}
