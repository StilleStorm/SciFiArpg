/** Categories and the three specializations of the Pralka (docs/SKILLS.md loadouts: Pralnia, Osoba, Serwis). Text: heroes.pralka.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: { wirowanie: 'podstawowa', pranieWstepne: 'obronna', odwirowanie: 'uzytkowa', beben: 'ofensywna', osobowosc: 'ofensywna' },
  list: [
    defineSpec('pralka', 'pralnia', ['wirowanie', 'pranieWstepne', 'odwirowanie'], 'wirowanie', { area: 1.2 }),
    defineSpec('pralka', 'osoba', ['osobowosc', 'pranieWstepne', 'wirowanie'], 'osobowosc', { dur: 1.25 }),
    defineSpec('pralka', 'serwis', ['beben', 'odwirowanie', 'osobowosc'], 'beben', { dmg: 1.2 }),
  ],
};
