/**
 * The desk forms' door to a run's loadout (Konfiguracja, Karta uprawnień). Thin adapters over heroes/specializations.ts: the
 * run's pads, ultimate and specialization read as a `LoadoutView`, and a change put through `setLoadout` (all or nothing) and
 * written back on the run. The save reads the same fields (`HeroRun.pads / ultimateId / spec`, save/character.ts); the caller
 * writes the save when the form closes. No rules here.
 */
import { PAD_SLOTS } from '../heroes/defs';
import { setLoadout, ultimatesOf, type Loadout, type LoadoutResult, type LoadoutView } from '../heroes/specializations';
import type { RunState } from '../world/run';

/** The run's loadout as the specializations API reads it (a copy: writing it does not touch the run). */
export function viewOf(s: RunState): LoadoutView {
  const [a, b, c] = s.hero.pads;
  return {
    heroId: s.player.heroId,
    pads: [a, b, c],
    upgrades: s.hero.upgrades,
    ...(s.hero.ultimateId ? { ultimate: s.hero.ultimateId } : {}),
    ...(s.hero.spec ? { specialization: s.hero.spec } : {}),
  };
}

/** The chosen specialization of the run, or null. */
export const chosenSpec = (s: RunState): string | null => s.hero.spec ?? null;

/** The run's loadout as a whole (the ultimate defaults to the hero's first). */
export function loadoutOf(s: RunState): Loadout {
  const [a, b, c] = s.hero.pads;
  return { pads: [a, b, c], ultimate: s.hero.ultimateId ?? ultimatesOf(s.player.heroId)[0] ?? '', specialization: chosenSpec(s) };
}

/** Put a change through `setLoadout`; on success the run carries it (the save follows from the run). Nothing changes otherwise. */
export function commitLoadout(s: RunState, change: Partial<Loadout>): LoadoutResult {
  const view = viewOf(s);
  const res = setLoadout(view, { ...loadoutOf(s), ...change });
  if (!res.ok) return res;
  for (const slot of PAD_SLOTS) s.hero.pads[slot] = view.pads[slot]; // in place: the pads UI holds the array
  if (view.ultimate) s.hero.ultimateId = view.ultimate;
  if (view.specialization) s.hero.spec = view.specialization;
  else delete s.hero.spec;
  return res;
}
