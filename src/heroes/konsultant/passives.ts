/** The ten passives (the first six of the update form, the 7th his rule, the 8th to 10th rules of the quirk) (progression/update.ts), text in `forms.update.passive.konsultant.N.{name,desc}`. */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { dmg: 0.1 } },
  { mods: { cooldown: -0.08 } },
  { mods: { crit: 0.05 } },
  { mods: { duration: 0.2 } },
  { mods: { xp: 0.1 } },
  { mods: { dmg: 0.15, area: 0.1 }, requires: 'powiadomienia' },
  // 7 Dostep do systemu is his rule: always on (`traits` in def.ts), outside the slots and never offered
  { mods: {}, rule: true },
  // 8 Numerek, 9 Polaczenie nagrywane, 10 Wstrzymanie oplat: they change no number of the skills; heroes/konsultant/quirk.ts reads them
  { mods: {} },
  { mods: {} },
  { mods: {} },
];
