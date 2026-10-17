import type { Bus } from '../core/events';
import { createPickup } from '../entities/factory';
import type { Pickup } from '../entities/types';
import { addStars } from '../economy/stars';
import { t } from '../i18n';
import { tickAds } from '../items/ads';
import { rollItem } from '../items/generate';
import { addItem, inventoryFull } from '../items/inventory';
import { advanceTrial, revealNote } from '../items/reviews';
import { uniqueNote } from '../items/uniques';
import type { DropSource, Item, ItemTier } from '../items/types';
import { nextId, type RunState } from '../world/run';

interface DropTable {
  /** Chance of one item (bosses: guaranteed `guaranteed` items). */
  item: number;
  guaranteed: number;
  star: number;
  starMin: number;
  starMax: number;
}

export const DROPS: Record<DropSource, DropTable> = {
  common: { item: 0.2, guaranteed: 0, star: 0.45, starMin: 1, starMax: 1 },
  elite: { item: 0.7, guaranteed: 0, star: 1, starMin: 2, starMax: 4 },
  boss: { item: 1, guaranteed: 3, star: 1, starMin: 8, starMax: 14 },
};

const TIER_DOWN: Record<ItemTier, ItemTier> = { zwykly: 'zwykly', nietypowy: 'zwykly', rzadki: 'nietypowy', unikatowy: 'rzadki' };

/** Level of dropped items: hero level plus how deep into the run we are. */
export const dropLevel = (s: RunState): number => Math.max(1, s.player.level + s.pageIndex);

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

/** Roll and place the drops of one dead enemy. */
export function dropLoot(s: RunState, x: number, y: number, source: DropSource): void {
  const table = DROPS[source];
  const rng = s.rngs.loot;
  const law = s.law;
  const mul = law.lootMul;
  let items = table.guaranteed;
  if (items === 0 && rng.chance(Math.min(1, table.item * mul))) items = 1;
  for (let i = 0; i < items; i++) {
    const item = rollItem(rng, {
      level: dropLevel(s),
      source,
      tierBonus: law.lootTierBonus,
      // The first boss drop is always at least rzadki.
      ...(source === 'boss' && i === 0 ? { tier: rng.chance(0.3) ? ('unikatowy' as const) : ('rzadki' as const) } : {}),
    });
    dropItemPickup(s, x, y, item);
    if (law.lootPairs) {
      const twin = rollItem(rng, { level: dropLevel(s), tier: TIER_DOWN[item.tier], ...(item.uniqueId ? {} : { slot: item.slot }) });
      twin.variant = true;
      dropItemPickup(s, x, y, twin);
    }
  }
  if (rng.chance(Math.min(1, table.star * Math.max(0.5, mul)))) {
    const n = rng.int(table.starMin, table.starMax);
    const at = scatter(s, x, y);
    s.pickups.push(createPickup(nextId(s), at.x, at.y, 0, undefined, n));
  }
}

const fullNoted = new WeakMap<object, number>();

/**
 * Walking over a pickup. Gwiazdki go to the purse; an item goes to the inventory if there is room
 * (otherwise it stays on the ground with a footnote, at most one per 4 s). Returns true if taken.
 */
export function takePickup(s: RunState, bus: Bus, k: Pickup): boolean {
  const p = s.player;
  if (p.suspended) return false;
  if (k.gwiazdki !== undefined && !k.item) {
    addStars(p, k.gwiazdki);
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
}

/** Subscribe to kills: drops and trial progress. Call once; `getState` returns the current run. */
export function bindLoot(bus: Bus, getState: () => RunState | null): void {
  bus.on('enemy:died', (e) => {
    const s = getState();
    if (!s) return;
    dropLoot(s, e.x, e.y, e.tier ?? 'common');
    for (const r of advanceTrial(s.player)) bus.emit('footnote', { text: revealNote(r) });
  });
}
