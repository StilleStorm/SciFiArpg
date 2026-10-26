/** Categories and the three specializations of the Nalesnik (docs/SKILLS.md loadouts: Toczenie, Studnia, Uklad). Text: heroes.nalesnik.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: {
    orbita: 'podstawowa',
    krawedz: 'podstawowa',
    plywy: 'ofensywna',
    upadek: 'ofensywna',
    pierscien: 'ofensywna',
    wniosek: 'obronna',
    zaokraglenie: 'obronna',
    grawitacja: 'uzytkowa',
    ksiezyc: 'uzytkowa',
    zmianaOrbity: 'uzytkowa',
  },
  // docs/SKILLS.md loadouts: Toczenie (a roller, hits from the move), Studnia (pulls, pushes, heals in its zone), Uklad (orbiting bodies do the work); the columns are a partition
  list: [
    defineSpec('nalesnik', 'toczenie', ['orbita', 'krawedz', 'zaokraglenie', 'plywy'], 'plywy', { area: 1.2 }),
    defineSpec('nalesnik', 'studnia', ['grawitacja', 'wniosek', 'zmianaOrbity'], 'grawitacja', { area: 1.2 }),
    defineSpec('nalesnik', 'uklad', ['ksiezyc', 'pierscien', 'upadek'], 'ksiezyc', { dmg: 1.2 }),
  ],
};
