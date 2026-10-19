/** Categories and the three specializations of the Petlowiec (docs/SKILLS.md loadouts: Zaloga, Chronologia, Ladowanie). Text: heroes.petlowiec.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: { przybycie: 'uzytkowa', spor: 'ofensywna', petla: 'obronna', juzBylo: 'uzytkowa', start: 'ofensywna' },
  list: [
    defineSpec('petlowiec', 'zaloga', ['przybycie', 'spor', 'juzBylo'], 'przybycie', { dur: 1.25 }),
    defineSpec('petlowiec', 'chronologia', ['petla', 'juzBylo', 'przybycie'], 'petla', { cd: -1 }),
    defineSpec('petlowiec', 'ladowanie', ['start', 'juzBylo', 'spor'], 'spor', { area: 1.2 }),
  ],
};
