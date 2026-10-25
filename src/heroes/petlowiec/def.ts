/** Data of the hero: numbers, auto-attack, five typed skills (DESIGN 10, 10.1). */
import { defineHero, defineSkill } from '../build';
import type { HeroDef } from '../defs';

export const def: HeroDef = defineHero('petlowiec', {
  racja: 80,
  racjaPerLevel: 8,
  speed: 124,
  r: 13,
  baseStats: { pewnoscSiebie: 95, upor: 45, dmgMin: 5, dmgMax: 9, critChance: 0.1, resist: { egzystencjalny: 15 } },
  auto: { type: 'egzystencjalny', range: 130, cooldown: 0.8, projectile: true },
  traits: { friendlyCopy: true },
  skills: [
    defineSkill('petlowiec', 1, 'przybycie', 'regulaminowy', 9, 'auto'),
    defineSkill('petlowiec', 2, 'spor', 'egzystencjalny', 11, 'auto'),
    defineSkill('petlowiec', 3, 'petla', 'mechaniczny', 16, 'auto'),
    defineSkill('petlowiec', 4, 'juzBylo', 'egzystencjalny', 14, 'auto', 'wygenerowane'),
    defineSkill('petlowiec', 5, 'start', 'mechaniczny', 12, 'wskazanie', 'powiadomienia'),
    // S20: the five skills that fill his kit (SKILLS.md §3); they open by level (their paragraphs list it), none wants a permission
    defineSkill('petlowiec', 6, 'uwaga', 'egzystencjalny', 3, 'auto'),
    defineSkill('petlowiec', 7, 'powtorzenie', 'egzystencjalny', 6, 'kierunek'),
    defineSkill('petlowiec', 8, 'paradoks', 'egzystencjalny', 14, 'wskazanie'),
    defineSkill('petlowiec', 9, 'opoznienie', 'regulaminowy', 16, 'auto'),
    defineSkill('petlowiec', 10, 'zamiana', 'mechaniczny', 12, 'auto'),
  ],
});
