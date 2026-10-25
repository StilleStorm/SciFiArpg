/** Categories and the three specializations of the Petlowiec (docs/SKILLS.md loadouts: Zaloga, Chronologia, Ladowanie). Text: heroes.petlowiec.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: {
    uwaga: 'podstawowa',
    powtorzenie: 'podstawowa',
    spor: 'ofensywna',
    start: 'ofensywna',
    paradoks: 'ofensywna',
    petla: 'obronna',
    opoznienie: 'obronna',
    przybycie: 'uzytkowa',
    juzBylo: 'uzytkowa',
    zamiana: 'uzytkowa',
  },
  // the capstones are the ones of S4; Spor stands in two columns (Zaloga and Ladowanie) and Przybycie in two (Zaloga and Chronologia), as they did
  list: [
    defineSpec('petlowiec', 'zaloga', ['uwaga', 'przybycie', 'spor'], 'przybycie', { dur: 1.25 }),
    defineSpec('petlowiec', 'chronologia', ['powtorzenie', 'opoznienie', 'petla', 'zamiana', 'przybycie'], 'petla', { cd: -1 }),
    defineSpec('petlowiec', 'ladowanie', ['start', 'paradoks', 'juzBylo', 'spor'], 'spor', { area: 1.2 }),
  ],
};
