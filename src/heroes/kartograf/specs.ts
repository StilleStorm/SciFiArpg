/** Categories and the three specializations of the Kartograf (docs/SKILLS.md loadouts: Pomiar, Granica, Nieistnienie). Text: heroes.kartograf.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: {
    triangulacja: 'podstawowa',
    pomiar: 'podstawowa',
    skala: 'ofensywna',
    legenda: 'ofensywna',
    przekroj: 'ofensywna',
    korekta: 'obronna',
    granica: 'obronna',
    teren: 'uzytkowa',
    punktOdniesienia: 'uzytkowa',
    rozaWiatrow: 'uzytkowa',
  },
  // docs/SKILLS.md loadouts: Pomiar (lines, distance, crits), Granica (a position held behind a border), Nieistnienie (existence play); the columns are a partition
  list: [
    defineSpec('kartograf', 'pomiar', ['triangulacja', 'pomiar', 'korekta'], 'triangulacja', { dmg: 1.2 }),
    defineSpec('kartograf', 'granica', ['przekroj', 'granica', 'punktOdniesienia', 'skala'], 'skala', { dur: 1.25 }),
    defineSpec('kartograf', 'nieistnienie', ['legenda', 'teren', 'rozaWiatrow'], 'teren', { area: 1.2 }),
  ],
};
