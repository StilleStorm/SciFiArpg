/** Shared bits of the five faces: where phase 2 ends, the face's bubble, and the one-per-enemy state map. */
import type { Claim } from '../../../combat/claims';
import type { DamageType } from '../../../combat/damage';
import type { Bus } from '../../../core/events';
import type { Enemy } from '../../../entities/types';
import { t } from '../../../i18n';
import type { HeroId } from '../../../heroes';

/** Phase 2 is over once the Anomalia is down to this fraction of its racja: the core's threshold (`../state.ts`), one number for both. */
export { FACE_END_FRACTION } from '../state';

export const hpFraction = (e: Enemy): number => (e.hpMax > 0 ? e.hp / e.hpMax : 0);

/** The face's own bubble (`story.finale.face.<hero>.line`) as the Anomalia's claim; returns what it replaced. */
export function setFaceClaim(e: Enemy, heroId: HeroId, type: DamageType): Claim | undefined {
  const before = e.claim;
  e.claim = { textKey: `story.finale.face.${heroId}.line`, type };
  return before;
}

export function restoreClaim(e: Enemy, before: Claim | undefined): void {
  if (before) e.claim = before;
  else delete e.claim;
}

/** How long the face's margin line stays (ms: `margin:note.ttl` is in milliseconds). */
export const SAY_TTL_MS = 2400;

/** True when the Anomalia's own bubble already says the face's line (its claim, struck or not: the words stay legible): a margin echo would only repeat it. */
export const bubbleSaysLine = (e: Enemy, heroId: HeroId): boolean => e.claim?.textKey === `story.finale.face.${heroId}.line`;

/**
 * The face's line as a note in the margin next to the Anomalia (a sober way to show the mechanic fired), only while its bubble does
 * not already say it: two copies of one line read as a stacked label.
 */
export function sayLine(bus: Bus, e: Enemy, heroId: HeroId, x: number, y: number): void {
  if (bubbleSaysLine(e, heroId)) return;
  bus.emit('margin:note', { text: t(`story.finale.face.${heroId}.line`), x, y, ttl: SAY_TTL_MS });
}

/** A per-enemy store; `get` creates it on first use. State never lives on RunState. */
export function faceStore<S>(make: () => S): { get(e: Enemy): S; has(e: Enemy): boolean; drop(e: Enemy): void } {
  const map = new WeakMap<Enemy, S>();
  return {
    get(e) {
      let s = map.get(e);
      if (!s) {
        s = make();
        map.set(e, s);
      }
      return s;
    },
    has: (e) => map.has(e),
    drop: (e) => {
      map.delete(e);
    },
  };
}
