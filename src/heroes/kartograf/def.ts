/** Data of the hero: numbers, auto-attack, five typed skills (DESIGN 10, 10.1). */
import { defineHero, defineSkill } from '../build';
import type { HeroDef } from '../defs';

export const def: HeroDef = defineHero('kartograf', {
  racja: 68,
  racjaPerLevel: 7,
  speed: 134,
  r: 13,
  baseStats: { pewnoscSiebie: 110, upor: 32, dmgMin: 5, dmgMax: 10, critChance: 0.12, resist: {} },
  auto: { type: 'mechaniczny', range: 260, cooldown: 1.05, projectile: true, hitscan: true, pierceOnCrit: true },
  traits: { revealsPage: true },
  skills: [
    defineSkill('kartograf', 1, 'triangulacja', 'mechaniczny', 6, 'kierunek'),
    defineSkill('kartograf', 2, 'teren', 'egzystencjalny', 14, 'wskazanie'),
    defineSkill('kartograf', 3, 'korekta', 'regulaminowy', 10, 'wskazanie'),
    defineSkill('kartograf', 4, 'skala', 'regulaminowy', 16, 'auto', 'powiadomienia'),
    defineSkill('kartograf', 5, 'legenda', 'egzystencjalny', 15, 'wskazanie', 'wygenerowane'),
  ],
});
