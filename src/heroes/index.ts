export type HeroId = 'pralka' | 'konsultant' | 'petlowiec' | 'kartograf';

/** Stub. Heroes agent: add stats, auto-attack, three skills, quirk. */
export interface HeroDef {
  id: HeroId;
  /** i18n key of the hero's name, e.g. 'heroes.pralka.name'. */
  nameKey: string;
}

export const HEROES: readonly HeroDef[] = [];
