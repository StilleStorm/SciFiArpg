/**
 * The passives of the update form (progression/update.ts), text in `forms.update.passive.pralka.N.{name,desc}`. 1..6 are stat changes;
 * 7 is her rule, Blad programu (quirk.ts), always on and never offered; 8..10 (S19) are read by quirk.ts and running.ts from `upgrades`.
 */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { cooldown: -0.08 } },
  { mods: { shield: 20 } },
  { mods: { dmg: 0.1 } },
  { mods: { regen: 0.6 } },
  { mods: { area: 0.12 } },
  { mods: { duration: 0.25, lifeOnKill: 2 }, requires: 'urzadzenia' },
  { mods: {}, rule: true },
  { mods: {} },
  { mods: {} },
  { mods: {} },
];
