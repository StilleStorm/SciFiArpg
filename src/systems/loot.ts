import type { Bus } from '../core/events';
import type { Rng } from '../core/rng';
import { createPermissionPickup, createPickup } from '../entities/factory';
import type { FamilyId } from '../enemies/ids';
import { claimNamedDrop } from '../enemies/named';
import type { Pickup } from '../entities/types';
import { earnStars } from '../economy/stars';
import { t } from '../i18n';
import { tickAds } from '../items/ads';
import { rollItem } from '../items/generate';
import { addItem, inventoryFull } from '../items/inventory';
import { ilvlFor } from '../items/level';
import { advanceTrial, revealNote } from '../items/reviews';
import { uniqueNote } from '../items/uniques';
import { rollPotwierdzenie, takePotwierdzenie, tickRecovery } from './recovery';
import type { DropSource, Item, ItemTier } from '../items/types';
import { nextId, type RunState } from '../world/run';
import { isRetired } from '../enemies/anomalia/state';
import { finalUnique } from '../world/finale';
import type { PriorityId } from '../world/campaign';
import { BOSS_UNIQUE_CHANCE, DROP_TIER_WEIGHTS, DROPS, PRIORITY_STAR_MUL, PRIORITY_TIER_SHIFT } from '../balance/loot';

// the numbers live in balance/loot.ts (S16); `DROPS` is ITEMS 6.1 and 6.5, the chance of a potwierdzenie per rank is
// `POTWIERDZENIE_DROP` (balance/recovery.ts, rolled last)
export { BOSS_UNIQUE_CHANCE, DROP_TIER_WEIGHTS, DROPS, PRIORITY_STAR_MUL, PRIORITY_TIER_SHIFT };
export type TierWeights = readonly [number, number, number, number];
// SEAM: ITEMS 6.2 also gives 35% a zestaw piece of the planet's set (sets slice) and "Komisja przychyliła się" (a won Spór adds one tier to the best drop); both wait for their systems.

const TIER_ORDER: readonly ItemTier[] = ['zwykly', 'nietypowy', 'rzadki', 'unikatowy'];
const TIER_DOWN: Record<ItemTier, ItemTier> = { zwykly: 'zwykly', nietypowy: 'zwykly', rzadki: 'nietypowy', unikatowy: 'rzadki' };

const priorityOf = (s: RunState): PriorityId => s.plan?.priority ?? 'normalny';

/**
 * Roll a tier from the weights of a source. The priority moves a share of rolls one column (never past either end);
 * a law's tier bonus lifts zwykły and nietypowy up to rzadki, and never rolls a unique by itself.
 */
export function rollDropTier(rng: Rng, weights: TierWeights, priority: PriorityId, lawBonus = 0): ItemTier {
  const total = weights[0] + weights[1] + weights[2] + weights[3];
  let r = rng.next() * total;
  let idx = 0;
  for (let i = 0; i < 4; i++) {
    idx = i;
    r -= weights[i] ?? 0;
    if (r < 0) break;
  }
  const shift = PRIORITY_TIER_SHIFT[priority];
  if (shift !== 0 && rng.chance(Math.abs(shift))) idx = Math.max(0, Math.min(3, idx + Math.sign(shift)));
  if (lawBonus > 0 && idx < 2) idx = Math.min(2, idx + lawBonus);
  return TIER_ORDER[idx] ?? 'zwykly';
}

/** Item level of a drop at this moment of the run (items/level.ts; ITEMS 5.1). A run without a ticket plan counts as planet 1 Normalny. */
export const dropLevel = (s: RunState, boss = false): number =>
  ilvlFor({ planet: s.plan?.planet ?? 0, priority: priorityOf(s), pageIndex: s.pageIndex, pageCount: s.pageCount, boss });

function scatter(s: RunState, x: number, y: number): { x: number; y: number } {
  const rng = s.rngs.loot;
  const a = rng.range(0, Math.PI * 2);
  const d = rng.range(6, 26);
  return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
}

function dropItemPickup(s: RunState, x: number, y: number, item: Item): Pickup {
  const at = scatter(s, x, y);
  const number = s.nextItemNumber++;
  item.number = number;
  const k = createPickup(nextId(s), at.x, at.y, number, item);
  s.pickups.push(k);
  return k;
}

/**
 * Roll and place the drops of one dead enemy.
 * SEAM: ITEMS 6.4 przesyłka/awizo: a zestaw piece or unique from a common or elite arrives as a parcel at the paczkomat (slice f); for now it drops in place.
 */
