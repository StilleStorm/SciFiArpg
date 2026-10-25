/** The ten passives (the first six of the update form, the 7th his rule, the 8th to 10th rules of the quirk) (progression/update.ts), text in `forms.update.passive.kartograf.N.{name,desc}`. */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { area: 0.12 } },
  { mods: { dmg: 0.1 } },
  { mods: { cooldown: -0.08 } },
  { mods: { speed: 0.1 } },
  { mods: { duration: 0.2 } },
  { mods: { crit: 0.06, dmg: 0.1 }, requires: 'urzadzenia' },
  // 7 Mapa z gory is his rule: always on (`traits` in def.ts, the names in quirk.ts), outside the slots and never offered
  { mods: {}, rule: true },
  // 8 Odleglosc w linii prostej, 9 Blad pomiaru, 10 Trzeci punkt: they change no number of the skills; heroes/kartograf/quirk.ts and hits.ts read them
  { mods: {} },
  { mods: {} },
  { mods: {} },
];
