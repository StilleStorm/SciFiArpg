/** The six passives of the update form (progression/update.ts), text in `forms.update.passive.petlowiec.N.{name,desc}`. */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { duration: 0.2 } },
  { mods: { dmg: 0.1 } },
  { mods: { crit: 0.05 } },
  { mods: { cooldown: -0.08 } },
  { mods: { regen: 0.5 } },
  { mods: { summonMax: 1 }, requires: 'wygenerowane' },
];
