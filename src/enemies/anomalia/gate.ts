/**
 * What a hit on the Anomalia becomes (called from `enemies/hooks.ts modifyDamage` on the rounded amount). Phase 1 and 2 bodies never
 * fall to a blow: the racja stops at 1 and the core ends the stage; phase 2 also multiplies by the face's `damageMul`; phase 3 does not
 * pay for its own existence (the coefficient weakens what it deals, not what it takes) and ends with the stamp, not with a blow.
 */
import type { Enemy } from '../../entities/types';
import type { RunState } from '../../world/run';
import { faceHeroOf, faceOf, isAnomalia, stageOf } from './state';

/** The point of the body that faces the player: where a blow lands, as far as the faces are concerned. */
export function bodyPoint(s: Pick<RunState, 'player'>, e: Enemy): { x: number; y: number } {
  const dx = s.player.x - e.x;
  const dy = s.player.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return { x: e.x, y: e.y };
  const k = Math.min(d, e.r) / d;
  return { x: e.x + dx * k, y: e.y + dy * k };
}

/** The amount that lands on `e` after the Anomalia's rules; `amount` unchanged for any other enemy. */
export function anomaliaHit(s: RunState, e: Enemy, amount: number): number {
  if (!isAnomalia(e)) return amount;
  let a = amount;
  const stage = stageOf(e);
  if (stage === 'face') {
    const hero = faceHeroOf(e);
    const face = hero ? faceOf(hero) : undefined;
    if (face) {
      const at = bodyPoint(s, e);
      a = Math.round(a * Math.max(0, face.damageMul(s, e, at.x, at.y)));
    }
  } else if (stage === 'last') {
    a = Math.round(a / Math.max(0.3, e.existence ?? 1));
  }
  return Math.max(0, Math.min(a, e.hp - 1));
}
