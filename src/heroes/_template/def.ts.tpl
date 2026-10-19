/** Data of the hero: numbers, auto-attack, five typed skills (DESIGN 10, 10.1). TODO: every number below is a placeholder. */
import { defineHero, defineSkill } from '../build';
import type { HeroDef } from '../defs';

export const def: HeroDef = defineHero('__ID__', {
  racja: 80, // TODO: racja at level 1
  racjaPerLevel: 8,
  speed: 124,
  r: 13,
  baseStats: { pewnoscSiebie: 95, upor: 40, dmgMin: 5, dmgMax: 9, critChance: 0.1, resist: {} },
  // TODO: the auto-attack; `projectile: false` = a melee hit at once; add `hitscan`, `lash`, `pierceOnCrit` as needed (heroes/auto.ts)
  auto: { type: 'mechaniczny', range: 120, cooldown: 0.9, projectile: true },
  // TODO: traits (trialSpeed, seesDefects, revealsPage, skim, buffKillGwiazdki) and chosenNoteKey if the hero has any
  skills: [
    // TODO: id, damage type, cooldown, aim ('auto' | 'kierunek' | 'wskazanie'); skills 4 and 5 name the permission (family) they need
    defineSkill('__ID__', 1, '__ID__1', 'mechaniczny', 8, 'auto'),
    defineSkill('__ID__', 2, '__ID__2', 'regulaminowy', 10, 'auto'),
    defineSkill('__ID__', 3, '__ID__3', 'egzystencjalny', 12, 'auto'),
    defineSkill('__ID__', 4, '__ID__4', 'mechaniczny', 14, 'auto', 'urzadzenia'),
    defineSkill('__ID__', 5, '__ID__5', 'egzystencjalny', 20, 'auto', 'wygenerowane'),
  ],
});
