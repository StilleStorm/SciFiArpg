/**
 * A note the Asystent owes the player for choosing a hero. The profile screen (ui/profile.ts) files it when the choice is made,
 * the hero layer (heroes/layer.ts) prints it when the base page opens, after the footnotes of the new ticket were reset.
 */
import type { HeroId } from './index';

let pending: HeroId | null = null;

/** The profile was confirmed on `heroId` while the saved character was another hero's (or none). */
export function noteChosen(heroId: HeroId): void {
  pending = heroId;
}

/** The hero whose first-choice note is due, once; null when there is none. */
export function takeChosenNote(): HeroId | null {
  const id = pending;
  pending = null;
  return id;
}
