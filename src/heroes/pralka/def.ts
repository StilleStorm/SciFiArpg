/** Data of the hero: numbers, auto-attack, five typed skills (DESIGN 10, 10.1). */
import { defineHero, defineSkill } from '../build';
import type { HeroDef } from '../defs';

export const def: HeroDef = defineHero('pralka', {
  racja: 120,
  racjaPerLevel: 12,
  speed: 112,
  r: 16,
  baseStats: { pewnoscSiebie: 100, upor: 70, dmgMin: 6, dmgMax: 11, critChance: 0.08, resist: { mechaniczny: 10 } },
  auto: { type: 'mechaniczny', range: 56, cooldown: 0.95, projectile: false },
  skills: [
    defineSkill('pralka', 1, 'wirowanie', 'mechaniczny', 7, 'auto'),
    defineSkill('pralka', 2, 'pranieWstepne', 'regulaminowy', 10, 'auto'),
    defineSkill('pralka', 3, 'odwirowanie', 'mechaniczny', 9, 'kierunek'),
    defineSkill('pralka', 4, 'beben', 'mechaniczny', 11, 'kierunek', 'urzadzenia'),
    defineSkill('pralka', 5, 'osobowosc', 'egzystencjalny', 22, 'auto', 'wygenerowane'),
    // S19: the five skills that fill her kit (SKILLS.md §1); they open by level (their paragraphs list it), none wants a permission
    defineSkill('pralka', 6, 'plukanie', 'regulaminowy', 3, 'auto'),
    defineSkill('pralka', 7, 'program90', 'mechaniczny', 10, 'auto'),
    defineSkill('pralka', 8, 'trybOszczedny', 'mechaniczny', 14, 'auto'),
    defineSkill('pralka', 9, 'zmianaProgramu', 'regulaminowy', 16, 'auto'),
    defineSkill('pralka', 10, 'odpompowanie', 'regulaminowy', 18, 'wskazanie'),
  ],
});
