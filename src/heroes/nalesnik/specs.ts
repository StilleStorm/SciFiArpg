/** Categories and the three specializations of the Nalesnik (docs/SKILLS.md loadouts: Toczenie, Studnia, Uklad). Text: heroes.nalesnik.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: { orbita: 'podstawowa', grawitacja: 'uzytkowa', wniosek: 'obronna', plywy: 'ofensywna', ksiezyc: 'uzytkowa' },
  list: [
    defineSpec('nalesnik', 'toczenie', ['orbita', 'wniosek', 'plywy'], 'plywy', { area: 1.2 }),
    defineSpec('nalesnik', 'studnia', ['grawitacja', 'plywy', 'wniosek'], 'grawitacja', { area: 1.2 }),
    defineSpec('nalesnik', 'uklad', ['ksiezyc', 'grawitacja', 'orbita'], 'ksiezyc', { dmg: 1.2 }),
  ],
};
