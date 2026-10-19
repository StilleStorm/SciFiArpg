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
  ],
});
