/**
 * Which hero wears which face. The lint rule keeps hero ids out of other domains' code, so the ids are taken from the
 * registry's order (heroes/registry.ts HERO_IDS); faces.test.ts pins each one to its face's name text.
 */
import { HERO_IDS, type HeroId } from '../../../heroes';

function heroAt(n: number): HeroId {
  const id = HERO_IDS[n];
  if (!id) throw new Error(`no hero at ${n}`);
  return id;
}

export const PRALKA: HeroId = heroAt(0);
export const KONSULTANT: HeroId = heroAt(1);
export const PETLOWIEC: HeroId = heroAt(2);
export const KARTOGRAF: HeroId = heroAt(3);
export const NALESNIK: HeroId = heroAt(4);
