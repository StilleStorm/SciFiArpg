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
import { planetDef, type PriorityId } from '../world/campaign';
import { makeSetPiece } from '../items/setPieces';
import type { SetId } from '../items/types';
import { BOSS_SET_CHANCE, BOSS_UNIQUE_CHANCE, DROP_TIER_WEIGHTS, DROPS, NAMED_PERMISSION_CHANCE, PRIORITY_STAR_MUL, PRIORITY_TIER_SHIFT, SHOP_SET_CHANCE } from '../balance/loot';
import { sendByPost, tickDelivery } from '../items/delivery';

// the numbers live in balance/loot.ts (S16); `DROPS` is ITEMS 6.1 and 6.5, the chance of a potwierdzenie per rank is
// `POTWIERDZENIE_DROP` (balance/recovery.ts, rolled last)
export { BOSS_SET_CHANCE, BOSS_UNIQUE_CHANCE, DROP_TIER_WEIGHTS, DROPS, NAMED_PERMISSION_CHANCE, PRIORITY_STAR_MUL, PRIORITY_TIER_SHIFT, SHOP_SET_CHANCE };
/** The four-column weights of the older tables (zwykły / nietypowy / rzadki / unikatowy); the drop tables have five since S18 (zestaw is the fourth). */
export type TierWeights = readonly [number, number, number, number];
/** Where a drop came from: the ranks of `DropSource` and the named elite (S18; its gwiazdki and permission rows). */
export type LootRank = DropSource | 'named';
/** A column of ITEMS 6.1: a tier, or a zestaw piece (a rzadki item of the planet's set). */
export type DropColumn = ItemTier | 'zestaw';
// S17: the planet boss's first item is 35% a zestaw piece of the planet's set (a planet without one rolls nothing) and a won Spór lifts the
// best drop one tier, "Komisja przychyliła się" (ITEMS 6.2): rzadki -> zestaw -> unikatowy, and on a planet without a set the second item
// rises one tier (to rzadki at most) instead.

const TIER_ORDER: readonly ItemTier[] = ['zwykly', 'nietypowy', 'rzadki', 'unikatowy'];
/** One tier up for the second boss item when a won Spór has nothing above rzadki to give (no set on the planet): never past rzadki. */
const TIER_UP: Record<ItemTier, ItemTier> = { zwykly: 'nietypowy', nietypowy: 'rzadki', rzadki: 'rzadki', unikatowy: 'unikatowy' };
const TIER_DOWN: Record<ItemTier, ItemTier> = { zwykly: 'zwykly', nietypowy: 'zwykly', rzadki: 'nietypowy', unikatowy: 'rzadki' };

const priorityOf = (s: RunState): PriorityId => s.plan?.priority ?? 'normalny';

const COLUMNS5: readonly DropColumn[] = ['zwykly', 'nietypowy', 'rzadki', 'zestaw', 'unikatowy'];

/**
 * Roll a column from the weights of a source (four columns, or five with zestaw). The priority moves a share of rolls one column
 * (never past either end); a law's tier bonus lifts zwykły and nietypowy up to rzadki, and never rolls a unique by itself.
 */
export function rollDropColumn(rng: Rng, weights: readonly number[], priority: PriorityId, lawBonus = 0): DropColumn {
  const cols: readonly DropColumn[] = weights.length === 5 ? COLUMNS5 : TIER_ORDER;
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  let idx = 0;
  for (let i = 0; i < cols.length; i++) {
    idx = i;
    r -= weights[i] ?? 0;
    if (r < 0) break;
  }
  const shift = PRIORITY_TIER_SHIFT[priority];
  if (shift !== 0 && rng.chance(Math.abs(shift))) idx = Math.max(0, Math.min(cols.length - 1, idx + Math.sign(shift)));
  if (lawBonus > 0 && idx < 2) idx = Math.min(2, idx + lawBonus);
  return cols[idx] ?? 'zwykly';
}

