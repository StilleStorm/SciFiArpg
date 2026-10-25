/** Data of the hero: numbers, auto-attack, five typed skills (DESIGN 10, 10.1). */
import { defineHero, defineSkill } from '../build';
import type { HeroDef } from '../defs';

export const def: HeroDef = defineHero('konsultant', {
  racja: 90,
  racjaPerLevel: 8,
  speed: 128,
  r: 13,
  baseStats: { pewnoscSiebie: 95, upor: 38, dmgMin: 4, dmgMax: 8, critChance: 0.1, resist: { regulaminowy: 10 } },
  auto: { type: 'regulaminowy', range: 190, cooldown: 0.75, projectile: true, lash: true },
  traits: { trialSpeed: 2, seesDefects: true, buffKillGwiazdki: 1 },
  skills: [
    defineSkill('konsultant', 1, 'prosze', 'regulaminowy', 8, 'wskazanie'),
    defineSkill('konsultant', 2, 'przekierowuje', 'egzystencjalny', 12, 'kierunek'),
    defineSkill('konsultant', 3, 'pomoc', 'regulaminowy', 20, 'auto'),
    defineSkill('konsultant', 4, 'numer', 'regulaminowy', 13, 'wskazanie', 'powiadomienia'),
    defineSkill('konsultant', 5, 'rozlaczenie', 'mechaniczny', 18, 'kierunek', 'urzadzenia'),
  ],
});
