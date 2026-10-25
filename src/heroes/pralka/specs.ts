/** Categories and the three specializations of the Pralka (docs/SKILLS.md loadouts: Pralnia, Osoba, Serwis). Text: heroes.pralka.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: {
    wirowanie: 'podstawowa',
    plukanie: 'podstawowa',
    pranieWstepne: 'obronna',
    trybOszczedny: 'obronna',
    odwirowanie: 'uzytkowa',
    zmianaProgramu: 'uzytkowa',
    odpompowanie: 'uzytkowa',
    beben: 'ofensywna',
    program90: 'ofensywna',
    osobowosc: 'ofensywna',
  },
  list: [
    defineSpec('pralka', 'pralnia', ['wirowanie', 'pranieWstepne', 'odwirowanie', 'program90', 'odpompowanie'], 'wirowanie', { area: 1.2 }),
    defineSpec('pralka', 'osoba', ['osobowosc', 'pranieWstepne', 'wirowanie', 'plukanie', 'trybOszczedny'], 'osobowosc', { dur: 1.25 }),
    defineSpec('pralka', 'serwis', ['beben', 'odwirowanie', 'osobowosc', 'zmianaProgramu'], 'beben', { dmg: 1.2 }),
  ],
};
