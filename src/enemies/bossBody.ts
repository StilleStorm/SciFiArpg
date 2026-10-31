/**
 * Which body a boss wears. A planet may name a body of its family other than `BOSS_OF[family]` (planet 6: Ankieta, a Powiadomienia body), so
 * the body is recorded per enemy when `makeBoss` builds it. Kept apart from bosses.ts so combat/spor.ts and the renderer can read it
 * without importing the boss logic.
 */
import { BOSS_OF, type BossId, type FamilyId } from './ids';

const bodies = new WeakMap<object, BossId>();

export const setBossBody = (e: object, boss: BossId): void => {
  bodies.set(e, boss);
};

/** The body of a boss: the one `makeBoss` recorded, else the family's. */
export const bossBodyOf = (e: object, family: FamilyId): BossId => bodies.get(e) ?? BOSS_OF[family];
