import type { Rng } from '../core/rng';
import type { Player } from '../entities/types';
import { UNWANTED_FEATURES, unwantedNote } from './affixes';
import { addAffix } from './rename';
import { recomputeStats } from './stats';

/**
 * "Wymagana aktualizacja": install one random unwanted feature on the worn weapon.
 * Returns the footnote ("Nowość! ...") or null when there is no weapon to update.
 * Matches `lawHooks.unwantedFeature` in world/laws.ts.
 */
export function installUnwantedFeature(state: { player: Player; rngs: { loot: Rng } }): string | null {
  const weapon = state.player.equipment.bron;
  if (!weapon) return null;
  const options = UNWANTED_FEATURES.filter((a) => !weapon.affixes.includes(a.id));
  if (!options.length) return null;
  const feature = state.rngs.loot.pick(options);
  addAffix(weapon, feature);
  recomputeStats(state.player);
  return unwantedNote(feature.id);
}
