/** Categories and the three specializations of the Kartograf (docs/SKILLS.md loadouts: Pomiar, Granica, Nieistnienie). Text: heroes.kartograf.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: { triangulacja: 'podstawowa', teren: 'uzytkowa', korekta: 'obronna', skala: 'ofensywna', legenda: 'ofensywna' },
  list: [
    defineSpec('kartograf', 'pomiar', ['triangulacja', 'korekta', 'skala'], 'triangulacja', { dmg: 1.2 }),
    defineSpec('kartograf', 'granica', ['korekta', 'skala', 'teren'], 'skala', { dur: 1.25 }),
    defineSpec('kartograf', 'nieistnienie', ['legenda', 'teren', 'korekta'], 'teren', { area: 1.2 }),
  ],
};
