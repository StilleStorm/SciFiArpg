/** Data of the hero: numbers, auto-attack, ten typed skills (DESIGN 10, 10.1). */
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
    // S20: skills 6 to 10 (docs/SKILLS.md section 4); they open by level (the `level` of their paragraphs), no permission
    defineSkill('kartograf', 6, 'pomiar', 'regulaminowy', 3, 'auto'),
    defineSkill('kartograf', 7, 'przekroj', 'mechaniczny', 10, 'kierunek'),
    defineSkill('kartograf', 8, 'granica', 'mechaniczny', 14, 'kierunek'),
    defineSkill('kartograf', 9, 'punktOdniesienia', 'regulaminowy', 22, 'wskazanie'),
    defineSkill('kartograf', 10, 'rozaWiatrow', 'egzystencjalny', 18, 'auto'),
  ],
});
