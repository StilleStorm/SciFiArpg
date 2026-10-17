import type { Bus } from '../core/events';
import type { RunState } from '../world/run';

const REACH = 6;

/** Walking over a pickup takes it. */
export function collectPickups(s: RunState, bus: Bus): void {
  const p = s.player;
  for (let i = s.pickups.length - 1; i >= 0; i--) {
    const k = s.pickups[i];
    if (!k) continue;
    if (Math.hypot(k.x - p.x, k.y - p.y) > p.r + k.r + REACH) continue;
    s.pickups.splice(i, 1);
    bus.emit('pickup:taken', { id: k.id, number: k.number });
  }
}
