/** Categories and the three specializations of the Konsultant (docs/SKILLS.md loadouts: Infolinia, Windykacja, Sprzedaz). Text: heroes.konsultant.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: {
    zgloszenie: 'podstawowa',
    formularz: 'podstawowa',
    przekierowuje: 'ofensywna',
    numer: 'ofensywna',
    rozlaczenie: 'ofensywna',
    muzyka: 'obronna',
    przerwaTechniczna: 'obronna',
    prosze: 'uzytkowa',
    pomoc: 'uzytkowa',
    oddzwonimy: 'uzytkowa',
  },
  // docs/SKILLS.md loadouts: Infolinia (stun, slow, let them wait), Windykacja (single-target removal, the chair), Sprzedaz (crits and gwiazdki)
  list: [
    defineSpec('konsultant', 'infolinia', ['zgloszenie', 'prosze', 'muzyka', 'przekierowuje'], 'prosze', { dur: 1.25 }),
    defineSpec('konsultant', 'windykacja', ['numer', 'rozlaczenie', 'przerwaTechniczna'], 'numer', { dmg: 1.2 }),
    defineSpec('konsultant', 'sprzedaz', ['formularz', 'pomoc', 'oddzwonimy'], 'pomoc', { dur: 1.25 }),
  ],
};
