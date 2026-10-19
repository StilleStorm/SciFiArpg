/** The six passives of the update form (progression/update.ts), text in `forms.update.passive.konsultant.N.{name,desc}`. */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { dmg: 0.1 } },
  { mods: { cooldown: -0.08 } },
  { mods: { crit: 0.05 } },
  { mods: { duration: 0.2 } },
  { mods: { xp: 0.1 } },
  { mods: { dmg: 0.15, area: 0.1 }, requires: 'powiadomienia' },
];
