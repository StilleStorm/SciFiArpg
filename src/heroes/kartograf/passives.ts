/** The six passives of the update form (progression/update.ts), text in `forms.update.passive.kartograf.N.{name,desc}`. */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { area: 0.12 } },
  { mods: { dmg: 0.1 } },
  { mods: { cooldown: -0.08 } },
  { mods: { speed: 0.1 } },
  { mods: { duration: 0.2 } },
  { mods: { crit: 0.06, dmg: 0.1 }, requires: 'urzadzenia' },
];