/** `rollDropColumn` for callers that have no zestaw: a zestaw column rolls rzadki. */
export function rollDropTier(rng: Rng, weights: readonly number[], priority: PriorityId, lawBonus = 0): ItemTier {
  const col = rollDropColumn(rng, weights, priority, lawBonus);
  return col === 'zestaw' ? 'rzadki' : col;
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

/** The weights a rank rolls its item from: a named elite's own item is the elite's roll (its extra guaranteed one is `dropNamedItem`). */
const itemSource = (source: LootRank): DropSource => (source === 'named' ? 'elite' : source);

/** The piece of the planet's set a zestaw column rolls, or null when the planet hosts none (then the column rolls rzadki). */
const hostedSetOf = (s: RunState): SetId | null => planetDef(s.plan?.planet ?? 0).hostedSet;

/**
 * Roll and place the drops of one dead enemy. A zestaw piece or a unique of a common or elite enemy, and a rzadki three times in ten, is
 * sent by post (items/delivery.ts, ITEMS 6.4) instead of dropping, one per page; a boss hands over in person. `bus` carries the awizo's footnote.
 */
export function dropLoot(s: RunState, x: number, y: number, source: LootRank, bus?: Bus): void {
  const table = DROPS[source];
  const rank = itemSource(source);
  const rng = s.rngs.loot;
  const law = s.law;
  const mul = law.lootMul;
  const priority = priorityOf(s);
  const level = dropLevel(s, rank === 'boss');
  let items = table.guaranteed;
  if (items === 0 && rng.chance(Math.min(1, table.item * mul))) items = 1;
  const hosted = hostedSetOf(s);
  const won = rank === 'boss' && s.sporWon === true;
  let liftSecond = false;
  for (let i = 0; i < items; i++) {
    let tier: ItemTier;
    let setId: SetId | null = null;
    if (rank === 'boss' && i === 0) {
      // The first boss drop is always at least rzadki; the final ticket's boss always hands over a unique.
      // the final ticket's boss hands over a unique the character has not archived yet (world/finale.ts finalUnique)
      let unique = s.plan?.kind === 'final' || rng.chance(Math.min(1, BOSS_UNIQUE_CHANCE * (priority === 'krytyczny' ? 2 : 1)));
      if (!unique && hosted && rng.chance(Math.min(1, BOSS_SET_CHANCE * (priority === 'krytyczny' ? 2 : 1)))) setId = hosted;
      if (won && !unique) {
        // Komisja przychyliła się: the best drop is one tier higher
        if (setId) {
          setId = null;
          unique = true;
        } else if (hosted) setId = hosted;
        else liftSecond = true;
      }
      tier = unique ? 'unikatowy' : 'rzadki';
    } else {
      const column = rollDropColumn(rng, DROP_TIER_WEIGHTS[rank], priority, law.lootTierBonus);
      if (column === 'zestaw') {
        tier = 'rzadki';
        setId = hosted; // a planet without a set rolls that share as a rzadki
      } else tier = column;
      if (liftSecond && i === 1) tier = TIER_UP[tier];
    }
    const item =
      (setId ? makeSetPiece(rng, setId, level) : null) ??
      (rank === 'boss' && i === 0 && tier === 'unikatowy' && s.plan?.kind === 'final' ? finalUnique(s, rng, level) : null) ??
      rollItem(rng, { level, source: rank, tier });
    if (rank === 'boss' || !sendByPost(s, bus, rng, item)) dropItemPickup(s, x, y, item);
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
  rollPotwierdzenie(s, x, y, rank); // last, so the rolls above keep their sequence
}

/**
 * One guaranteed item of at least `minTier` (a teczka's find: nietypowy or better). The tier is rolled from the elite
 * weights (zestaw counted as rzadki, as before S18) and lifted to the floor; the level is the page's. Returns the pickup.
 */
export function dropGuaranteed(s: RunState, x: number, y: number, minTier: ItemTier = 'nietypowy'): Pickup {
  const rng = s.rngs.loot;
  const [zw, nt, rz, ze, un] = DROP_TIER_WEIGHTS.elite;
  const rolled = rollDropTier(rng, [zw, nt, rz + ze, un], priorityOf(s), s.law.lootTierBonus);
  const tier = TIER_ORDER.indexOf(rolled) >= TIER_ORDER.indexOf(minTier) ? rolled : minTier;
  return dropItemPickup(s, x, y, rollItem(rng, { level: dropLevel(s), source: 'elite', tier }));
}

/**
 * The extra item of a named elite (ITEMS 6.1, `DROP_TIER_WEIGHTS.named` 0/55/40/4/1): at least `minTier`, a zestaw piece of the planet's set
 * in its fourth column (rzadki where none is hosted), sent by post like every elite zestaw. Returns the pickup, or null when it went by post.
 */
export function dropNamedItem(s: RunState, x: number, y: number, minTier: ItemTier = 'nietypowy', bus?: Bus): Pickup | null {
  const rng = s.rngs.loot;
  const level = dropLevel(s);
  const column = rollDropColumn(rng, DROP_TIER_WEIGHTS.named, priorityOf(s), s.law.lootTierBonus);
  const rolled: ItemTier = column === 'zestaw' ? 'rzadki' : column;
  const tier = TIER_ORDER.indexOf(rolled) >= TIER_ORDER.indexOf(minTier) ? rolled : minTier;
  const hosted = column === 'zestaw' ? hostedSetOf(s) : null;
  const item = (hosted ? makeSetPiece(rng, hosted, level) : null) ?? rollItem(rng, { level, source: 'elite', tier });
  if (sendByPost(s, bus, rng, item)) return null;
  return dropItemPickup(s, x, y, item);
}

/** An elite of the family leaves its permission card one time in five, if the hero does not hold it; a boss always does (ITEMS 6.3). */
export const ELITE_PERMISSION_CHANCE = 0.2;

/** Roll the permission card for a dead enemy of `family`. Null when none drops. */
export function rollPermission(s: RunState, tier: LootRank, family: FamilyId | undefined): FamilyId | null {
  if (!family) return null;
  if (tier === 'boss') return family;
  // S18: a named elite of the family leaves it every time the hero does not hold it (ITEMS 6.3)
  if (tier === 'named') return !s.player.permissions.includes(family) && NAMED_PERMISSION_CHANCE >= 1 ? family : null;
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
  tickDelivery(s, bus, dt);
}

/** Subscribe to kills: drops and trial progress. Call once; `getState` returns the current run. */
export function bindLoot(bus: Bus, getState: () => RunState | null): void {
  bus.on('spor:answered', (e) => {
    const s = getState();
    if (s && e.right) s.sporWon = true;
  });
  bus.on('enemy:died', (e) => {
    const s = getState();
    if (!s) return;
    if (isRetired(s, e.id)) return; // a body of the Anomalia that was struck and left: nothing falls (enemies/anomalia)
    const tier = e.tier ?? 'common';
    const named = claimNamedDrop(s, e.id);
    dropLoot(s, e.x, e.y, named ? 'named' : tier, bus);
    if (tier === 'boss' && s.sporWon === true) bus.emit('footnote', { text: t('items.loot.komisja') });
    if (named) dropNamedItem(s, e.x, e.y, named.minTier, bus);
    const fam = rollPermission(s, named ? 'named' : tier, e.family);
    if (fam) dropPermission(s, e.x, e.y, fam);
    for (const r of advanceTrial(s.player)) bus.emit('footnote', { text: revealNote(r) });
  });
}
