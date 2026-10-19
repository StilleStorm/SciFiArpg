/** Data of the hero: numbers, auto-attack, five typed skills (DESIGN 10, 10.1). */
import { defineHero, defineSkill } from '../build';
import type { HeroDef } from '../defs';

// a flat asteroid that applied for dwarf-planet status: the tanky one, the fastest (DESIGN 10, item 5)
export const def: HeroDef = defineHero('nalesnik', {
  racja: 100,
  racjaPerLevel: 10,
  speed: 146,
  r: 16,
  baseStats: { pewnoscSiebie: 100, upor: 58, dmgMin: 5, dmgMax: 10, critChance: 0.08, resist: { mechaniczny: 8 } },
  auto: { type: 'mechaniczny', range: 54, cooldown: 0.85, projectile: false },
  traits: { skim: true },
  chosenNoteKey: 'heroes.nalesnik.chosen',
  skills: [
    defineSkill('nalesnik', 1, 'orbita', 'mechaniczny', 9, 'kierunek'),
    defineSkill('nalesnik', 2, 'grawitacja', 'egzystencjalny', 14, 'auto'),
    defineSkill('nalesnik', 3, 'wniosek', 'regulaminowy', 16, 'wskazanie'),
    defineSkill('nalesnik', 4, 'plywy', 'mechaniczny', 12, 'auto', 'urzadzenia'),
    defineSkill('nalesnik', 5, 'ksiezyc', 'egzystencjalny', 20, 'kierunek', 'powiadomienia'),
  ],
});
