/** The ten passives (the first six of the update form, the 7th his rule, the 8th to 10th rules of the quirk) (progression/update.ts), text in `forms.update.passive.petlowiec.N.{name,desc}`. */
import type { HeroPassive } from '../module';

export const passives: readonly HeroPassive[] = [
  { mods: { duration: 0.2 } },
  { mods: { dmg: 0.1 } },
  { mods: { crit: 0.05 } },
  { mods: { cooldown: -0.08 } },
  { mods: { regen: 0.5 } },
  { mods: { summonMax: 1 }, requires: 'wygenerowane' },
  // 7 Pętla po śmierci is his rule: always on (`traits.friendlyCopy` in def.ts, death/outcomes.ts), outside the slots and never offered
  { mods: {}, rule: true },
  // 8 Sprzeczność, 9 Dziennik pokładowy: heroes/petlowiec/quirk.ts reads them; 10 Zapasowa kapsuła: Pętla (skills.ts) reads it
  { mods: {} },
  { mods: {} },
  { mods: {} },
];
