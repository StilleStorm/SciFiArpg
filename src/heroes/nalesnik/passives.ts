/** The six passives of the update form (progression/update.ts), text in `forms.update.passive.nalesnik.N.{name,desc}`. */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { cooldown: -0.08 } },
  { mods: { dmg: 0.1 } },
  { mods: { area: 0.12 } },
  { mods: { regen: 0.6 } },
  { mods: { duration: 0.2 } },
  { mods: { speed: 0.08, cooldown: -0.05 }, requires: 'powiadomienia' },
];
