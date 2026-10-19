/** The six passives of the update form (progression/update.ts), text in `forms.update.passive.__ID__.N.{name,desc}`. TODO: tune them; the last one wants a permission. */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { dmg: 0.1 } },
  { mods: { cooldown: -0.08 } },
  { mods: { area: 0.12 } },
  { mods: { regen: 0.5 } },
  { mods: { duration: 0.2 } },
  { mods: { crit: 0.05, dmg: 0.1 }, requires: 'urzadzenia' },
];