export function dropLoot(s: RunState, x: number, y: number, source: DropSource): void {
  const table = DROPS[source];
  const rng = s.rngs.loot;
  const law = s.law;
  const mul = law.lootMul;
  const priority = priorityOf(s);
  const level = dropLevel(s, source === 'boss');
  let items = table.guaranteed;
  if (items === 0 && rng.chance(Math.min(1, table.item * mul))) items = 1;
  for (let i = 0; i < items; i++) {
    let tier: ItemTier;
    if (source === 'boss' && i === 0) {
      // The first boss drop is always at least rzadki; the final ticket's boss always hands over a unique.
      // the final ticket's boss hands over a unique the character has not archived yet (world/finale.ts finalUnique)
      const unique = s.plan?.kind === 'final' || rng.chance(Math.min(1, BOSS_UNIQUE_CHANCE * (priority === 'krytyczny' ? 2 : 1)));
      tier = unique ? 'unikatowy' : 'rzadki';
    } else {
      tier = rollDropTier(rng, DROP_TIER_WEIGHTS[source], priority, law.lootTierBonus);
    }
    const item = (source === 'boss' && i === 0 && tier === 'unikatowy' && s.plan?.kind === 'final' ? finalUnique(s, rng, level) : null) ?? rollItem(rng, { level, source, tier });
    dropItemPickup(s, x, y, item);
    if (law.lootPairs) {
      const twin = rollItem(rng, { level, tier: TIER_DOWN[item.tier], ...(item.uniqueId ? {} : { slot: item.slot }) });
      twin.variant = true;
      dropItemPickup(s, x, y, twin);
    }
  }
  if (rng.chance(Math.min(1, table.star * Math.max(0.5, mul)))) {
    const n = Math.max(1, Math.round(rng.int(table.starMin, table.starMax) * PRIORITY_STAR_MUL[priority]));
    const at = scatter(s, x, y);
    s.pickups.push(createPickup(nextId(s), at.x, at.y, 0, undefined, n));
  }
  rollPotwierdzenie(s, x, y, source); // last, so the rolls above keep their sequence
}

/**
 * One guaranteed item of at least `minTier` (a named elite: nietypowy or better). The tier is rolled from the elite
 * weights and lifted to the floor; the level is the page's. Returns the pickup. `bindLoot` calls it when
 * `claimNamedDrop` (enemies/named.ts) answers for the dead enemy.
 */
export function dropGuaranteed(s: RunState, x: number, y: number, minTier: ItemTier = 'nietypowy'): Pickup {
  const rng = s.rngs.loot;
  const rolled = rollDropTier(rng, DROP_TIER_WEIGHTS.elite, priorityOf(s), s.law.lootTierBonus);
  const tier = TIER_ORDER.indexOf(rolled) >= TIER_ORDER.indexOf(minTier) ? rolled : minTier;
  return dropItemPickup(s, x, y, rollItem(rng, { level: dropLevel(s), source: 'elite', tier }));
}

/** An elite of the family leaves its permission card one time in five, if the hero does not hold it; a boss always does (ITEMS 6.3). */
export const ELITE_PERMISSION_CHANCE = 0.2;

/** Roll the permission card for a dead enemy of `family`. Null when none drops. */
export function rollPermission(s: RunState, tier: DropSource, family: FamilyId | undefined): FamilyId | null {
  if (!family) return null;
  if (tier === 'boss') return family;
  if (tier === 'elite' && !s.player.permissions.includes(family) && s.rngs.loot.chance(ELITE_PERMISSION_CHANCE)) return family;
  return null;
}

/** Place the permission card beside the others. */
export function dropPermission(s: RunState, x: number, y: number, family: FamilyId): Pickup {
  const at = scatter(s, x, y);
  const k = createPermissionPickup(nextId(s), at.x, at.y, family);
  s.pickups.push(k);
  return k;
}

const fullNoted = new WeakMap<object, number>();

/**
 * Walking over a pickup. Gwiazdki go to the purse; an item goes to the inventory if there is room
 * (otherwise it stays on the ground with a footnote, at most one per 4 s). Returns true if taken.
 */
export function takePickup(s: RunState, bus: Bus, k: Pickup): boolean {
  const p = s.player;
  if (p.suspended) return false;
  if (k.potwierdzenie) return takePotwierdzenie(s, bus, k);
  if (k.permission) {
    // A permission is not an item: it goes straight into player.permissions (progression/update.ts reads it).
    const fam = t(`forms.update.family.${k.permission}`);
    const had = p.permissions.includes(k.permission);
    if (!had) p.permissions.push(k.permission);
    bus.emit('footnote', { text: t(had ? 'forms.permission.again' : 'forms.permission.granted', { family: fam }) });
    return true;
  }
  if (k.gwiazdki !== undefined && !k.item) {
    earnStars(p, k.gwiazdki);
    return true;
  }
  if (!k.item) return true;
  if (inventoryFull(p)) {
    const last = fullNoted.get(p) ?? -99;
    if (s.time - last > 4) {
      fullNoted.set(p, s.time);
      bus.emit('footnote', { text: t('items.full') });
    }
    return false;
  }
  addItem(p, k.item);
  bus.emit('pickup:taken', { id: k.id, number: k.number });
  if (k.item.uniqueId) bus.emit('footnote', { text: uniqueNote(k.item.uniqueId) });
  return true;
}

/** Per-step loot work: advertisements for free-version items. */
export function updateLoot(s: RunState, bus: Bus, dt: number): void {
  tickAds(s.player, bus, dt);
  tickRecovery(s, bus, dt);
}

/** Subscribe to kills: drops and trial progress. Call once; `getState` returns the current run. */
export function bindLoot(bus: Bus, getState: () => RunState | null): void {
  bus.on('enemy:died', (e) => {
    const s = getState();
    if (!s) return;
    if (isRetired(s, e.id)) return; // a body of the Anomalia that was struck and left: nothing falls (enemies/anomalia)
    const tier = e.tier ?? 'common';
    dropLoot(s, e.x, e.y, tier);
    const named = claimNamedDrop(s, e.id);
    if (named) dropGuaranteed(s, e.x, e.y, named.minTier);
    const fam = rollPermission(s, tier, e.family);
    if (fam) dropPermission(s, e.x, e.y, fam);
    for (const r of advanceTrial(s.player)) bus.emit('footnote', { text: revealNote(r) });
  });
}
