/**
 * The finale as a ticket (STORY 3, 8.4; PRODUCTION S15): the `final` plan is a run of ONE page, planet 1's base layout made
 * again from the seed with the stations struck and inert and the desk's place left to the Anomalia. No exit, no page turn, no waves
 * (`enemies/anomalia/core.ts` runs the three phases). The unique that closes the case is one the character has not archived yet.
 */
import { loadMeta } from '../save/save';
import { beginFinale } from '../enemies/anomalia/core';
import type { Bus } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import { dist } from '../core/vec';
import type { Item } from '../items/types';
import { makeUnique, UNIQUES } from '../items/uniques';
import { generateBase } from './base';
import { newCampaign, lawForPlanet, type CampaignState, type PriorityId, type TicketPlan } from './campaign';
import type { Page } from './pages';
import type { RunState } from './run';

/** True while the run is the final ticket's. */
export const isFinale = (s: { plan?: { kind: string } | undefined }): boolean => s.plan?.kind === 'final';

/** Decor within this distance of the desk is cleared away: the captcha grid of the second form needs the floor around it. */
export const DESK_CLEAR = 150;

/**
 * The one page of the finale for `seed`: the base layout of planet 1 (`generateBase(seed, 0)`, the same page the player left),
 * with no exit and no desk collider (the Anomalia stands in its place). The station colliders stay as walls; `page.base` stays so the
 * drawing can strike the stations (`render/finale.ts`). Pure.
 */
export function finalePage(seed: number): Page {
  const page = generateBase(seed, 0);
  const desk = page.base?.stations.find((st) => st.id === 'biurko');
  page.exit = null;
  page.index = 0;
  page.hasKiosk = false;
  if (desk) {
    page.obstacles = page.obstacles.filter((o) => {
      if (o.station === 'biurko') return false;
      if (o.station !== undefined) return true;
      return o.kind === 'torn' || !o.colliders.some((c) => dist(c, desk) < DESK_CLEAR + c.r);
    });
  }
  return page;
}

/** The plan of the final ticket for a seed and priority (planet 1, the clause of its pool). */
export const finalePlan = (seed: number, priority: PriorityId = 'normalny'): TicketPlan => ({ kind: 'final', planet: 0, priority, lawId: lawForPlanet(0, seed) });

/** A campaign at the moment the final ticket is issued: every planet of the list closed. */
export function finaleCampaign(planets: number): CampaignState {
  const c = newCampaign();
  c.closed = Array.from({ length: planets }, (_, i) => i);
  c.finalTicket = true;
  return c;
}

/** `populatePage` of the final ticket: the Anomalia takes the desk. */
export function startFinale(s: RunState, bus: Bus): void {
  s.populate = false;
  beginFinale(s, bus);
}

// ---------- the unique ----------

/** Ids of the uniques the character already holds: worn, carried, in a personal archive or in the shared one (from the saved file). */
export function heldUniqueIds(s: Pick<RunState, 'player'>): Set<string> {
  const held = new Set<string>();
  const add = (it: Item | undefined): void => {
    if (it?.uniqueId) held.add(it.uniqueId);
  };
  for (const it of Object.values(s.player.equipment)) add(it);
  for (const it of s.player.inventory) add(it);
  try {
    const meta = loadMeta();
    for (const it of meta.sharedArchive) add(it);
    for (const rec of meta.characters) for (const it of rec.archive) add(it);
  } catch {
    // an unreadable save means nothing is known to be archived
  }
  return held;
}

/**
 * The unique the final ticket's boss hands over: out of the existing pool, preferring those the character has not archived (or
 * holds). When every unique is held, any of them. Null only when the pool is empty.
 */
export function finalUnique(s: Pick<RunState, 'player'>, rng: Rng, level: number): Item | null {
  const held = heldUniqueIds(s);
  const fresh = UNIQUES.filter((u) => !held.has(u.id));
  const pool = fresh.length > 0 ? fresh : UNIQUES;
  const def = pool[rng.int(0, pool.length - 1)];
  return def ? makeUnique(def, rng.int(1, 0x3fffffff), level) : null;
}

/** Deterministic rng for tests that need a unique without a run. */
export const uniqueRng = (seed: number): Rng => createRng(seed).fork('final-unique');
