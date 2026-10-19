/** The six passives of the update form (progression/update.ts), text in `forms.update.passive.pralka.N.{name,desc}`. */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { cooldown: -0.08 } },
  { mods: { shield: 20 } },
  { mods: { dmg: 0.1 } },
  { mods: { regen: 0.6 } },
  { mods: { area: 0.12 } },
  { mods: { duration: 0.25, lifeOnKill: 2 }, requires: 'urzadzenia' },
];
