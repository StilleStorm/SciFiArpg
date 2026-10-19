/**
 * The registry of heroes (S1): the one list of hero ids and the modules behind them. Adding a hero is: a folder
 * `src/heroes/<id>/` (scripts/new-hero.mjs makes it), one line here, one line in `HERO_ID_LIST`.
 * Nothing outside src/heroes/<id>/ may name a hero id (scripts/lint-rules.mjs).
 */
import { hero as konsultant } from './konsultant';
import { hero as kartograf } from './kartograf';
import type { HeroDef } from './defs';
import type { HeroModule } from './module';
import { hero as nalesnik } from './nalesnik';
import { hero as petlowiec } from './petlowiec';
import { hero as pralka } from './pralka';

export const HERO_ID_LIST = ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik'] as const;
export type HeroId = (typeof HERO_ID_LIST)[number];

const MODULES: readonly HeroModule[] = [pralka, konsultant, petlowiec, kartograf, nalesnik];

/** The hero definitions, in the order of the profile screen. */
export const HEROES: readonly HeroDef[] = MODULES.map((m) => m.def);
export const HERO_IDS: readonly HeroId[] = HEROES.map((h) => h.id);

/** The hero a new save starts with. */
export const DEFAULT_HERO_ID: HeroId = 'pralka';

/** The module of hero `id` (def, figure, sounds, casts, quirk). */
export function heroById(id: HeroId): HeroModule {
  const m = MODULES.find((x) => x.def.id === id) ?? MODULES[0];
  if (!m) throw new Error('no heroes registered');
  return m;
}

export function heroDef(id: HeroId): HeroDef {
  return heroById(id).def;
}
