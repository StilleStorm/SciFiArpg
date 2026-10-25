import type { Bus } from '../core/events';
import { installKiosk, onOfficeChanged } from '../economy/kiosk';
import { bindLoot } from '../systems/loot';
import { mountInventory } from '../ui/inventory';
import { lawHooks } from '../world/laws';
import type { RunState } from '../world/run';
import { bindDelivery } from './delivery';
import { bindSetEffects } from './setFx';
import { installUnwantedFeature } from './unwanted';

/**
 * Wire the item side of the game once: drops and trials on kills, the Załączniki sheet,
 * the in-run kiosk, and the two hooks the regulamin code offers (unwanted feature, office hours).
 */
export function installItems(root: HTMLElement, bus: Bus, getState: () => RunState | null): { openInventory(): void; closeInventory(): void } {
  bindLoot(bus, getState);
  bindSetEffects(bus, getState);
  bindDelivery(bus, getState); // S18: awizos go to the base paczkomat when a run ends
  const inv = mountInventory(root, bus, getState);
  installKiosk({ root, bus, getState });
  lawHooks.unwantedFeature ??= (s) => installUnwantedFeature(s);
  lawHooks.officeChanged ??= onOfficeChanged;
  return { openInventory: inv.open, closeInventory: inv.close };
}
