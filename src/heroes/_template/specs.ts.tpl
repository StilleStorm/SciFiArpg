/** Categories and the three specializations of the __ID__ (docs/SKILLS.md loadouts). TODO: real names, columns and capstones. Text: heroes.__ID__.spec.*. */
import { defineSpec, type HeroSpecs } from '../specDefs';

export const specs: HeroSpecs = {
  categories: { __ID__1: 'podstawowa', __ID__2: 'obronna', __ID__3: 'uzytkowa', __ID__4: 'ofensywna', __ID__5: 'ofensywna' },
  list: [
    defineSpec('__ID__', 'one', ['__ID__1', '__ID__2', '__ID__3'], '__ID__1', { area: 1.2 }),
    defineSpec('__ID__', 'two', ['__ID__2', '__ID__3', '__ID__4'], '__ID__4', { dmg: 1.2 }),
    defineSpec('__ID__', 'three', ['__ID__3', '__ID__4', '__ID__5'], '__ID__5', { dur: 1.25 }),
  ],
};
