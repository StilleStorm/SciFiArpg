/** Categories and the three specializations of the Konsultant (docs/SKILLS.md loadouts: Infolinia, Windykacja, Sprzedaz). Text: heroes.konsultant.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: { prosze: 'uzytkowa', przekierowuje: 'ofensywna', pomoc: 'uzytkowa', numer: 'ofensywna', rozlaczenie: 'ofensywna' },
  list: [
    defineSpec('konsultant', 'infolinia', ['prosze', 'przekierowuje', 'pomoc'], 'prosze', { dur: 1.25 }),
    defineSpec('konsultant', 'windykacja', ['numer', 'rozlaczenie', 'prosze'], 'numer', { dmg: 1.2 }),
    defineSpec('konsultant', 'sprzedaz', ['pomoc', 'numer', 'przekierowuje'], 'pomoc', { dur: 1.25 }),
  ],
};
