/** The ten passives (the first six of the update form, the 7th his rule, the 8th to 10th rules of the quirk) (progression/update.ts), text in `forms.update.passive.nalesnik.N.{name,desc}`. */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { cooldown: -0.08 } },
  { mods: { dmg: 0.1 } },
  { mods: { area: 0.12 } },
  { mods: { regen: 0.6 } },
  { mods: { duration: 0.2 } },
  { mods: { speed: 0.08, cooldown: -0.05 }, requires: 'powiadomienia' },
  // 7 Rownowaga hydrostatyczna is his rule: always on (`skim` in def.ts, the rounding in quirk.ts), outside the slots and never offered
  { mods: {}, rule: true },
  // 8 Pory (quirk.ts onSkim), 9 Masa krytyczna (hits.ts, quirk.ts dealtMul), 10 Satelita staly (steps.ts, quirk.ts): they change no number of the skills
  { mods: {} },
  { mods: {} },
  { mods: {} },
];
